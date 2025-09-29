import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  type CacheType,
} from "discord.js";
import type { RAGModule } from "../../modules/ai/rag";
import type { CommandLogger } from "../types/command";
import type { GuildData, Module } from "../types/discord";

export default {
  data: new SlashCommandBuilder()
    .setName("update")
    .setDescription("Update guild information")
    .addStringOption((option) => {
      option
        .setName("category_id")
        .setDescription(
          "Specify a Category Channel ID to host AI chats for every player."
        )
        .setRequired(false);
      return option;
    })
    .addChannelOption((option) => {
      option
        .setName("source")
        .setDescription("Forum as source of truth.")
        .addChannelTypes(ChannelType.GuildForum)
        .setRequired(false);
      return option;
    }),
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>,
    module: Map<string, Module>,
    logger: CommandLogger
  ) {
    await interaction.reply("Beep boop beep boop, processing your command...");
    logger.info(
      `update command executed by: ${interaction.user.tag} in guild: ${interaction.guild?.name}`
    );
    const rag = module.get("rag") as RAGModule;
    const { data, error } = await rag.db
      .from("guilds")
      .select()
      .limit(1)
      .eq("guild_id", interaction.guildId);
    if (error) throw error;
    const guildData: GuildData = data[0];
    if (!guildData) {
      return await interaction.editReply(
        "You have not finished initial setup for this guild. Please use `setup` command first."
      );
    }
    const categoryId = interaction.options.getString("category_id");
    const { error: insertError } = await rag.db
      .from("guilds")
      .update({
        category_id: categoryId,
      })
      .eq("guild_id", interaction.guildId);
    if (insertError) throw error;
    return await interaction.editReply(
      "You have updated this guild information."
    );
  },
};
