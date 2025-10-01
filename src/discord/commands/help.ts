import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  type CacheType,
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show list of all commands."),
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    await interaction.reply(
      `
### All commands.
1. \`\`\/ask\`\` - Ask AI a question.
      
### Privileged commands.
1. \`\`\/fetch\`\` - Fetch a message and feed it to database.
2. \`\`\/setup\`\` - Initial setup for a guild. Only owner can use this command.
3. \`\`\/update\`\` - Update guild information. Only selected roles can use this command.
4. \`\`\/addrole\`\` - Add moderator role to this guild.
  `
    );
  },
};
