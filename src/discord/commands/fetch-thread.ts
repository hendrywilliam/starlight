import {
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
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
        .setDescription("Thread as source of truth.")
        .addChannelTypes(ChannelType.PublicThread)
        .addChannelTypes(ChannelType.PrivateThread)
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
    const memberRoles = permissionManager.hasPermission(
      interaction.member as GuildMember,
      interaction.commandName
    );
    if (!memberRoles) {
      throw new Error("You are not allowed to use this command.");
    }
    const messages = await actualChannel.messages.fetch();
    // NOTE: Latest message is first message.
    const lastMessage = messages.last();
    if (!lastMessage) {
      throw new Error("Failed to get first message from selected thread.");
    }
    const ragModule = module.get("rag") as RAGModule | undefined;
    if (!ragModule) {
      throw new Error("Failed to get dependency module.");
    }
    const contents = await ragModule.splitText(lastMessage.content);
    const rows = await Promise.all(
      contents.map(async (item, index) => {
        const vectorFromQuery = await ragModule.embedQuery(item);
        return {
          content: item,
          metadata: {
            id: `${lastMessage.id}_chunk_${index}`,
            parent_id: lastMessage.id,
            channel_id: channelId,
          } satisfies DocumentChunkMetadata,
          embedding: vectorFromQuery,
        };
      })
    );
    await ragModule.db.from("documents").insert(rows);
    await interaction.editReply("Fetch succeded.");
  },
};
