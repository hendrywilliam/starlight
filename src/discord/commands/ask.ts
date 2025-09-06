import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  type CacheType,
} from "discord.js";
import type { Module } from "../types/discord";
import { InteractionContextType } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask me a question.")
    .addStringOption((option) => {
      option.setName("question").setDescription("Please insert your question.");
      return option;
    })
    .setContexts(InteractionContextType.Guild),
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>,
    module: Map<string, Module>
  ) {
    await interaction.reply("Beep boop beep boop, let me think...");
    const question = interaction.options.getString("question");
    const kbModule = module.get("kb");
    if (!kbModule) {
      throw new Error("Failed to get knowledge base module.");
    }
    const result = await kbModule.execute(question);
    await interaction.editReply(result);
  },
};
