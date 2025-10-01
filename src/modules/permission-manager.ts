import { GuildMember } from "discord.js";
import type { Module } from "../discord/types/discord";

type PermissionConfig = {
  allowedChannels: string[];
  ownerCommands: string[];
  privilegedCommands: string[];
};

export class PermissionManagerModule implements Module {
  public config: PermissionConfig;

  constructor(config: PermissionConfig) {
    this.config = config;
  }

  public hasPermission(
    member: GuildMember | null,
    commandName: string,
    privilegedRoleIds: string[],
    ownerId: string
  ) {
    if (!member) return false;
    // Only owner can use setup, update commands.
    if (this.config.ownerCommands.includes(commandName.toLowerCase())) {
      return this.isOwner(ownerId, member.id);
    }
    // Only moderator/privileged roles can execute privileged commands.
    if (this.isPrivilegedCommand(commandName)) {
      const memberRoleIds = member.roles.cache.map((role) => role.id);
      return this.isPrivilegedRole(memberRoleIds, privilegedRoleIds);
    }
    // Command is a public command.
    return true;
  }

  public isPrivilegedRole(
    roleIds: string[],
    privilegedRoles: string[]
  ): boolean {
    return privilegedRoles.some((role) => roleIds.includes(role));
  }

  /**
   * Check whether a command is a privileged one.
   * @param {string} commandName
   * @returns {boolean}
   */
  public isPrivilegedCommand(commandName: string): boolean {
    return this.config.privilegedCommands.some(
      (cmd) => cmd.toLowerCase() === commandName.toLowerCase()
    );
  }

  /**
   * Check if we are allowed to listen to this channel.
   * e.g. Forum channel when a new thread created, or changed.
   * @param {string|undefined} channelId
   */
  public isAllowedChannel(channelId: string | undefined) {
    if (!channelId) return false;
    return this.config.allowedChannels.some(
      (_channel) => _channel === channelId
    );
  }

  /**
   * Check whether member is the guild owner.
   * @param ownerId
   * @param memberId
   * @returns {boolean}
   */
  public isOwner(ownerId: string, memberId: string): boolean {
    return ownerId === memberId;
  }

  public execute(): void {
    return;
  }
}
