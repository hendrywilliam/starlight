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
### List all commands
1. \`\`\/ask\`\` - Ask AI a question.
      
### Privileged commands.
1. \`\`\/fetch\`\` - Fetch a thread and feed it to database.`
    );
  },
};
