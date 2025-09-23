import {
  ChatInputCommandInteraction,
  GuildMember,
  Message,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type CacheType,
} from "discord.js";
import { InteractionContextType } from "discord.js";
import type { RAGModule } from "../../modules/ai/rag";
import type { GuildData, Module, ChatData } from "../types/discord";
import { KnowledgeBaseModule } from "../../modules/ai/knowledge-completion";
import { CacheModule, CHAT_DATA_PREFIX } from "../../modules/cache";
import { GUILD_DATA_PREFIX } from "../../modules/cache";
import type { CommandLogger } from "../types/command";
import { createHash } from "node:crypto";

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
    module: Map<string, Module>,
    logger: CommandLogger
  ) {
    await interaction.reply("Beep boop beep boop, let me think...");
    const question = interaction.options.getString("question") as string;
    const member = interaction.member as GuildMember;
    logger.info(`${member.displayName}:${member.id} used ask command.`);
    const kbModule = module.get("kb") as KnowledgeBaseModule;
    const rag = module.get("rag") as RAGModule;
    const cache = module.get("cache") as CacheModule;

    const guildData = await this.getGuildData(interaction.guildId!, cache, rag);
    if (!guildData) {
      return await interaction.reply(
        "This guild has not finished initial setup. Please use `/setup` first."
      );
    }
    const chatData = await this.getChatData(
      guildData.guild_id,
      member.id,
      rag,
      cache
    );
    if (!chatData) {
      return await this.createNewChat(
        interaction,
        guildData,
        member,
        question,
        kbModule,
        rag,
        cache
      );
    }
    return await this.sendToExistingChat(
      interaction,
      chatData,
      question,
      kbModule,
      cache
    );
  },
  async getGuildData(
    guildId: string,
    cache: CacheModule,
    rag: RAGModule
  ): Promise<GuildData | null> {
    const cacheKey = `${GUILD_DATA_PREFIX}${guildId}`;
    const cacheGuildData = await cache.get(cacheKey);
    if (cacheGuildData) {
      try {
        return JSON.parse(cacheGuildData) as GuildData;
      } catch (error) {
        throw error;
      }
    }
    const { data, error } = await rag.db
      .from("guilds")
      .select()
      .eq("guild_id", guildId)
      .limit(1);
    if (error) throw error;
    const guildData = data[0] as GuildData;
    if (guildData) {
      await cache.set(cacheKey, JSON.stringify(guildData), {});
    }
    return guildData;
  },
  async getChatData(
    guildId: string,
    memberId: string,
    rag: RAGModule,
    cache: CacheModule
  ): Promise<ChatData | null> {
    const cacheKey = `${CHAT_DATA_PREFIX}${memberId}`;
    const cacheChatData = await cache.get(cacheKey);
    if (cacheChatData) {
      try {
        return JSON.parse(cacheChatData) as ChatData;
      } catch (error) {
        throw error;
      }
    }
    const { data: chatsData, error: chatsError } = await rag.db
      .from("chats")
      .select()
      .eq("guild_id", guildId)
      .eq("member_id", memberId)
      .limit(1);
    if (chatsError) {
      throw chatsError;
    }
    if (chatsData[0]) {
      await cache.set(cacheKey, JSON.stringify(chatsData[0]), {});
    }
    return (chatsData[0] as ChatData) || null;
  },
  async createNewChat(
    interaction: ChatInputCommandInteraction<CacheType>,
    guildData: GuildData,
    member: GuildMember,
    question: string,
    kbModule: KnowledgeBaseModule,
    rag: RAGModule,
    cache: CacheModule
  ): Promise<void> {
    const textChannel = await interaction.guild?.channels.create({
      name: `chat-${interaction.user.displayName}`,
      parent: guildData.category_id,
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
    if (!textChannel) {
      throw new Error("Unable to create a new text channel.");
    }
    const retrieveData = await kbModule.retrieve({
      question: question,
    });
    const result = await kbModule.generate({
      context: retrieveData.context,
      question,
      answer: "",
    });
    await textChannel.send({
      content: `<@${interaction.user.id}> ${result?.answer}`,
    });
    const { error: newChatError } = await rag.db.from("chats").insert({
      guild_id: interaction.guildId,
      member_id: member.id,
      channel_id: textChannel.id,
    });
    // await cache.hSet(`vector-query:${}`)
    if (newChatError) {
      throw newChatError;
    }
  },
  async sendToExistingChat(
    interaction: ChatInputCommandInteraction<CacheType>,
    chatData: ChatData,
    question: string,
    kbModule: KnowledgeBaseModule,
    cache: CacheModule
  ): Promise<void> {
    const channel = await interaction.guild?.channels.fetch(
      chatData.channel_id
    );
    if (!channel) throw new Error("Failed to get member's chat channel.");
    if (!channel.isSendable()) {
      throw new Error("Channel is not sendable.");
    }
    // const result = await kbModule.execute(question);
    const retrievedData = await kbModule.retrieve({
      question: question,
    });
    console.log(retrievedData);
    const result = await kbModule.generate({
      context: retrievedData.context,
      question,
      answer: "",
    });
    // Send first.
    if (interaction.channelId !== chatData.channel_id) {
      await interaction.deleteReply();
      await channel.send({
        content: `<@${interaction.user.id}> ${result?.answer}`,
      });
    } else {
      await interaction.editReply({
        content: `<@${interaction.user.id}> ${result?.answer}`,
      });
    }
    // Cache

    return;
  },
  async generateVectorCacheKey(question: string, context: string) {
    const hash = createHash("sha256")
      .update(`${question}:${context}`)
      .digest("hex");
    return;
  },
};
