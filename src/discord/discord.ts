import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from "discord.js";
import fs from "node:fs";
import path from "node:path";
import type { ExtendedClient, Module } from "./types/discord";

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
        console.error(error);
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
