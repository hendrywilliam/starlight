import {
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
  type CacheType,
} from "discord.js";
import type { DocumentChunkMetadata, Module } from "../types/discord";
import type { RAGModule } from "../../modules/ai/rag";
import type { PermissionManager } from "../../modules/permission-manager";

export default {
  data: new SlashCommandBuilder()
    .setName("fetch")
    .setDescription("Fetch a thread and feed it to database.")
    .addChannelOption((option) => {
      option
        .setName("thread")
        .setDescription("Thread/message as source of truth.")
        .addChannelTypes(ChannelType.PublicThread)
        .addChannelTypes(ChannelType.PrivateThread)
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true);
      return option;
    }),
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>,
    module: Map<string, Module>
  ) {
    await interaction.reply("Beep boop beep boop. Fetching selected thread...");
    const channel = interaction.options.getChannel("thread");
    if (!channel) {
      throw new Error("Failed to get channel data.");
    }
    const actualChannel = await interaction.client.channels.fetch(channel.id);
    if (!actualChannel) {
      throw new Error("Failed to get channel data.");
    }
    if (!actualChannel.isThread()) {
      throw new Error(
        "You have selected the wrong type of channel. Fetch only accept a thread."
      );
    }
    const channelId = actualChannel.parentId as string;
    const permissionManager = module.get("permission") as
      | PermissionManager
      | undefined;
    if (!permissionManager) {
      throw new Error("Something went wrong.");
    }
    const allowed = permissionManager.hasPermission(
      interaction.member as GuildMember,
      interaction.commandName
    );
    if (!allowed) {
      throw new Error("You are not allowed to use this command.");
    }
    const messages = await actualChannel.messages.fetch();
    // NOTE: Latest message is first message.
    const message = messages.last();
    if (!message) {
      throw new Error("Failed to get first message from selected thread.");
    }
    const ragModule = module.get("rag") as RAGModule | undefined;
    if (!ragModule) {
      throw new Error("Failed to get dependency module.");
    }
    const contents = await ragModule.splitText(message.content);
    const rows = await Promise.all(
      contents.map(async (item, index) => {
        const vectorFromQuery = await ragModule.embedQuery(item);
        return {
          content: item,
          metadata: {
            id: `${message.id}_chunk_${index}`,
            parent_id: message.id,
            channel_id: channelId,
          } satisfies DocumentChunkMetadata,
          embedding: vectorFromQuery,
        };
      })
    );
    // Get attachments.
    for (const attachment of message.attachments.values()) {
      const mimeType = attachment.contentType?.split(";")[0];
      if (mimeType === "text/plain") {
        try {
          const response = await fetch(attachment.url, {
            method: "GET",
          });
          const textContent = await response.text();
          const attachmentContents = await ragModule.splitText(textContent);
          const attachmentRows = await Promise.all(
            attachmentContents.map(async (item, index) => {
              const vectorFromQuery = await ragModule.embedQuery(item);
              return {
                content: item,
                metadata: {
                  channel_id: channelId,
                  id: `${message.id}_chunk_${index}`,
                  parent_id: message.id,
                  is_attachment: true,
                  attachment_id: attachment.id,
                  attachment_name: attachment.name,
                } satisfies DocumentChunkMetadata,
                embedding: vectorFromQuery,
              };
            })
          );
          rows.push(...attachmentRows);
        } catch (error) {
          console.error(
            `Error while processing thread/message attachments ${attachment.id}: `,
            error
          );
        }
      }
      continue;
    }
    await ragModule.db.from("documents").insert(rows);
    await interaction.editReply("Fetch succeded.");
  },
};
