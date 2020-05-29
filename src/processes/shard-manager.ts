import { ShardingManager, Role, MessageEmbed, Message, Client, TextChannel } from "discord.js";
import { Express } from "express";
import { io } from "./socket";

type DiscordProcessesOptions = {
  app: Express;
};

const manager = new ShardingManager("./app/processes/discord.js", {
  // for ShardingManager options see:
  // https://discord.js.org/#/docs/main/v11/class/ShardingManager
  totalShards: "auto", // 'auto' handles shard count automatically
  token: process.env.TOKEN,
});

// The shardCreate event is emitted when a shard is created.
// You can use it for something like logging shard launches.
const managerConnect = (options: DiscordProcessesOptions, readyCallback: () => {}) => {
  manager.spawn();

  manager.on("shardCreate", (shard) => {
    console.log(`Shard ${shard.id} launched`);

    shard.on("message", (message) => {
      if (typeof message === "object") {
        if (message.type === "socket") {
          io().emit(message.name, message.data);
        }
      }
    });

    if (shard.id == 0) readyCallback();
  });

  return manager;
};

export interface ShardUser {
  id: string;
  username: string;
  tag: string;
  discriminator: string;
  avatar: string;
  avatarUrl: string;
  toString: () => string;
}

export interface ShardMember {
  id: string;
  nickname: string;
  user: ShardUser;
  roles: Role[];
  hasPermission: (permission: number) => boolean;
  send: (content?: any, options?: any) => any;
}

export interface ShardChannel {
  id: string;
  name: string;
  type: string;
  messages: {
    fetch: (messageId: string) => Promise<Message>;
  };
  send: (content?: any, options?: any) => any;
  permissionsFor: (id: string, permission: number) => Promise<boolean>;
}

export interface ShardGuild {
  id: string;
  name: string;
  icon: string;
  members: ShardMember[];
  channels: ShardChannel[];
  roles: Role[];
  shardID: number;
}

