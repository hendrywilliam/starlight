import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  GuildMember,
} from "discord.js";
import fs from "node:fs";
import path from "node:path";
import type {
  ExtendedClient,
  Module,
  DocumentChunkMetadata,
} from "./types/discord";
import type { RAGModule } from "../modules/ai/rag";
import { PermissionManager } from "../modules/permission-manager";
import type { Logger } from "winston";

export class Discord {
  private client: ExtendedClient;
  public token: string;
  public version: string;
  public module: Map<string, Module>;
  public logger: Logger;

  constructor(token: string, version: string, logger: Logger) {
    this.version = version;
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    Object.defineProperty(client, "commands", {
      value: new Collection(),
      writable: false,
    });
    this.client = client as ExtendedClient;
    this.token = token;
    this.module = new Map<string, Module>();
    this.logger = logger;
  }

  public start() {
    this._register();
    this._login();
    return;
  }

  private _login() {
    this.client.once(Events.ClientReady, (client) => {
      this.logger.info(`logged in as ${client.user.tag}`);
    });
    this.client.login(this.token);
    this._listen();
  }

  private _listen() {
    this.client.on(Events.ThreadCreate, async (thread) => {
      if (!thread.isThread()) {
        return;
      }
      const permission = this.module.get("permission") as
        | PermissionManager
        | undefined;
      if (!permission || !permission.isAllowedChannel(thread.parentId!)) {
        return;
      }
      const messages = (await thread.messages.fetch({ limit: 1 }))
        .values()
        .toArray();
      const ragModule = this.module.get("rag") as RAGModule | undefined;
      if (!ragModule) {
        this.logger.error("cant find selected module: RAG");
        throw new Error("Something went wrong.");
      }
      const message = messages[0];
      if (!message) {
        this.logger.error(
          `cant find a message from thread with id: ${thread.id} `
        );
        throw new Error("No message found.");
      }
      const contents = await ragModule.splitText(message.content);
      const rows = await Promise.all(
        contents.map(async (item, index) => {
          const vectorFromQuery = await ragModule.embedQuery(item);
          return {
            content: item,
            metadata: {
              id: `${message.id}_chunk_${index}`,
              parent_id: message.id,
              channel_id: thread.parentId ? thread.parentId : "",
            } satisfies DocumentChunkMetadata,
            embedding: vectorFromQuery,
          };
        })
      );
      for (const attachment of message.attachments.values()) {
        const mimeType = attachment.contentType
          ? attachment.contentType.split(";")[0]
          : "";
        if (mimeType === "text/plain") {
          try {
            const response = await fetch(attachment.url, {
              method: "GET",
            });
            const textContent = await response.text();
            const attachmentContents = await ragModule.splitText(textContent);
            const attachmentRows = await Promise.all(
              attachmentContents.map(async (item, index) => {
                const vectorFromQuery = await ragModule.embedQuery(item);
                return {
                  content: item,
                  metadata: {
                    channel_id: thread.parentId ? thread.parentId : "",
                    id: `${message.id}_chunk_${index}`,
                    parent_id: message.id,
                    is_attachment: true,
                    attachment_id: attachment.id,
                    attachment_name: attachment.name,
                  } satisfies DocumentChunkMetadata,
                  embedding: vectorFromQuery,
                };
              })
            );
            rows.push(...attachmentRows);
          } catch (error) {
            this.logger.error(
              `error while processing thread/message attachments ${attachment.id}:`,
              error
            );
          }
        }
      }
      await ragModule.db.from("documents").insert(rows);
      this.logger.info(
        `document chunks from message: ${message.id} has been added.`
      );
    });

    this.client.on(Events.ThreadDelete, async (thread) => {
      try {
        if (!thread.isThread()) {
          return;
        }
        const permission = this.module.get("permission") as
          | PermissionManager
          | undefined;
        if (!permission || !permission.isAllowedChannel(thread.parentId!)) {
          return;
        }
        const ragModule = this.module.get("rag") as RAGModule | undefined;
        if (!ragModule) {
          this.logger.error("cant find selected module: RAG");
          return;
        }
        const { error } = await ragModule.db
          .from("documents")
          .delete()
          .eq("metadata->>parent_id", thread.id);
        if (error) {
          throw new Error(error.message || "Something went wrong");
        }
        this.logger.info(
          `document chunks from thread: ${thread.id} have been deleted.`
        );
      } catch (error) {
        this.logger.error(
          `cant delete a thread with id: ${thread.id}: `,
          error
        );
      }
    });

    this.client.on(Events.MessageUpdate, async (_, newMessage) => {
      try {
        const fresh = await newMessage.fetch();
        const threadPost = await fresh.channel.fetch();
        if (!threadPost.isThread()) {
          return;
        }
        this.logger.info(`changes detected in message with id: ${fresh.id}.`);
        const ragModule = this.module.get("rag") as RAGModule | undefined;
        if (!ragModule) {
          return;
        }
        const messageId = fresh.id;
        const content = fresh.content;
        const splitted = await ragModule.splitText(content);
        const rows = await Promise.all(
          splitted.map(async (item, index) => {
            const vectorFromQuery = await ragModule.embedQuery(item);
            return {
              content: item,
              metadata: {
                id: `${messageId}_chunk_${index}`,
                parent_id: messageId,
                channel_id: threadPost.parentId!,
              } satisfies DocumentChunkMetadata,
              embedding: vectorFromQuery,
            };
          })
        );
        await ragModule.db
          .from("documents")
          .update(rows)
          .eq("metadata->>parent_id", messageId.toString());
        this.logger.info(
          `document chunks from message id: ${fresh.id} have been updated.`
        );
      } catch (error) {
        this.logger.error(error);
      }
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) {
        this.logger.error(
          `unexpected type of interaction, expected: ChatInputCommandInteraction, received: ${interaction.type}`
        );
        throw new Error("There was an error while executing this command.");
      }
      try {
        const command = (interaction.client as ExtendedClient).commands.get(
          interaction.commandName
        );
        if (!command) {
          this.logger.error(
            `no command matching ${interaction.command} was found.`
          );
          throw new Error(
            `No command matching ${interaction.commandName} was found.`
          );
        }
        const permission = this.module.get("permission") as
          | PermissionManager
          | undefined;
        if (!permission) {
          throw new Error("You are not allowed to use this command.");
        }
        if (
          !permission.hasPermission(
            interaction.member as GuildMember,
            interaction.commandName
          )
        ) {
          throw new Error("You are not allowed to use this command.");
        }
        await command?.execute(interaction, this.module);
      } catch (error) {
        const _error =
          error instanceof Error
            ? error.message
            : "There was an error while executing this command.";
        this.logger.error(_error, error);
        if (interaction.replied || interaction.deferred) {
          return await interaction.editReply({
            content: _error,
          });
        }
        return await interaction.reply({
          content: _error,
        });
      }
    });
  }

  public addModule(moduleName: string, module: Module) {
    this.module.set(moduleName, module);
    this.logger.info(`module: ${moduleName} assigned.`);
    return this;
  }

  public async shutdown() {
    return await this.client.destroy();
  }

  private async _register() {
    const commandsPath = path.join(process.cwd(), "src", "discord", "commands");
    const commandsFolders = fs.readdirSync(commandsPath);
    for (const file of commandsFolders) {
      const commandPath = path.join(commandsPath, file);
      const command = (await import(commandPath)).default;
      if ("data" in command && "execute" in command) {
        this.client.commands.set(command.data.name, command);
      } else {
        console.log(
          `The command at ${commandPath} is missing required "data" or "execute" property.`
        );
      }
    }
  }
}
