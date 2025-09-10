import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  GuildMember,
  type CacheType,
} from "discord.js";
import fs from "node:fs";
import path from "node:path";
import type {
  ExtendedClient,
  Module,
  DocumentChunkMetadata,
} from "./types/discord";
import { textSplitter } from "../lib/text-splitter";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { embeddings } from "../lib/embeddings";
import { supabase } from "../lib/supabase";
import type { Document } from "langchain/document";
import type { RAGModule } from "../modules/ai/rag";
import { PermissionManager } from "../modules/permission-manager";

export class Discord {
  private client: ExtendedClient;
  public token: string;
  public version: string;
  public module: Map<string, Module>;

  constructor(token: string, version: string) {
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
  }

  public start() {
    this._register();
    this._login();
    return;
  }

  private _login() {
    this.client.once(Events.ClientReady, (client) => {
      console.log(`Ready! Logged in as ${client.user.tag}`);
    });
    this.client.login(this.token);
    this._listen();
  }

  private _listen() {
    this.client.on(Events.ThreadCreate, async (threadPost) => {
      if (!threadPost.isThread()) {
        return;
      }
      const messages = (await threadPost.messages.fetch({ limit: 1 }))
        .values()
        .toArray();

      const ragModule = this.module.get("rag") as RAGModule | undefined;
      if (!ragModule) {
        throw new Error("Something went wrong.");
      }
      const content = messages[0]?.content || "No content";
      const messageId = messages[0]?.id;
      const contents = await ragModule.splitText(content);
      const documents = contents.map((content, index) => {
        return {
          pageContent: content,
          metadata: {
            id: `${messageId}_chunk_${index}`,
            parent_id: messageId!,
            channel_id: threadPost.parentId ? threadPost.parentId : "",
          },
        } satisfies Document;
      });
      await ragModule.addDocuments(documents);
      console.log("Documents have been added.");
    });

    this.client.on(Events.ThreadDelete, async (thread) => {
      try {
        if (!thread.isThread()) {
          return;
        }
        const ragModule = this.module.get("rag") as RAGModule | undefined;
        if (!ragModule) {
          return;
        }
        const { error } = await ragModule.db
          .from("documents")
          .delete()
          .eq("metadata->>parent_id", thread.id);
        if (error) {
          throw new Error(error.message || "Something went wrong");
        }
      } catch (error) {
        console.error(error);
      }
    });

    this.client.on(Events.MessageUpdate, async (_, newMessage) => {
      try {
        const fresh = await newMessage.fetch();
        const threadPost = await fresh.channel.fetch();
        if (!threadPost.isThread()) {
          return;
        }
        console.log("Changes detected in message.");
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
        console.log("Documents have been updated.");
      } catch (error) {
        console.error(error);
      }
    });

    this.client.on(Events.ThreadUpdate, async (thread) => {
      if (!thread.isThread()) {
        return;
      }
      const messages = (await thread.messages.fetch({ limit: 10 }))
        .values()
        .toArray();
      // Batch processing
      const [documents] = await Promise.all(
        messages.map(async (message, index) => {
          const parentId = message.id;
          const chunks = await textSplitter.splitText(message?.content || "");
          return {
            chunks,
            metadatas: {
              id: `${parentId}_chunk_${index}`,
              parent_id: message.id,
            },
          };
        })
      );
      await SupabaseVectorStore.fromTexts(
        documents?.chunks || [],
        documents?.metadatas || [],
        embeddings,
        {
          client: supabase,
          tableName: "documents",
          queryName: "match_documents",
        }
      );
      console.log("Documents have been updated.");
    });
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) {
        throw new Error("There was an error while executing this command.");
      }
      try {
        const command = (interaction.client as ExtendedClient).commands.get(
          interaction.commandName
        );
        if (!command) {
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
        if (interaction.replied || interaction.deferred) {
          return await interaction.editReply({
            content:
              error instanceof Error
                ? error.message
                : "There was an error while executing this command.",
          });
        }
        return await interaction.reply({
          content:
            error instanceof Error
              ? error.message
              : "There was an error while executing this command.",
        });
      }
    });
  }

  public addModule(moduleName: string, module: Module) {
    this.module.set(moduleName, module);
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