const clientGuilds = async (client: Client, guildIds: string[] = []) => {
  try {
    const guilds = client.guilds.cache.array().filter((g) => (guildIds.length > 0 ? guildIds.includes(g.id) : true));
    const shards = [guilds];
    const sGuildMembers = [guilds.map((g) => g.members.cache.array())];
    const sGuildUsers = [guilds.map((g) => g.members.cache.array().map((m) => m.user))];
    const sGuildChannels = [guilds.map((g) => g.channels.cache.array())];
    const sGuildRoles = [guilds.map((g) => g.roles.cache.array())];
    const sGuildMemberRoles = [guilds.map((g) => g.members.cache.array().map((m) => m.roles.cache.array()))];
    const result = shards.reduce<ShardGuild[]>((iter, shard, shardIndex) => {
      const append = shard.map((guild, guildIndex) => {
        const sGuild: ShardGuild = {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          shardID: guild.shardID,
          members: sGuildMembers[shardIndex][guildIndex].map((member, memberIndex) => {
            const user = sGuildUsers[shardIndex][guildIndex][memberIndex];
            return {
              id: user.id,
              nickname: member.nickname,
              user: {
                id: user.id,
                username: user.username,
                tag: user.tag,
                discriminator: user.discriminator,
                avatar: user.avatar,
                avatarUrl: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`,
                toString: () => `<@${user.id}>`,
              },
              roles: sGuildMemberRoles[shardIndex][guildIndex][memberIndex],
              isOwner: user.id === guild.ownerID,
              hasPermission: function (permission: number) {
                if (this.isOwner) return true;
                return !!this.roles.some((r) => (r.permissions & permission) > 0);
              },
              send: async function (content?: any, options?: any) {
                const sends = await (async () => {
                  const sGuild = client.guilds.cache.get(guild.id);
                  if (sGuild) {
                    const guildMembers = await guild.members.fetch();
                    const member = guildMembers.get(user.id);
                    if (member) {
                      const message = await member.send(content, options);
                      return [message];
                    }
                  }
                  return [null];
                })();
                return sends.find((s) => s);
              },
            };
          }),
          channels: sGuildChannels[shardIndex][guildIndex].map((channel, channelIndex) => {
            const sChannel: ShardChannel = {
              id: channel.id,
              name: channel.name,
              type: channel.type,
              messages: {
                fetch: async function (messageId: string) {
                  const sGuild = client.guilds.cache.get(guild.id);
                  if (sGuild) {
                    const sChannel = sGuild.channels.cache.get(channel.id);
                    if (sChannel) {
                      return await (<TextChannel>sChannel).messages.fetch(messageId);
                    }
                  }
                  return null;
                },
              },
              send: async function (content?: any, options?: any) {
                const sends = await (async () => {
                  const sGuild = client.guilds.cache.get(guild.id);
                  if (sGuild) {
                    const sChannel = sGuild.channels.cache.get(channel.id);
                    if (sChannel) {
                      return [await (<TextChannel>sChannel).send(content, options)];
                    }
                  }
                  return [null];
                })();
                return sends.find((s) => s);
              },
              permissionsFor: async function (id, permission) {
                const sGuild = client.guilds.cache.get(guild.id);
                if (sGuild) {
                  const sChannel = sGuild.channels.cache.get(channel.id);
                  if (sChannel) {
                    return sChannel.permissionsFor(id).has(permission);
                  }
                }
                return false;
              },
            };
            return sChannel;
          }),
          roles: sGuildRoles[shardIndex][guildIndex],
        };
        return sGuild;
      });
      return [...iter, ...append];
    }, []);
    return result;
  } catch (err) {
    console.log("ClientGuildsError:", err);
    return [];
  }
};

const shardGuilds = async (guildIds: string[] = []) => {
  try {
    const shards = await discordClient().broadcastEval(`this.guilds.cache${guildIds.length > 0 ? `.filter(g => ${JSON.stringify(guildIds)}.includes(g.id))` : ``}`);
    const sGuildMembers = await discordClient().broadcastEval(
      `this.guilds.cache${guildIds.length > 0 ? `.filter(g => ${JSON.stringify(guildIds)}.includes(g.id))` : ``}.map(g => g.members.cache)`
    );
    const sGuildUsers = await discordClient().broadcastEval(
      `this.guilds.cache${guildIds.length > 0 ? `.filter(g => ${JSON.stringify(guildIds)}.includes(g.id))` : ``}.map(g => g.members.cache.map(m => m.user))`
    );
    const sGuildChannels = await discordClient().broadcastEval(
      `this.guilds.cache${guildIds.length > 0 ? `.filter(g => ${JSON.stringify(guildIds)}.includes(g.id))` : ``}.map(g => g.channels.cache)`
    );
    const sGuildRoles = await discordClient().broadcastEval(
      `this.guilds.cache${guildIds.length > 0 ? `.filter(g => ${JSON.stringify(guildIds)}.includes(g.id))` : ``}.map(g => g.roles.cache)`
    );
    const sGuildMemberRoles = await discordClient().broadcastEval(
      `this.guilds.cache${guildIds.length > 0 ? `.filter(g => ${JSON.stringify(guildIds)}.includes(g.id))` : ``}.map(g => g.members.cache.map(m => m.roles.cache))`
    );
    return shards.reduce<ShardGuild[]>((iter, shard, shardIndex) => {
      return [
        ...iter,
        ...shard
          .map((guild, guildIndex) => {
            const sGuild: ShardGuild = {
              id: guild.id,
              name: guild.name,
              icon: guild.icon,
              shardID: guild.shardID,
              members: sGuildMembers[shardIndex][guildIndex].map((member, memberIndex) => {
                const user = sGuildUsers[shardIndex][guildIndex][memberIndex];
                return {
                  id: user.id,
                  nickname: member.nickname,
                  user: {
                    id: user.id,
                    username: user.username,
                    tag: user.tag,
                    discriminator: user.discriminator,
                    avatar: user.avatar,
                    avatarUrl: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`,
                    toString: () => `<@${user.id}>`,
                  },
                  roles: sGuildMemberRoles[shardIndex][guildIndex][memberIndex],
                  isOwner: user.id === guild.ownerID,
                  hasPermission: function (permission: number) {
                    if (this.isOwner) return true;
                    return !!this.roles.some((r) => (r.permissions & permission) > 0);
                  },
                  send: async function (content?: any, options?: any) {
                    if (content instanceof MessageEmbed) content = { embed: content.toJSON() };
                    if (options instanceof MessageEmbed) options = { embed: options.toJSON() };
                    const call = `
                    (async () => {
                      const guild = this.guilds.cache.get(${JSON.stringify(guild.id)});
                      if (guild) {
                        const guildMembers = await guild.members.fetch();
                        const member = guildMembers.get(${JSON.stringify(user.id)});
                        if (member) {
                          return await member.send(${JSON.stringify(content)}, ${JSON.stringify(options)});
                        }
                      }
                      return null;
                    })();
                  `;
                    return (await discordClient().broadcastEval(call)).find((s) => s);
                  },
                };
              }),
              channels: sGuildChannels[shardIndex][guildIndex].map((channel, channelIndex) => {
                const sChannel: ShardChannel = {
                  id: channel.id,
                  name: channel.name,
                  type: channel.type,
                  messages: {
                    fetch: async function (messageId: string) {
                      const call = `
                      (async () => {
                        const guild = this.guilds.cache.get(${JSON.stringify(guild.id)});
                        if (guild) {
                          const channel = guild.channels.cache.get(${JSON.stringify(channel.id)});
                          if (channel) {
                            return await channel.messages.fetch(${JSON.stringify(messageId)});
                          }
                        }
                        return null;
                      })();
                    `;
                      return (await discordClient().broadcastEval(call)).reduce((acc, val) => {
                        if (val) {
                          return {
                            ...val,
                            delete: async () => {
                              const call = `
                              (async () => {
                                const guild = this.guilds.cache.get(${JSON.stringify(guild.id)});
                                if (guild) {
                                  const channel = guild.channels.cache.get(${JSON.stringify(channel.id)});
                                  if (channel) {
                                    const message = await channel.messages.fetch(${JSON.stringify(messageId)});
                                    if (message) message.delete();
                                  }
                                }
                              })();
                            `;
                              await discordClient().broadcastEval(call);
                            },
                          };
                        }
                        return null;
                      }, {});
                    },
                  },
                  send: async function (content?: any, options?: any) {
                    if (content instanceof MessageEmbed) content = { embed: content.toJSON() };
                    if (options instanceof MessageEmbed) options = { embed: options.toJSON() };
                    const call = `
                    (async () => {
                      const guild = this.guilds.cache.get(${JSON.stringify(guild.id)});
                      if (guild) {
                        const channel = guild.channels.cache.get(${JSON.stringify(channel.id)});
                        if (channel) {
                          return await channel.send(${JSON.stringify(content)}, ${JSON.stringify(options)});
                        }
                      }
                      return null;
                    })();
                  `;
                    return (await discordClient().broadcastEval(call)).find((s) => s);
                  },
                  permissionsFor: async function (id, permission) {
                    const call = `
                    (async () => {
                      const guild = this.guilds.cache.get(${JSON.stringify(guild.id)});
                      if (guild) {
                        const channel = guild.channels.cache.get(${JSON.stringify(channel.id)});
                        if (channel) {
                          return channel.permissionsFor(${JSON.stringify(id)}).has(${JSON.stringify(permission)});
                        }
                      }
                      return false;
                    })();
                  `;
                    return (await discordClient().broadcastEval(call)).reduce((acc, val) => {
                      return !!val;
                    }, false);
                  },
                };
                return sChannel;
              }),
              roles: sGuildRoles[shardIndex][guildIndex],
            };
            return sGuild;
          })
          .filter((g) => g),
      ];
    }, []);
  } catch (err) {
    console.log("ShardGuildsError:", err.message);
    return [];
  }
};

