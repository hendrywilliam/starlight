import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  type CacheType,
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show list of all commands.")
    .addStringOption((option) => {
      option
        .setName("command")
        .setDescription("Choose a command to see details about it.")
        .addChoices(
          {
            name: "ask",
            value: "ask",
          },
          {
            name: "fetch",
            value: "fetch",
          },
          {
            name: "setup",
            value: "setup",
          },
          {
            name: "addrole",
            value: "addrole",
          },
          {
            name: "check",
            value: "check",
          },
          {
            name: "delete",
            value: "delete",
          }
        );
      return option;
    }),
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const command = interaction.options.getString("command");
    switch (command) {
      case "ask":
        await interaction.reply(`# Ask
Interact with Zona Merah AI by asking question and receiving generated response.

**Usage**
/ask <question>

**Example**
/ask question:What is rat way in zona merah?

-# *Public can execute this command.`);
        break;
      case "fetch":
        await interaction.reply(`# Fetch
Fetch one or multiple messages from a \`Text-based channel\` or a \`Thread channel\`. Supports multiple IDs seperated by commas in sequential order. The first ID acts as the parent, others follow as content.

**Usage**
/fetch <channel_id> <message_ids>

**Example**
/fetch channel_id: 1423172416867405956 message_id: 1421999812231958630
/fetch channel_id: 1423172416867405956 message_id: 1421999812231958630,1422000695749378079

-# *Privileged roles can execute this command.`);
        break;
      case "setup":
        await interaction.reply(`# Setup
This command is owner command used to configure your server for AI chats. This will assign the given \`Category Channel\` as the host location for AI chats.

**Usage**
/setup <category_id>

**Example**
/setup category_id:1423224452841341049

-# *Only guild owner can execute this command.`);
        break;
      case "addrole":
        await interaction.reply(`# Addrole
Add a role and give it permission to view each AI chat channel in this guild. Ensure the role is created first.

**Usage**
/addrole <role_id>

**Example**
/addrole role_id:1367808410745180190

-# *Only guild owner can execute this command.`);
        break;
      case "check":
        await interaction.reply(`# Check
Verify whether a message ID is available and display a short snippet of its content.

**Usage**
/check <message_id>

**Example**
/check message_id:1423173150761422890

-# *Privileged roles can execute this command.`);
        break;
      case "delete":
        await interaction.reply(`# Delete
Delete an existing message and purge all of the contents.

**Usage**
/delete <message_id>

**Example**
/delete message_id:1423173150761422890

-# *Privileged roles can execute this command.`);
        break;
      default:
        await interaction.reply(
          `
### All commands.
1. \`\/ask <question>\` - Ask AI a question.
2. \`\/help <command?>\` - Provides descriptions for all commands or detailed information about a specific command.
      
### Privileged commands.
1. \`\/fetch <channel_id> <message_id>\` - Fetch a message/messages from a channel.
2. \`\/setup <category_id>\` - Initial setup for a guild. Only owner can use this command.
3. \`\/addrole <role_id>\` - Add moderator role to this guild.
4. \`\/check <message_id>\` - Check if a message is exists and preview part of its content.
5. \`\/delete <message_id>\` - Delete an existing message.
  `
        );
        break;
    }
  },
};
