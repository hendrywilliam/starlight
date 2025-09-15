import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type CacheType,
} from "discord.js";
import { InteractionContextType } from "discord.js";
import type { RAGModule } from "../../modules/ai/rag";
import type { GuildData, Module, ChatData } from "../types/discord";
import { KnowledgeBaseModule } from "../../modules/ai/knowledge-completion";

export default {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask me a question.")
    .addStringOption((option) => {
      option
        .setName("question")
        .setDescription("Please insert your question.")
        .setRequired(true);
      return option;
    })
    .setContexts(InteractionContextType.Guild),
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>,
    module: Map<string, Module>
  ) {
    await interaction.reply("Beep boop beep boop, let me think...");
    const question = interaction.options.getString("question") as string;
    const kbModule = module.get("kb") as KnowledgeBaseModule;
    const rag = module.get("rag") as RAGModule;
    const member = interaction.member as GuildMember;
    const { data, error } = await rag.db
      .from("guilds")
      .select()
      .eq("guild_id", interaction.guildId)
      .limit(1);
    if (error) throw error;
    const guildData: GuildData = data[0];
    if (!guildData) {
      throw new Error(
        "You have not finished initial setup. Please use `setup` first."
      );
    }
    const categoryId = guildData.category_id;
    const { data: chatsData, error: chatsError } = await rag.db
      .from("chats")
      .select()
      .eq("guild_id", interaction.guildId)
      .eq("member_id", member.id);
    if (chatsError) throw chatsError;
    const chatData: ChatData = chatsData[0];
    if (!chatData) {
      const textChannel = await interaction.guild?.channels.create({
        name: `chat-${interaction.user.displayName}`,
        parent: categoryId,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.client.user.id,
            allow: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });
      if (!textChannel) throw new Error("Unable to create a new text channel.");
      const result = await kbModule.execute(question);
      await textChannel.send({
        content: `<@${interaction.user.id}> ${result}`,
      });
      const { error: newChatError } = await rag.db.from("chats").insert({
        guild_id: interaction.guildId,
        member_id: member.id,
        channel_id: textChannel.id,
      });
      if (newChatError) throw newChatError;
      return;
    }
    const channel = await interaction.guild?.channels.fetch(
      chatData.channel_id
    );
    if (!channel) throw new Error("failed to get member's chat channel.");
    if (!channel.isSendable())
      throw new Error("unable to send a message to the channel.");
    const result = await kbModule.execute(question);

    // Check whether the user executed the command inside his private channel or not.
    if (interaction.channelId !== chatData.channel_id) {
      await interaction.deleteReply();
      return await channel.send({
        content: `<@${interaction.user.id}> ${result}`,
      });
    }
    return await interaction.editReply({
      content: result,
    });
  },
};