const shardUser = async () => {
  const shards = await discordClient().broadcastEval("this.user");
  return shards.find((u) => u);
};

const shardChannelPermissions = async (props: any) => {
  const qString = `this.guilds.cache.find(g => g.channels.cache.find(c => c.id === "${props.channelId}" && c.permissionsFor(${props.for}).has(${props.has})))`;
  const sGuildChannels = await discordClient().broadcastEval(qString);
  return !!sGuildChannels.find((s) => s);
};

const shardMessageReact = async (guildId: string, channelId: string, messageId: string, emoji: string) => {
  const qString = `
    (async () => {
      const guild = this.guilds.cache.get(${JSON.stringify(guildId)});
      if (guild) {
        const channel = guild.channels.cache.get(${JSON.stringify(channelId)});
        if (channel) {
          const message = await channel.messages.fetch(${JSON.stringify(messageId)});
          if (message) {
            message.react("${emoji}");
          }
        }
      }
    })();
  `;
  return await discordClient().broadcastEval(qString);
};

const shardMessageEdit = async (guildId: string, channelId: string, messageId: string, content?: any, options?: any) => {
  if (content instanceof MessageEmbed) content = { embed: content.toJSON() };
  if (options instanceof MessageEmbed) options = { embed: options.toJSON() };
  const qString = `
    (async () => {
      const guild = this.guilds.cache.get(${JSON.stringify(guildId)});
      if (guild) {
        const channel = guild.channels.cache.get(${JSON.stringify(channelId)});
        if (channel) {
          const message = await channel.messages.fetch(${JSON.stringify(messageId)});
          if (message) {
            return message.edit(${JSON.stringify(content)}, ${JSON.stringify(options)});
          }
        }
      }
      return null;
    })();
  `;
  return <Message>(await discordClient().broadcastEval(qString)).find((m) => m);
};

const clientMessageEdit = async (client: Client, guildId: string, channelId: string, messageId: string, content?: any, options?: any) => {
  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    const channel = guild.channels.cache.get(channelId);
    if (channel) {
      const message = await (<TextChannel>channel).messages.fetch(messageId);
      if (message) {
        return message.edit(content, options);
      }
    }
  }
  return null;
};

export default {
  processes: managerConnect,
  shardGuilds: shardGuilds,
  clientGuilds: clientGuilds,
  shardUser: shardUser,
  shardMessageReact: shardMessageReact,
  shardMessageEdit: shardMessageEdit,
  clientMessageEdit: clientMessageEdit,
};

export function discordClient() {
  return manager;
}
