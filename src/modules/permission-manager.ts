import { GuildMember, type APIInteractionGuildMember } from "discord.js";
import type { Module } from "../discord/types/discord";

type PermissionConfig = {
  privilegedRoles: string[];
  privilegedCommands: string[];
};

export class PermissionManager implements Module {
  public config: PermissionConfig;

  constructor(config: PermissionConfig) {
    this.config = config;
  }

  public hasPermission(member: GuildMember | null, commandName: string) {
    if (!member) return false;
    const memberRoles = member.roles.cache.map((role) => role.id);
    if (this.config.privilegedCommands.includes(commandName)) {
      return this.isPrivilegedRole(memberRoles);
    }
    // Command is a public command.
    return true;
  }

  public isPrivilegedRole(roles: string[]) {
    return this.config.privilegedRoles.some((role) => roles.includes(role));
  }

  public execute(): void {
    return;
  }
}
