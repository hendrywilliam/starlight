import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  type CacheType,
} from "discord.js";
import type { Module } from "../types/discord";
import type { CommandLogger } from "../types/command";
import type { RAGModule } from "../../modules/rag";

export default {
  data: new SlashCommandBuilder()
    .setName("check")
    .setDescription("Check a message and get some of the content.")
    .addStringOption((option) => {
      option.setName("message_id").setDescription("Message ID to check.");
      return option;
    }),
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>,
    module: Map<string, Module>,
    logger: CommandLogger
  ) {
    await interaction.reply("Beep boop beep boop. Checking the message...");
    const messageId = interaction.options.getString("message_id");
    const rag = module.get("rag") as RAGModule;
    const { data: messageData, error } = await rag.db
      .from("documents")
      .select()
      .eq("metadata->>parent_id", messageId)
      .limit(1);
    if (error) throw new Error("failed to fetch message with given id.");
    if (messageData.length < 1) {
      return await interaction.editReply(
        `<@${interaction.user.id}> No message found.`
      );
    }
    return await interaction.editReply(
      `<@${interaction.user.id}> Message found!
# Data:
Message ID: ${messageData[0].metadata.parent_id}
Channel ID: ${messageData[0].metadata.channel_id}
# Preview:
${messageData[0].content}`
    );
  },
};
