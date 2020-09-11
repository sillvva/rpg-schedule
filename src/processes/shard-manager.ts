import { ShardingManager, Role, MessageEmbed, Message, Client, TextChannel, Permissions } from "discord.js";
import { Express } from "express";
import { io } from "./socket";
import aux from "../appaux";

type DiscordProcessesOptions = {
  app: Express;
};

let ready = false;

let guildData: any[] = [];

const manager = new ShardingManager("./app/processes/discord.js", {
  // for ShardingManager options see:
  // https://discord.js.org/#/docs/main/v11/class/ShardingManager
  totalShards: "auto", // 'auto' handles shard count automatically
  token: process.env.TOKEN,
});

// The shardCreate event is emitted when a shard is created.
// You can use it for something like logging shard launches.
const managerConnect = (options: DiscordProcessesOptions, readyCallback: () => {}) => {
  manager.spawn("auto", 0, 30000);

  manager.on("shardCreate", (shard) => {
    aux.log(`Shard ${shard.id} launched`);

    shard.on("message", (message) => {
      if (typeof message === "object") {
        if (message.type === "socket") {
          if (message.room) io().to(message.room).emit(message.name, message.data);
          else if (message.rooms && Array.isArray(message.rooms)) {
            message.rooms.forEach(room => {
              io().to(room).emit(message.name, message.data);
            });
          }
          else io().emit(message.name, message.data);
        }
        if (message.type === "shard") {
          if (message.name === "guilds") {
            const guilds: any[] = message.data;
            aux.log('Adding data to API memory for', guilds.length, 'guild(s)')
            guilds.forEach((guild, i) => {
              const gdi = guildData.findIndex((g) => g.id === guild.id);
              if (gdi >= 0) {
                guildData[gdi] = guild;
              } else {
                guildData.push(guild);
              }
            });
          } else if (message.name === "channelCreate") {
            guildData = guildData.map((g) => {
              if (g.id === message.data.guild) {
                g.channels.push(message.data);
                g.channels.sort((a, b) => {
                  return a.name > b.name ? 1 : -1;
                });
              }
              return g;
            });
          } else if (message.name === "channelUpdate") {
            guildData = guildData.map((g) => {
              if (g.id === message.data.guild) {
                g.channels = g.channels.map((c) => {
                  if (c.id === message.data.id) {
                    c = message.data;
                  }
                  return c;
                });
              }
              return g;
            });
          } else if (message.name === "channelDelete") {
            guildData = guildData.map((g) => {
              const index = g.channels.findIndex((c) => c.id === message.data);
              if (index >= 0) {
                g.channels.splice(index, 1);
              }
              return g;
            });
          } else if (message.name === "roleCreate") {
            guildData = guildData.map((g) => {
              if (g.id !== message.data.guild) return g;
              g.roles.push(message.data);
              g.roles.sort((a, b) => {
                return a.name > b.name ? 1 : -1;
              });
              return g;
            });
          } else if (message.name === "roleUpdate") {
            guildData = guildData.map((g) => {
              if (g.id !== message.data.guild) return g;
              g.roles = g.roles.map((c) => {
                if (c.id === message.data.id) c = message.data;
                return c;
              });
              g.roles.sort((a, b) => {
                return a.name > b.name ? 1 : -1;
              });
              return g;
            });
          } else if (message.name === "roleDelete") {
            guildData = guildData.map((g) => {
              const index = g.roles.findIndex((c) => c.id === message.data);
              if (index >= 0) g.roles.splice(index, 1);
              return g;
            });
          } else if (message.name === "guildMemberAdd") {
            guildData = guildData.map((g) => {
              if (g.id !== message.data.guildID) return g;
              g.members.push(message.data);
              g.users.push(message.user);
              g.memberRoles.push(message.roles);
              return g;
            });
          } else if (message.name === "guildMemberUpdate") {
            guildData = guildData.map((g) => {
              if (g.id !== message.data.guildID) return g;
              g.members = g.members.map((c, i) => {
                if (c.userID === message.data.userID) {
                  g.memberRoles[i] = message.roles;
                  c = message.data;
                }
                return c;
              });
              return g;
            });
          } else if (message.name === "guildMemberRemove") {
            guildData = guildData.map((g) => {
              if (g.id !== message.data.guildID) return g;
              const index = g.members.findIndex((c) => c.userID === message.data.userID);
              if (index < 0) return g;
              g.members.splice(index, 1);
              g.memberRoles.splice(index, 1);
              g.users.splice(index, 1);
              return g;
            });
          } else if (message.name === "userUpdate") {
            guildData = guildData.map((g) => {
              const index = g.users.findIndex((c) => c.id === message.data.id);
              if (index < 0) return g;
              g.users = g.users.map((c) => {
                if (c.id === message.data.id) c = message.data;
                return c;
              });
              return g;
            });
          } else if (message.name === "guildUpdate") {
            guildData = guildData.map((g) => {
              if (g.id !== message.data.id) return g;
              g.name = message.data.name;
              return g;
            });
          } else if (message.name === "guildDelete") {
            const index = guildData.findIndex((g) => g.id === message.data);
            if (index >= 0) {
              guildData.splice(index, 1);
            }
          }
        }
        if (message.type === "refresh") {
          if (message.guildId) {
            refreshGuild(message.guildId);
          }
          else {
            manager.broadcastEval(`
              const guilds = this.guilds.cache.array();
              console.log("Force refreshing data for ", guilds.length, "guilds");
              this.shard.send({
                type: "shard",
                name: "guilds",
                data: guilds.map((guild) => {
                  return {
                    id: guild.id,
                    name: guild.name,
                    icon: guild.icon,
                    shardID: guild.shardID,
                    ownerID: guild.ownerID,
                    members: guild.members.cache.array(),
                    users: guild.members.cache.map((m) => ({
                      id: m.user.id,
                      username: m.user.username,
                      tag: m.user.tag,
                      discriminator: m.user.discriminator,
                      avatar: m.user.avatar,
                    })),
                    memberRoles: guild.members.cache.map((m) =>
                      m.roles.cache.map((r) => ({
                        id: r.id,
                        name: r.name,
                        permissions: r.permissions,
                      }))
                    ),
                    channels: guild.channels.cache.array().map((c) => ({
                      id: c.id,
                      type: c.type,
                      name: c.name,
                      guild: c.guild.id,
                      parentID: c.parentID,
                      members: [], // c.members.map((m) => m.user.id),
                      everyone: c.permissionsFor(c.guild.roles.cache.find((r) => r.name === "@everyone").id).has(Permissions.FLAGS.VIEW_CHANNEL),
                      botPermissions: [
                        c.permissionsFor(client.user.id).has(Permissions.FLAGS.VIEW_CHANNEL) && "VIEW_CHANNEL",
                        c.permissionsFor(client.user.id).has(Permissions.FLAGS.READ_MESSAGE_HISTORY) && "READ_MESSAGE_HISTORY",
                        c.permissionsFor(client.user.id).has(Permissions.FLAGS.SEND_MESSAGES) && "SEND_MESSAGES",
                        c.permissionsFor(client.user.id).has(Permissions.FLAGS.MANAGE_MESSAGES) && "MANAGE_MESSAGES",
                        c.permissionsFor(client.user.id).has(Permissions.FLAGS.EMBED_LINKS) && "EMBED_LINKS",
                        c.permissionsFor(client.user.id).has(Permissions.FLAGS.ADD_REACTIONS) && "ADD_REACTIONS",
                      ].filter((check) => check)
                    })),
                    roles: guild.roles.cache.array(),
                  };
                }),
              });
            `);
          }
        }
      }
    });

    if (!ready) {
      ready = true;
      readyCallback();
    }
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
  parentID: string;
  members: string[];
  everyone: boolean;
  messages: {
    fetch: (messageId: string) => Promise<Message>;
  };
  send: (content?: any, options?: any) => any;
  permissionsFor: (id: string, permission: number) => Promise<boolean>;
  botPermissions: string[];
}

export interface ShardGuild {
  id: string;
  name: string;
  icon: string;
  members: ShardMember[];
  channels: ShardChannel[];
  roles: Role[];
  shardID: number;
  refresh: () => void;
}

const clientGuilds = async (client: Client, guildIds: string[] = []) => {
  try {
    const guilds = client.guilds.cache.array().filter((g) => (guildIds.length > 0 ? guildIds.includes(g.id) : true));
    const shards = [guilds];
    const result = shards.reduce<ShardGuild[]>((iter, shard) => {
      const append = shard.map((guild) => {
        const sGuild: ShardGuild = {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          shardID: guild.shardID,
          members: guild.members.cache.array().map((member) => {
            const user = member.user;
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
              roles: member.roles.cache.array(),
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
          channels: guild.channels.cache.array().map((channel) => {
            const sChannel: ShardChannel = {
              id: channel.id,
              name: channel.name,
              type: channel.type,
              parentID: channel.parentID,
              members: [], // channel.members.map((m) => m.user.id),
              everyone: channel.permissionsFor(guild.roles.cache.find((r) => r.name === "@everyone").id).has(Permissions.FLAGS.VIEW_CHANNEL),
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
              botPermissions: [
                channel.permissionsFor(client.user.id).has(Permissions.FLAGS.VIEW_CHANNEL) && "VIEW_CHANNEL",
                channel.permissionsFor(client.user.id).has(Permissions.FLAGS.READ_MESSAGE_HISTORY) && "READ_MESSAGE_HISTORY",
                channel.permissionsFor(client.user.id).has(Permissions.FLAGS.SEND_MESSAGES) && "SEND_MESSAGES",
                channel.permissionsFor(client.user.id).has(Permissions.FLAGS.MANAGE_MESSAGES) && "MANAGE_MESSAGES",
                channel.permissionsFor(client.user.id).has(Permissions.FLAGS.EMBED_LINKS) && "EMBED_LINKS",
                channel.permissionsFor(client.user.id).has(Permissions.FLAGS.ADD_REACTIONS) && "ADD_REACTIONS",
              ].filter((check) => check)
            };
            return sChannel;
          }),
          roles: guild.roles.cache.array(),
          refresh: () => {},
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

interface ShardFilters {
  guildIds?: string[];
  memberIds?: string[];
  guild?: any;
}

const shardGuilds = async (filters: ShardFilters = {}) => {
  const guildIds = filters.guildIds || [];
  const memberIds = filters.memberIds || [];
  const sGuild = filters.guild;

  try {
    let shards = [
      guildData
        .filter((guild) => guildIds.length === 0 || guildIds.includes(guild.id))
        .filter((guild) => {
          return guild.members.find((member) => memberIds.length === 0 || memberIds.includes(member.userID));
        }),
    ];
    if (sGuild) shards = [ [ sGuild ] ];
    const result = shards.reduce<ShardGuild[]>((iter, shard, shardIndex) => {
      return [
        ...iter,
        ...shard
          .map((guild) => {
            const sGuild: ShardGuild = {
              id: guild.id,
              name: guild.name,
              icon: guild.icon,
              shardID: guild.shardID,
              members: guild.members.map((member, memberIndex) => {
                const user = guild.users.find((u) => u.id === member.userID) || {};
                return {
                  id: member.userID,
                  nickname: member.displayName,
                  user: {
                    id: user.id,
                    username: user.username,
                    tag: user.tag,
                    discriminator: user.discriminator,
                    avatar: user.avatar,
                    avatarUrl: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`,
                    toString: () => `<@${user.id}>`,
                  },
                  roles: guild.memberRoles[memberIndex],
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
              channels: guild.channels.map((channel) => {
                const sChannel: ShardChannel = {
                  id: channel.id,
                  name: channel.name,
                  type: channel.type,
                  parentID: channel.parentID,
                  members: [], // channel.members,
                  everyone: channel.everyone,
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
                      const callResult = await discordClient().broadcastEval(call);
                      const result = callResult.reduce((acc, val) => {
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
                        if (acc) return acc;
                        else return null;
                      }, null);
                      return result;
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
                    const callResult = await discordClient().broadcastEval(call);
                    const result = callResult.reduce((acc, val) => {
                      return acc || !!val;
                    }, false);
                    return result;
                  },
                  botPermissions: channel.botPermissions
                };
                return sChannel;
              }),
              roles: guild.roles,
              refresh: async function () {
                await refreshGuild(guild.id);
              },
            };
            return sGuild;
          })
          .filter((g) => g),
      ];
    }, []);
    return result;
  } catch (err) {
    console.log("ShardGuildsError:", err);
    return [];
  }
};

const refreshGuild = async function (guildId: string) {
  
  const call = `
    (async () => {
      const guild = this.guilds.cache.get(${JSON.stringify(guildId)});
      if (!guild) return;
      const sGuild = {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        shardID: guild.shardID,
        ownerID: guild.ownerID,
        members: guild.members.cache.array(),
        users: guild.members.cache.map((m) => ({
          id: m.user.id,
          username: m.user.username,
          tag: m.user.tag,
          discriminator: m.user.discriminator,
          avatar: m.user.avatar,
        })),
        memberRoles: guild.members.cache.map((m) =>
          m.roles.cache.map((r) => ({
            id: r.id,
            name: r.name,
            permissions: r.permissions,
          }))
        ),
        channels: guild.channels.cache.array().map((c) => ({
          id: c.id,
          type: c.type,
          name: c.name,
          guild: c.guild.id,
          parentID: c.parentID,
          members: [], // c.members.map((m) => m.user.id),
          everyone: c.permissionsFor(c.guild.roles.cache.find((r) => r.name === "@everyone").id).has(Permissions.FLAGS.VIEW_CHANNEL),
          botPermissions: [
            c.permissionsFor(this.user.id).has(Permissions.FLAGS.VIEW_CHANNEL) && "VIEW_CHANNEL",
            c.permissionsFor(this.user.id).has(Permissions.FLAGS.READ_MESSAGE_HISTORY) && "READ_MESSAGE_HISTORY",
            c.permissionsFor(this.user.id).has(Permissions.FLAGS.SEND_MESSAGES) && "SEND_MESSAGES",
            c.permissionsFor(this.user.id).has(Permissions.FLAGS.MANAGE_MESSAGES) && "MANAGE_MESSAGES",
            c.permissionsFor(this.user.id).has(Permissions.FLAGS.EMBED_LINKS) && "EMBED_LINKS",
            c.permissionsFor(this.user.id).has(Permissions.FLAGS.ADD_REACTIONS) && "ADD_REACTIONS",
          ].filter((check) => check)
        })),
        roles: guild.roles.cache.array(),
      };
      await this.shard.send({
        type: "shard",
        name: "guilds",
        data: [sGuild]
      });
      return sGuild;
    })();
  `;
  const guildData = (await discordClient().broadcastEval(call)).find(s => s);
  return shardGuilds({ guild: guildData });
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

const findMessage = async (client: Client, guildId: string, channelId: string, messageId: string, author: ShardMember, timestamp: number) => {
  try {
    if (client) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        const channel = <TextChannel>guild.channels.cache.get(channelId);
        if (channel) {
          let message = await channel.messages.fetch(messageId);
          if (message) return message;
          message = channel.messages.cache.find(m => m.id === messageId || !!m.embeds.find(e => e.timestamp === timestamp && (e.author.name === author.user.tag || e.author.name === author.user.username || e.author.name === author.nickname)));
          if (message) return message;
          const messages = await channel.messages.fetch({ limit: 100 });
          message = messages.find(m => m.id === messageId || !!m.embeds.find(e => e.timestamp === timestamp && (e.author.name === author.user.tag || e.author.name === author.user.username || e.author.name === author.nickname)));
          if (message) return message;
        }
      }
    }
    else {
      const qString = `
        (async () => {
          const guild = this.guilds.cache.get(${JSON.stringify(guildId)});
          if (guild) {
            const channel = guild.channels.cache.get(${JSON.stringify(channelId)});
            if (channel) {
              let message = await channel.messages.fetch("${messageId}");
              if (message) return message;
              message = channel.messages.cache.find(m => m.id === "${messageId}" || !!m.embeds.find(e => e.timestamp === ${timestamp} && (e.author.name === "${author.user.tag}" || e.author.name === "${author.user.username}" || e.author.name === "${author.nickname}")));
              if (message) return message;
              const messages = await channel.messages.fetch({ limit: 100 });
              message = messages.find(m => m.id === "${messageId}" || !!m.embeds.find(e => e.timestamp === ${timestamp} && (e.author.name === "${author.user.tag}" || e.author.name === "${author.user.username}" || e.author.name === "${author.nickname}")));
              if (message) return message;
            }
          }
          return null;
        })();
      `;
      return <Message>(await discordClient().broadcastEval(qString)).find((m) => m);
    }
    return null;
  }
  catch(err) {
    aux.log(err);
    return null;
  }
};

export default {
  processes: managerConnect,
  shardGuilds: shardGuilds,
  clientGuilds: clientGuilds,
  shardUser: shardUser,
  shardMessageReact: shardMessageReact,
  shardMessageEdit: shardMessageEdit,
  clientMessageEdit: clientMessageEdit,
  refreshGuild: refreshGuild,
  findMessage: findMessage
};

export function discordClient() {
  return manager;
}
