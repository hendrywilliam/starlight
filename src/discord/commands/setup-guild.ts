import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  type CacheType,
} from "discord.js";
import type { GuildData, Module } from "../types/discord";
import type { RAGModule } from "../../modules/rag";
import type { CommandLogger } from "../types/command";

export default {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Setup guild information")
    .addStringOption((option) => {
      option
        .setName("category_id")
        .setDescription(
          "Privileged command. Specify a Category Channel ID to host AI chats for every player."
        )
        .setRequired(true);
      return option;
    }),
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>,
    module: Map<string, Module>,
    logger: CommandLogger
  ) {
    await interaction.reply("Beep boop beep boop, processing your command...");
    logger.info(
      `setup command executed by: ${interaction.user.tag} in guild: ${interaction.guild?.name}`
    );
    const rag = module.get("rag") as RAGModule;
    const { data, error } = await rag.db
      .from("guilds")
      .select()
      .limit(1)
      .eq("guild_id", interaction.guildId);
    if (error) throw error;
    const guildData: GuildData = data.length > 0 ? data[0] : undefined;
    if (!guildData) {
      const categoryId = interaction.options.getString("category_id");
      const categoryChan = await interaction.client.channels.fetch(
        categoryId as string
      );
      if (categoryChan && categoryChan.type === ChannelType.GuildCategory) {
        const { error } = await rag.db.rpc("create_guild_data", {
          guild_id: interaction.guildId,
          category_id: categoryId,
        });
        if (error) throw error;
        return await interaction.editReply(
          "You have finished initial setup for this guild."
        );
      } else {
        return await interaction.editReply(
          "You have selected a wrong type of channel. **Expected:** `Category` channel."
        );
      }
    }
    return await interaction.editReply(
      "You have finished initial setup for this guild. **Please use `update` command to update the guild information.**"
    );
  },
};
