import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type CacheType,
} from "discord.js";
import { InteractionContextType } from "discord.js";
import type { RAGModule } from "../../modules/rag";
import type { GuildData, Module, ChatData } from "../types/discord";
import { KnowledgeBaseModule } from "../../modules/knowledge-completion";
import {
  CacheModule,
  CHAT_DATA_PREFIX,
  ROLES_PREFIX,
} from "../../modules/cache";
import { GUILD_DATA_PREFIX } from "../../modules/cache";
import type { CommandLogger } from "../types/command";
import type { DocumentInterface, Document } from "@langchain/core/documents";
import type { MessageContent } from "@langchain/core/messages";

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
    const kbModule = module.get("kb") as KnowledgeBaseModule;
    const rag = module.get("rag") as RAGModule;
    const cache = module.get("cache") as CacheModule;

    const guildData = await this.getGuildData(interaction.guildId!, cache, rag);
    if (!guildData) {
      return await interaction.editReply(
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
        cache,
        logger
      );
    }
    return await this.sendToExistingChat(
      interaction,
      chatData,
      question,
      kbModule,
      cache,
      logger
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
        throw new Error("failed to parse guild cached data.");
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
    const cacheKey = `${CHAT_DATA_PREFIX}${guildId}:${memberId}`;
    const cacheChatData = await cache.get(cacheKey);
    if (cacheChatData) {
      try {
        return JSON.parse(cacheChatData) as ChatData;
      } catch (error) {
        throw new Error("failed to parse cached chat data.");
      }
    }
    const { data: chatsData, error: chatsError } = await rag.db
      .from("chats")
      .select()
      .match({
        guild_id: guildId,
        member_id: memberId,
      })
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
    cache: CacheModule,
    logger: CommandLogger
  ): Promise<void> {
    try {
      const moderatorCachedData = await cache.get(
        `${ROLES_PREFIX}${interaction.guildId}`
      );
      let moderatorData: string[];
      if (!moderatorCachedData) {
        const { data, error } = await rag.db
          .from("guild_moderators")
          .select()
          .match({
            guild_id: interaction.guildId,
          });
        if (error) throw new Error("Failed to get guild moderators data.");
        moderatorData =
          data && data.length > 0
            ? data.map((row) => {
                return row.role_id;
              })
            : [];
        if (moderatorData.length > 0) {
          await cache.set(
            `${ROLES_PREFIX}${interaction.guildId}`,
            moderatorData.join(",")
          );
        }
      } else {
        moderatorData = moderatorCachedData.split(",");
      }

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
          ...(moderatorData
            ? moderatorData.map((id) => {
                return {
                  id,
                  allow: [PermissionFlagsBits.ViewChannel],
                };
              })
            : []),
        ],
      });
      if (!textChannel) {
        logger.error("unable to create a new text channel");
        throw new Error("Unable to create a new text channel.");
      }
      const retrievedData = await kbModule.retrieve({
        question: question,
      });
      const result = await kbModule.generate({
        context: retrievedData?.context || [],
        question,
        answer: "",
      });
      await interaction.deleteReply();
      await textChannel.send({
        content: `<@${interaction.user.id}> ${result?.answer}`,
      });
      await rag.db.from("chats").insert({
        guild_id: interaction.guildId,
        member_id: member.id,
        channel_id: textChannel.id,
      });
      await cache.addDocuments(
        retrievedData.context.map(
          (data) => {
            return {
              pageContent: data.pageContent,
              metadata: {},
            };
          },
          {
            keys: retrievedData.context.map((item) => {
              return `document:${item.metadata.id}`;
            }),
          }
        )
      );
      return;
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : "Something went wrong."
      );
      throw error;
    }
  },
  async sendToExistingChat(
    interaction: ChatInputCommandInteraction<CacheType>,
    chatData: ChatData,
    question: string,
    kbModule: KnowledgeBaseModule,
    cache: CacheModule,
    logger: CommandLogger
  ): Promise<any> {
    try {
      const channel = await interaction.client.channels.fetch(
        chatData.channel_id
      );
      if (!channel) throw new Error("Failed to get member's chat channel.");
      if (!channel.isSendable()) throw new Error("Channel is not sendable.");
      let retrievedData: DocumentInterface[];
      let result: { answer: MessageContent } | undefined;
      const cachedVectorData: [[Document, number]] =
        await cache.similaritySearch(question);
      if (cachedVectorData && cachedVectorData.length > 0) {
        result = await kbModule.generate({
          context: cachedVectorData.map((item: [Document, number]) => {
            return item[0];
          }),
          question,
          answer: "",
        });
      } else {
        retrievedData = (
          await kbModule.retrieve({
            question: question,
          })
        ).context;
        result = await kbModule.generate({
          context: retrievedData,
          question,
          answer: "",
        });
        await cache.addDocuments(retrievedData, {
          keys: retrievedData.map((item) => {
            return `document:${item.metadata.id}`;
          }),
        });
      }
      if (interaction.channelId !== chatData.channel_id) {
        await interaction.deleteReply();
        return await channel.send({
          content: `<@${interaction.user.id}> ${result?.answer}`,
        });
      } else {
        return await interaction.editReply({
          content: `<@${interaction.user.id}>  ${result?.answer}`,
        });
      }
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : "Something went wrong."
      );
      throw error;
    }
  },
};
