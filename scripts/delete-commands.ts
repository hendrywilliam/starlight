#!/usr/bin/env bun
import { REST, Routes } from "discord.js";

/**
 * Delete commands from a guild.
 */
async function main() {
  try {
    const rest = new REST().setToken(process.env.DISCORD_APP_TOKEN!);
    await rest.delete(
      Routes.applicationGuildCommand(
        process.env.DISCORD_APP_ID!,
        "1341572597271236618",
        "1423309009758191641"
      )
    );
    console.log("Command deleted");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
