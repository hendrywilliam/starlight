import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
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
    const ALLOWED_CHANNEL_IDS = (
      process.env.ALLOWED_THREAD_CHANNEL_ID as string
    ).split(",");

    this.client.on(Events.ThreadCreate, async (thread) => {
      if (!thread.isThread()) {
        return;
      }
      if (thread.parentId && !ALLOWED_CHANNEL_IDS.includes(thread.parentId)) {
        return;
      }
      const messages = (await thread.messages.fetch({ limit: 1 }))
        .values()
        .toArray();
      // Initial messages.
      const parentMessage = messages[0]?.content || "No content";
      const parentMessageId = messages[0]?.id;
      const contents = await textSplitter.splitText(parentMessage);
      const metadatas = contents.map((_, index) => {
        return {
          id: `${parentMessageId}_chunk_${index}`,
          parent_id: parentMessageId as string,
        } satisfies DocumentChunkMetadata;
      });
      await SupabaseVectorStore.fromTexts(contents, metadatas, embeddings, {
        client: supabase,
        tableName: "documents",
        queryName: "match_documents",
      });
      console.log("Documents have been added.");
    });

    this.client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
      console.log("hi");
      const a = await newMessage.fetch();
      console.log(a);
    });

    this.client.on(Events.ThreadUpdate, async (thread) => {
      if (!thread.isThread()) {
        return;
      }
      if (thread.parentId && !ALLOWED_CHANNEL_IDS.includes(thread.parentId)) {
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
        return;
      }
      const command = (interaction.client as ExtendedClient).commands.get(
        interaction.commandName
      );
      if (!command) {
        throw new Error(
          `No command matching ${interaction.commandName} was found.`
        );
      }
      try {
        await command?.execute(interaction, this.module);
      } catch (error) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "There was an error while executing this command!",
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: "There was an error while executing this command!",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    });
  }

  public addModule(moduleName: string, module: Module) {
    this.module.set(moduleName, module);
    return this;
  }

  private async _register() {
    const commandsPath = path.join(__dirname, "commands");
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
