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
1. \`\`\/fetch\`\` - Fetch a message/messages from a channel.
2. \`\`\/setup\`\` - Initial setup for a guild. Only owner can use this command.
5. \`\`\/addrole\`\` - Add moderator role to this guild.
  `
    );
  },
};
