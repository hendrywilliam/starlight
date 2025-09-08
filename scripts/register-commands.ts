#!/usr/bin/env bun

import { REST, Routes } from "discord.js";
import fs from "node:fs";
import path from "node:path";

async function main() {
  try {
    const folderPath = path.join(
      import.meta.dirname,
      "..",
      "src",
      "discord",
      "commands"
    );
    const commandFiles = fs.readdirSync(folderPath);
    const commands = [];

    for (const commandFile of commandFiles) {
      const commandFilePath = path.join(folderPath, commandFile);
      const command = (await import(commandFilePath)).default;
      if ("data" in command && "execute" in command) {
        commands.push(command.data.toJSON());
      } else {
        console.log(
          `[WARNING] The command at ${commandFilePath} is missing a required "data" or "execute" property.`
        );
      }
    }

    const DISCORD_APP_CLIENT_ID = process.env.DISCORD_APP_ID || "";
    const DISCORD_APP_TOKEN = process.env.DISCORD_APP_TOKEN || "";

    const rest = new REST().setToken(DISCORD_APP_TOKEN);

    (async () => {
      try {
        console.log(`Started refreshing app commands.`);
        await rest.put(Routes.applicationCommands(DISCORD_APP_CLIENT_ID), {
          body: commands,
        });
        console.log(`Successfully reloaded application (/) commands.`);
        process.exit(0);
      } catch (error) {
        console.error(error);
        process.exit(1);
      }
    })();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
main();
