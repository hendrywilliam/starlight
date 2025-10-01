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
    .setName("addrole")
    .setDescription("Privileged command. Add privileged role for this guild.")
    .addStringOption((option) => {
      option
        .setName("role_id")
        .setDescription("Insert role id.")
        .setRequired(true);
      return option;
    }),
  async execute(
    interaction: ChatInputCommandInteraction<CacheType>,
    module: Map<string, Module>,
    logger: CommandLogger
  ) {
    await interaction.reply("Adding role...");
    const roleId = interaction.options.getString("role_id") as string;

    // Check if role is available in the guild.
    const roles = interaction.guild?.roles.cache.map((role) => role.id) || [];
    if (!roles.includes(roleId)) {
      return await interaction.editReply("Role is not found in this guild.");
    }

    const rag = module.get("rag") as RAGModule;
    const { error } = await rag.db.rpc("create_guild_moderator", {
      guild_id: interaction.guildId,
      role_id: roleId,
    });
    if (error) throw error;
    return await interaction.editReply("Role added.");
  },
};
