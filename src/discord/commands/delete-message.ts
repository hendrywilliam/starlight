import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  type CacheType,
} from "discord.js";
import type { Module } from "../types/discord";
import type { CommandLogger } from "../types/command";
import type { RAGModule } from "../../modules/rag";

export default {
  data: new SlashCommandBuilder()
    .setName("delete")
    .setDescription("Delete a message and purge all the contents.")
    .addStringOption((option) => {
      option.setName("message_id").setDescription("Message ID to delete.");
      return option;
    }),
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>,
    module: Map<string, Module>,
    logger: CommandLogger
  ) {
    await interaction.reply("Beep boop beep boop. Processing your command...");
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
    const deleteButton = new ButtonBuilder()
      .setCustomId("delete")
      .setLabel("Delete")
      .setStyle(ButtonStyle.Danger);
    const cancelButton = new ButtonBuilder()
      .setCustomId("cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(
      cancelButton,
      deleteButton
    );
    await interaction.editReply(`<@${interaction.user.id}> Message found!
# Data:
Message ID: ${messageData[0].metadata.parent_id}
Channel ID: ${messageData[0].metadata.channel_id}
# Preview:
${messageData[0].content}
`);
    const confirmation = await interaction.followUp({
      content: "**Are you sure want to delete this message?**",
      // @ts-expect-error - Type mismatch but it works.
      components: [row],
    });
    try {
      const confirmationResponse = await confirmation.awaitMessageComponent({
        filter: (entry) => {
          return entry.user.id === interaction.user.id;
        },
        time: 15_000, // 15 seconds
      });
      if (confirmationResponse.customId === "delete") {
        const deleteResponse = await rag.db
          .from("documents")
          .delete()
          .eq("metadata->>parent_id", messageId);
        if (deleteResponse.status === 204) {
          await confirmation.edit({
            content: `<@${interaction.user.id}> Message deleted succesfully.`,
            components: [],
          });
        } else {
          await confirmation.edit({
            content: `<@${interaction.user.id}> Failed to delete message.`,
            components: [],
          });
        }
      } else {
        await confirmation.edit({
          content: `<@${interaction.user.id}> Action canceled.`,
          components: [],
        });
      }
    } catch (error) {
      await confirmation.edit({
        content: `<@${interaction.user.id}> No action taken, command canceled.`,
        components: [],
      });
    }
    return await interaction.deleteReply();
  },
};
