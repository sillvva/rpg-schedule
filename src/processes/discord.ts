import { TextChannel, Client, Message, User, GuildChannel, MessageEmbed, Permissions, Guild, DMChannel, NewsChannel } from "discord.js";
import { DeleteWriteOpResultObject, FilterQuery, ObjectId, UpdateWriteOpResult } from "mongodb";

import { GuildConfig, GuildConfigModel, ConfigRole } from "../models/guild-config";
import { Game, GameMethod, gameReminderOptions } from "../models/game";
import { User as RPGSUser } from "../models/user";
import config from "../models/config";
import aux from "../appaux";
import db from "../db";
import shardManager, { ShardMember, ShardGuild } from "./shard-manager";
import cloneDeep from "lodash/cloneDeep";
import flatten from "lodash/flatten";
import moment from "moment";
import { GameRSVP } from "../models/game-signups";
import { isObject } from "lodash";

const app: any = { locals: {} };

app.locals.supportedLanguages = require("../../lang/langs.json");
app.locals.langs = app.locals.supportedLanguages.langs
  .map((lang: String) => {
    return {
      code: lang,
      ...require(`../../lang/${lang}.json`),
    };
  })
  .sort((a: any, b: any) => (a.name > b.name ? 1 : -1));

let client = new Client();
let isReady = false;
let connected = false;
let numSlices = client.shard.count * 2;

client.on("debug", function (info) {
  if (info.indexOf("hit on route") >= 0) return;
  if (info.indexOf("Sending a heartbeat") >= 0) return;
  if (info.indexOf("Heartbeat acknowledged") >= 0) return;
  aux.log(info);
});

/**
 * Discord.JS - ready
 */
client.on("ready", async () => {
  aux.log(`Logged in as ${client.user.username}!`);

  if (!isReady) {
    isReady = true;

    if (process.env.DISCORD_API_LOGIC.toLowerCase() === "true") {
      // Send updated server information to the API
      sendGuildsToAPI(true);
      let i = 0;
      setInterval(async () => {
        numSlices = client.shard.count * 2;
        sendGuildsToAPI(true, i % numSlices);
        i++;
      }, 20 * 60 * 1000);
    }

    if (process.env.DISCORD_LOGIC.toLowerCase() === "true") {
      refreshMessages();

      // Once per hour, prune games from the database that are more than 48 hours old
      pruneOldGames();
      setInterval(() => {
        pruneOldGames();
      }, 60 * 60 * 1000); // 1 hour

      // Once per hour, reschedule recurring games from the database that have already occurred
      rescheduleOldGames();
      setInterval(() => {
        rescheduleOldGames();
      }, 60 * 60 * 1000); // 1 hour

      // Post Game Reminders
      postReminders();
      setInterval(() => {
        postReminders();
      }, 1 * 60 * 1000); // 1 minute
    }
  }
});

if (process.env.DISCORD_API_LOGIC.toLowerCase() === "true") {
  client.on("channelCreate", async (channel: GuildChannel) => {
    if (!channel.guild) return;
    client.shard.send({
      type: "shard",
      name: "channelCreate",
      data: {
        id: channel.id,
        type: channel.type,
        name: channel.name,
        guild: channel.guild.id,
        parentID: channel.parentID,
        members: [], // channel.members.array().map((m) => m.user.id),
        everyone: channel.permissionsFor(channel.guild.roles.cache.find((r) => r.name === "@everyone").id).has(Permissions.FLAGS.VIEW_CHANNEL),
        botPermissions: [
          channel.permissionsFor(client.user.id).has(Permissions.FLAGS.VIEW_CHANNEL) && "VIEW_CHANNEL",
          channel.permissionsFor(client.user.id).has(Permissions.FLAGS.READ_MESSAGE_HISTORY) && "READ_MESSAGE_HISTORY",
          channel.permissionsFor(client.user.id).has(Permissions.FLAGS.SEND_MESSAGES) && "SEND_MESSAGES",
          channel.permissionsFor(client.user.id).has(Permissions.FLAGS.MANAGE_MESSAGES) && "MANAGE_MESSAGES",
          channel.permissionsFor(client.user.id).has(Permissions.FLAGS.EMBED_LINKS) && "EMBED_LINKS",
          channel.permissionsFor(client.user.id).has(Permissions.FLAGS.ADD_REACTIONS) && "ADD_REACTIONS",
        ].filter((check) => check),
      },
    });
  });

  client.on("channelUpdate", async (oldC, channel: GuildChannel) => {
    client.shard.send({
      type: "shard",
      name: "channelUpdate",
      data: {
        id: channel.id,
        type: channel.type,
        name: channel.name,
        guild: channel.guild.id,
        parentID: channel.parentID,
        members: [], // channel.members.map((m) => m.user.id),
        everyone: channel.permissionsFor(channel.guild.roles.cache.find((r) => r.name === "@everyone").id).has(Permissions.FLAGS.VIEW_CHANNEL),
        botPermissions: [
          channel.permissionsFor(client.user.id).has(Permissions.FLAGS.VIEW_CHANNEL) && "VIEW_CHANNEL",
          channel.permissionsFor(client.user.id).has(Permissions.FLAGS.READ_MESSAGE_HISTORY) && "READ_MESSAGE_HISTORY",
          channel.permissionsFor(client.user.id).has(Permissions.FLAGS.SEND_MESSAGES) && "SEND_MESSAGES",
          channel.permissionsFor(client.user.id).has(Permissions.FLAGS.MANAGE_MESSAGES) && "MANAGE_MESSAGES",
          channel.permissionsFor(client.user.id).has(Permissions.FLAGS.EMBED_LINKS) && "EMBED_LINKS",
          channel.permissionsFor(client.user.id).has(Permissions.FLAGS.ADD_REACTIONS) && "ADD_REACTIONS",
        ].filter((check) => check),
      },
    });
  });

  client.on("channelDelete", async (channel: GuildChannel) => {
    client.shard.send({
      type: "shard",
      name: "channelDelete",
      data: channel.id,
    });

    const channelId = channel.id;
    const guildId = channel.guild.id;
    const guildConfig = await GuildConfig.fetch(guildId);
    if (guildConfig.channels.find((c) => c.channelId === channelId)) {
      guildConfig.channel = guildConfig.channel.filter((ch) => ch.channelId !== channelId);
      await guildConfig.save();

      const games = await Game.fetchAllBy(
        {
          s: guildId,
          c: channelId,
        },
        client
      );

      games.forEach(async (game) => {
        await game.delete();
      });
    }
  });

  client.on("roleCreate", async (role) => {
    client.shard.send({
      type: "shard",
      name: "roleCreate",
      data: role,
    });
  });

  client.on("roleUpdate", async (oldR, role) => {
    client.shard.send({
      type: "shard",
      name: "roleUpdate",
      data: role,
    });

    const guildConfig = await GuildConfig.fetch(oldR.guild.id);
    if (isObject(guildConfig.role) ? guildConfig.role.id == oldR.id : guildConfig.role == oldR.name) guildConfig.role = { id: role.id, name: role.name };
    if (isObject(guildConfig.managerRole) ? guildConfig.managerRole.id == oldR.id : guildConfig.managerRole == oldR.name)
      guildConfig.managerRole = { id: role.id, name: role.name };
    guildConfig.gameTemplates = guildConfig.gameTemplates.map((gt) => {
      if (isObject(gt.role) ? gt.role.id === oldR.id : gt.role == oldR.name) gt.role = { id: role.id, name: role.name };
      gt.playerRole = gt.playerRole.map((pr) => {
        if (pr.id === oldR.id || (!pr.id && pr.name === oldR.name)) pr = { id: role.id, name: role.name };
        return pr;
      });
      return gt;
    });
    await guildConfig.save();
  });

  client.on("roleDelete", async (role) => {
    client.shard.send({
      type: "shard",
      name: "roleDelete",
      data: role.id,
    });
  });

  client.on("guildMemberAdd", async (member) => {
    client.shard.send({
      type: "shard",
      name: "guildMemberAdd",
      data: member,
      user: {
        id: member.user.id,
        username: member.user.username,
        tag: member.user.tag,
        discriminator: member.user.discriminator,
        avatar: member.user.avatar,
      },
      roles: member.roles.cache.array().map((r) => ({
        id: r.id,
        name: r.name,
        permissions: r.permissions,
      })),
    });
  });

  client.on("guildMemberUpdate", async (oldR, member) => {
    client.shard.send({
      type: "shard",
      name: "guildMemberUpdate",
      data: member,
      roles: member.roles.cache.array().map((r) => ({
        id: r.id,
        name: r.name,
        permissions: r.permissions,
      })),
    });
  });

  client.on("guildMemberRemove", async (member) => {
    client.shard.send({
      type: "shard",
      name: "guildMemberRemove",
      data: member,
      user: member.user,
    });
  });

  client.on("userUpdate", async (oldUser: User, newUser: User) => {
    client.shard.send({
      type: "shard",
      name: "userUpdate",
      data: {
        id: newUser.id,
        username: newUser.username,
        tag: newUser.tag,
        discriminator: newUser.discriminator,
        avatar: newUser.avatar,
      },
    });

    if (process.env.DISCORD_LOGIC.toLowerCase() === "true" && oldUser.tag != newUser.tag) {
      const rsvps = await GameRSVP.fetchAllByUser(oldUser);
      for (let i = 0; i < rsvps.length; i++) {
        const rsvp = rsvps[i];
        rsvp.id = newUser.id;
        rsvp.tag = newUser.tag;
        await rsvp.save();
      }

      const games = await Game.fetchAllBy(
        {
          $or: [
            { "author.tag": oldUser.tag },
            { "author.id": oldUser.id },
            { "dm.tag": oldUser.tag },
            { "dm.id": oldUser.id },
            { dm: oldUser.tag },
            {
              reserved: {
                $elemMatch: {
                  tag: oldUser.tag,
                },
              },
            },
            {
              reserved: {
                $elemMatch: {
                  id: oldUser.id,
                },
              },
            },
            {
              reserved: {
                $regex: oldUser.tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"),
              },
            },
          ],
        },
        client
      );
      games.forEach(async (game) => {
        if (game.author.tag === oldUser.tag) game.author.tag = newUser.tag;
        if (game.author.tag === oldUser.tag) game.author.id = newUser.id;
        if (game.dm.tag === oldUser.tag) game.dm.tag = newUser.tag;
        if (game.dm.tag === oldUser.tag) game.dm.id = newUser.id;
        if (game.reserved.find((r) => r.tag === oldUser.tag || r.id === oldUser.id)) {
          game.reserved = game.reserved.map((r) => {
            if (r.tag === oldUser.tag) r.tag = newUser.tag;
            if (r.id === oldUser.id) r.id = newUser.id;
            return r;
          });
        }
        game.save();
      });
    }
  });

  client.on("guildUpdate", async (oldG, newG) => {
    client.shard.send({
      type: "shard",
      name: "guildUpdate",
      data: newG,
    });
  });

  client.on("guildDelete", async (guild) => {
    aux.log(`Bot has left ${guild.name}!`);
    client.shard.send({
      type: "shard",
      name: "guildDelete",
      data: guild.id,
    });
  });

  client.on("guildCreate", async (guild) => {
    aux.log(`Bot has joined ${guild.name}!`);
    client.shard.send({
      type: "shard",
      name: "guilds",
      data: [guild].map(guildMap),
    });
  });
}

if (process.env.DISCORD_LOGIC.toLowerCase() === "true") {
  /**
   * Discord.JS - message
   */
  client.on("message", async (message: Message) => {
    try {
      let isCommand = false;
      for (let i = 1; i <= 3; i++) {
        isCommand = isCommand || message.content.startsWith(config.command, i);
      }
      if (message.channel instanceof TextChannel) {
        if (isCommand) {
          const guild = message.channel.guild;
          const guildId = guild.id;
          const guildConfig = await GuildConfig.fetch(guildId);
          // const author: User = message.author;
          const member = message.member;

          const prefix = (guildConfig.escape || "").trim().length ? guildConfig.escape.trim() : "!";
          const botcmd = `${prefix}${config.command}`;
          if (!message.content.startsWith(botcmd)) return;

          const parts = message.content
            .trim()
            .split(" ")
            .filter((part) => part.length > 0);
          const cmd = parts.slice(1, 2)[0];
          const params = parts.slice(2);

          const languages = app.locals.langs;
          const lang = languages.find((l) => l.code === guildConfig.lang) || languages.find((l) => l.code === "en");

          if (!message.channel.guild) {
            message.reply(lang.config.desc.SERVER_COMMAND);
            return;
          }

          let isAdmin = false;
          let permission = false;
          if (member) {
            isAdmin = !!(
              member.hasPermission(Permissions.FLAGS.MANAGE_GUILD) ||
              member.hasPermission(Permissions.FLAGS.ADMINISTRATOR) ||
              member.roles.cache.find((r) =>
                isObject(guildConfig.managerRole) ? r.id === guildConfig.managerRole.id : r.name.toLowerCase().trim() === (guildConfig.managerRole || "").toLowerCase().trim()
              )
            );
            permission = guildConfig.memberHasPermission(member) || isAdmin;
          }

          try {
            if (cmd === "help" || message.content.trim().split(" ").length === 1) {
              let embed = new MessageEmbed()
                .setTitle("RPG Schedule Help")
                .setColor(guildConfig.embedColor)
                .setDescription(
                  `__**${lang.config.COMMAND_LIST}**__\n` +
                    `\`${botcmd}\` - ${lang.config.desc.HELP}\n` +
                    `\`${botcmd} help\` - ${lang.config.desc.HELP}\n` +
                    (isAdmin
                      ? `\n__**${lang.config.GENERAL_CONFIGURATION}**__\n` +
                        `\`${botcmd} configuration\` - ${lang.config.desc.CONFIGURATION}\n` +
                        `\`${botcmd} role role name\` - ${lang.config.desc.ROLE}\n` +
                        `\`${botcmd} manager-role role name\` - ${lang.config.desc.MANAGER_ROLE}\n` +
                        `\`${botcmd} password somepassword\` - ${lang.config.desc.PASSWORD_SET}\n` +
                        `\`${botcmd} password\` - ${lang.config.desc.PASSWORD_CLEAR}\n` +
                        `\`${botcmd} lang ${guildConfig.lang}\` - ${lang.config.desc.LANG} ${languages.map((l) => `\`${l.code}\` (${l.name})`).join(", ")}\n`
                      : ``) +
                    `\n__**${lang.config.USAGE}**__\n` +
                    `\`${botcmd} events timeframe\` - ${lang.config.desc.EVENTS}\n` +
                    (permission ? `\`${botcmd} link\` - ${lang.config.desc.LINK}` : ``)
                );
              if (embed.description.length > 0) message.author.send(embed);
              let embed2 = new MessageEmbed()
                .setTitle("RPG Schedule Help")
                .setColor(guildConfig.embedColor)
                .setDescription(
                  isAdmin
                    ? `\n__**${lang.config.BOT_CONFIGURATION}**__\n` +
                        `\`${botcmd} embeds ${guildConfig.embeds || guildConfig.embeds == null ? "on" : "off"}\` - \`on/off\` - ${lang.config.desc.EMBEDS}\n` +
                        `\`${botcmd} embed-color ${guildConfig.embedColor}\` - ${lang.config.desc.EMBED_COLOR}\n` +
                        `\`${botcmd} embed-user-tags ${guildConfig.embedMentions || guildConfig.embedMentions == null ? "on" : "off"}\` - \`on/off\` - ${
                          lang.config.desc.EMBED_USER_TAGS
                        }\n` +
                        `\`${botcmd} embed-user-tags-above ${guildConfig.embedMentionsAbove ? "on" : "off"}\` - \`on/off\` - ${lang.config.desc.EMBED_USER_TAGS_ABOVE}\n` +
                        `\`${botcmd} emoji-sign-up ${guildConfig.emojiAdd}\` - ${lang.config.desc.EMOJI}\n` +
                        `\`${botcmd} emoji-drop-out ${guildConfig.emojiRemove}\` - ${lang.config.desc.EMOJI}\n` +
                        `\`${botcmd} drop-outs ${guildConfig.dropOut || guildConfig.dropOut == null ? "on" : "off"}\` - \`on/off\` - ${lang.config.desc.TOGGLE_DROP_OUT}\n` +
                        `\`${botcmd} prefix-char ${prefix}\` - ${lang.config.desc.PREFIX.replace(/\:CHAR/gi, prefix)}\n` +
                        `\`${botcmd} bot-permissions #channel-name\` - ${lang.config.desc.BOT_PERMISSIONS}\n`
                    : ``
                );
              if (embed2.description.length > 0) message.author.send(embed2);
              let embed3 = new MessageEmbed()
                .setTitle("RPG Schedule Help")
                .setColor(guildConfig.embedColor)
                .setDescription(
                  isAdmin
                    ? `\n__**${lang.config.GAME_CONFIGURATION}**__\n` +
                        `\`${botcmd} add-channel #channel-name\` - ${lang.config.desc.ADD_CHANNEL}\n` +
                        `\`${botcmd} remove-channel #channel-name\` - ${lang.config.desc.REMOVE_CHANNEL}\n` +
                        `\`${botcmd} pruning ${guildConfig.pruning ? "on" : "off"}\` - \`on/off\` - ${lang.config.desc.PRUNING}\n` +
                        `\`${botcmd} prune\` - ${lang.config.desc.PRUNE}\n` +
                        `\`${botcmd} private-reminders ${guildConfig.privateReminders ? "on" : "off"}\` - \`on/off\` - ${lang.config.desc.PRIVATE_REMINDERS}\n` +
                        `\`${botcmd} reschedule-mode ${guildConfig.rescheduleMode}\` - ${lang.config.desc.RESCHEDULE_MODE}\n`
                    : ``
                );
              if (embed3.description.length > 0) message.author.send(embed3);
              message.delete();
            } else if (cmd === "link" && permission) {
              message.channel.send(responseEmbed(process.env.HOST + config.urls.game.create.path + "?s=" + guildId));
            } else if (cmd === "configuration" && isAdmin) {
              const channel =
                guildConfig.channels.length > 0
                  ? guildConfig.channels.map((c) => {
                      return guild.channels.cache.get(c.channelId);
                    })
                  : [guild.channels.cache.array().find((c) => c instanceof TextChannel)];

              let embed = new MessageEmbed()
                .setTitle(`RPG Schedule ${lang.config.CONFIGURATION}`)
                .setColor(guildConfig.embedColor)
                .setDescription(
                  `${lang.config.PREFIX}: ${prefix.length ? prefix : "!"}${config.command}\n` +
                    `${lang.config.GUILD}: \`${guild.name}\`\n` +
                    `${lang.config.CHANNELS}: ${
                      channel.filter((c) => c).length > 0
                        ? `\`${channel
                            .filter((c) => c)
                            .map((c) => c.name)
                            .join(" | ")}\``
                        : "First text channel"
                    }\n` +
                    `${lang.config.PRUNING}: \`${guildConfig.pruning ? "on" : "off"}\`\n` +
                    `${lang.config.EMBEDS}: \`${!(guildConfig.embeds === false) ? "on" : "off"}\`\n` +
                    `${lang.config.EMBED_COLOR}: \`${guildConfig.embedColor}\`\n` +
                    `${lang.config.EMBED_USER_TAGS}: \`${guildConfig.embedMentions}\`\n` +
                    `${lang.config.EMOJI_JOIN}: \`${guildConfig.emojiAdd}\`\n` +
                    `${lang.config.EMOJI_LEAVE}: \`${guildConfig.emojiRemove}\`\n` +
                    `${lang.config.PRIVATE_REMINDERS}: \`${guildConfig.privateReminders ? "on" : "off"}\`\n` +
                    `${lang.config.RESCHEDULE_MODE}: \`${guildConfig.rescheduleMode}\`\n` +
                    `${lang.config.PASSWORD}: ${guildConfig.password ? `\`${guildConfig.password}\`` : "Disabled"}\n` +
                    `${lang.config.ROLE}: ${guildConfig.role ? `\`${guildConfig.role}\`` : "All Roles"}\n` +
                    `${lang.config.MANAGER_ROLE}: ${guildConfig.managerRole ? `\`${guildConfig.managerRole}\` and Server Admins` : "Server Admins"}\n` +
                    `${lang.config.DROP_OUTS}: ${guildConfig.dropOut ? `Enabled` : "Disabled"}\n` +
                    `${lang.config.LANGUAGE}: ${guildConfig.lang}\n`
                );
              if (member) member.send(embed);
            } else if (cmd === "add-channel" && isAdmin) {
              if (params[0]) {
                let channel: string = params[0].replace(/\<\#|\>/g, "");
                if (channel.trim().length === params[0].trim().length) {
                  const c = message.guild.channels.cache.find((ch) => ch.name === channel.trim());
                  if (c) channel = c.id;
                }
                if (channel.trim().length === params[0].trim().length) {
                  return message.channel.send(responseEmbed(`Channel not found!`));
                }
                const channels = guildConfig.channels;
                if (!channels.find((c) => c.channelId === channel)) channels.push({ channelId: channel, gameTemplates: [guildConfig.defaultGameTemplate.id] });
                guildConfig
                  .save({
                    channel: channels,
                  })
                  .then((result) => {
                    message.channel.send(responseEmbed(lang.config.CHANNEL_ADDED));
                    const addedChannel = message.guild.channels.cache.find((c) => c.id === channel);
                    if (addedChannel) {
                      const missingPermissions = [
                        !addedChannel.permissionsFor(client.user.id).has(Permissions.FLAGS.VIEW_CHANNEL) && "VIEW_CHANNEL",
                        !addedChannel.permissionsFor(client.user.id).has(Permissions.FLAGS.READ_MESSAGE_HISTORY) && "READ_MESSAGE_HISTORY",
                        !addedChannel.permissionsFor(client.user.id).has(Permissions.FLAGS.SEND_MESSAGES) && "SEND_MESSAGES",
                        !addedChannel.permissionsFor(client.user.id).has(Permissions.FLAGS.MANAGE_MESSAGES) && "MANAGE_MESSAGES",
                        !addedChannel.permissionsFor(client.user.id).has(Permissions.FLAGS.EMBED_LINKS) && "EMBED_LINKS",
                        !addedChannel.permissionsFor(client.user.id).has(Permissions.FLAGS.ADD_REACTIONS) && "ADD_REACTIONS",
                      ].filter((check) => check);
                      if (missingPermissions.length > 0) {
                        message.channel.send(responseEmbed(`The bot is missing the following permissions in ${addedChannel.toString()}: ${missingPermissions.join(", ")}`));
                      }
                    }
                  })
                  .catch((err) => {
                    aux.log(err);
                  });
              }
            } else if (cmd === "remove-channel" && isAdmin) {
              if (params[0]) {
                let channel: string = params[0].replace(/\<\#|\>/g, "");
                if (channel.trim().length === params[0].trim().length) {
                  const c = message.guild.channels.cache.find((ch) => ch.name === channel.trim());
                  if (c) channel = c.id;
                }
                if (channel.trim().length === params[0].trim().length) {
                  return message.channel.send(responseEmbed(`Channel not found!`));
                }
                const channels = guildConfig.channels.filter((c) => {
                  return !!guild.channels.cache.get(c.channelId);
                });
                if (channels.find((c) => c.channelId === channel)) {
                  channels.splice(
                    channels.findIndex((c) => c.channelId === channel),
                    1
                  );
                }
                guildConfig
                  .save({
                    channel: channels,
                  })
                  .then((result) => {
                    message.channel.send(responseEmbed(lang.config.CHANNEL_REMOVED));
                  })
                  .catch((err) => {
                    aux.log(err);
                  });
              }
            } else if (cmd === "pruning" && isAdmin) {
              if (params[0]) {
                guildConfig
                  .save({
                    pruning: params[0] === "on",
                  })
                  .then((result) => {
                    message.channel.send(responseEmbed(params[0] === "on" ? lang.config.PRUNING_ON : lang.config.PRUNING_OFF));
                  })
                  .catch((err) => {
                    aux.log(err);
                  });
              }
            } else if (cmd === "prune" && isAdmin) {
              await pruneOldGames(message.guild);
              message.channel.send(responseEmbed(lang.config.PRUNE));
            } else if (cmd === "embeds" && isAdmin) {
              if (params[0]) {
                guildConfig
                  .save({
                    embeds: !(params[0] === "off"),
                  })
                  .then((result) => {
                    message.channel.send(responseEmbed(!(params[0] === "off") ? lang.config.EMBEDS_ON : lang.config.EMBEDS_OFF));
                  })
                  .catch((err) => {
                    aux.log(err);
                  });
              }
            } else if (cmd === "embed-user-tags" && isAdmin) {
              if (params[0]) {
                guildConfig
                  .save({
                    embedMentions: !(params[0] === "off"),
                  })
                  .then((result) => {
                    message.channel.send(responseEmbed(!(params[0] === "off") ? lang.config.EMBED_USER_TAGS_ON : lang.config.EMBED_USER_TAGS_OFF));
                  })
                  .catch((err) => {
                    aux.log(err);
                  });
              }
            } else if (cmd === "embed-user-tags-above" && isAdmin) {
              if (params[0]) {
                guildConfig
                  .save({
                    embedMentionsAbove: !(params[0] === "off"),
                  })
                  .then((result) => {
                    message.channel.send(responseEmbed(!(params[0] === "off") ? lang.config.EMBED_USER_TAGS_ABOVE_ON : lang.config.EMBED_USER_TAGS_ABOVE_OFF));
                  })
                  .catch((err) => {
                    aux.log(err);
                  });
              }
            } else if (cmd === "embed-color" && isAdmin) {
              let color = params.join("");
              var colors = {
                aliceblue: "#f0f8ff",
                antiquewhite: "#faebd7",
                aqua: "#00ffff",
                aquamarine: "#7fffd4",
                azure: "#f0ffff",
                beige: "#f5f5dc",
                bisque: "#ffe4c4",
                black: "#000000",
                blanchedalmond: "#ffebcd",
                blue: "#0000ff",
                blueviolet: "#8a2be2",
                brown: "#a52a2a",
                burlywood: "#deb887",
                cadetblue: "#5f9ea0",
                chartreuse: "#7fff00",
                chocolate: "#d2691e",
                coral: "#ff7f50",
                cornflowerblue: "#6495ed",
                cornsilk: "#fff8dc",
                crimson: "#dc143c",
                cyan: "#00ffff",
                darkblue: "#00008b",
                darkcyan: "#008b8b",
                darkgoldenrod: "#b8860b",
                darkgray: "#a9a9a9",
                darkgreen: "#006400",
                darkkhaki: "#bdb76b",
                darkmagenta: "#8b008b",
                darkolivegreen: "#556b2f",
                darkorange: "#ff8c00",
                darkorchid: "#9932cc",
                darkred: "#8b0000",
                darksalmon: "#e9967a",
                darkseagreen: "#8fbc8f",
                darkslateblue: "#483d8b",
                darkslategray: "#2f4f4f",
                darkturquoise: "#00ced1",
                darkviolet: "#9400d3",
                deeppink: "#ff1493",
                deepskyblue: "#00bfff",
                dimgray: "#696969",
                dodgerblue: "#1e90ff",
                firebrick: "#b22222",
                floralwhite: "#fffaf0",
                forestgreen: "#228b22",
                fuchsia: "#ff00ff",
                gainsboro: "#dcdcdc",
                ghostwhite: "#f8f8ff",
                gold: "#ffd700",
                goldenrod: "#daa520",
                gray: "#808080",
                green: "#008000",
                greenyellow: "#adff2f",
                honeydew: "#f0fff0",
                hotpink: "#ff69b4",
                indianred: "#cd5c5c",
                indigo: "#4b0082",
                ivory: "#fffff0",
                khaki: "#f0e68c",
                lightyellow: "#ffffe0",
                lime: "#00ff00",
                limegreen: "#32cd32",
                linen: "#faf0e6",
                lavender: "#e6e6fa",
                lavenderblush: "#fff0f5",
                lawngreen: "#7cfc00",
                lemonchiffon: "#fffacd",
                lightblue: "#add8e6",
                lightcoral: "#f08080",
                lightcyan: "#e0ffff",
                lightgoldenrodyellow: "#fafad2",
                lightgrey: "#d3d3d3",
                lightgreen: "#90ee90",
                lightpink: "#ffb6c1",
                lightsalmon: "#ffa07a",
                lightseagreen: "#20b2aa",
                lightskyblue: "#87cefa",
                lightslategray: "#778899",
                lightsteelblue: "#b0c4de",
                magenta: "#ff00ff",
                maroon: "#800000",
                mediumaquamarine: "#66cdaa",
                mediumblue: "#0000cd",
                mediumorchid: "#ba55d3",
                mediumpurple: "#9370d8",
                mediumseagreen: "#3cb371",
                mediumslateblue: "#7b68ee",
                mediumspringgreen: "#00fa9a",
                mediumturquoise: "#48d1cc",
                mediumvioletred: "#c71585",
                midnightblue: "#191970",
                mintcream: "#f5fffa",
                mistyrose: "#ffe4e1",
                moccasin: "#ffe4b5",
                navajowhite: "#ffdead",
                navy: "#000080",
                oldlace: "#fdf5e6",
                olive: "#808000",
                olivedrab: "#6b8e23",
                orange: "#ffa500",
                orangered: "#ff4500",
                orchid: "#da70d6",
                palegoldenrod: "#eee8aa",
                palegreen: "#98fb98",
                paleturquoise: "#afeeee",
                palevioletred: "#d87093",
                papayawhip: "#ffefd5",
                peachpuff: "#ffdab9",
                peru: "#cd853f",
                pink: "#ffc0cb",
                plum: "#dda0dd",
                powderblue: "#b0e0e6",
                purple: "#800080",
                rebeccapurple: "#663399",
                red: "#ff0000",
                rosybrown: "#bc8f8f",
                royalblue: "#4169e1",
                tan: "#d2b48c",
                teal: "#008080",
                thistle: "#d8bfd8",
                tomato: "#ff6347",
                turquoise: "#40e0d0",
                saddlebrown: "#8b4513",
                salmon: "#fa8072",
                sandybrown: "#f4a460",
                seagreen: "#2e8b57",
                seashell: "#fff5ee",
                sienna: "#a0522d",
                silver: "#c0c0c0",
                skyblue: "#87ceeb",
                slateblue: "#6a5acd",
                slategray: "#708090",
                snow: "#fffafa",
                springgreen: "#00ff7f",
                steelblue: "#4682b4",
                violet: "#ee82ee",
                wheat: "#f5deb3",
                white: "#ffffff",
                whitesmoke: "#f5f5f5",
                yellow: "#ffff00",
                yellowgreen: "#9acd32",
              };
              if (colors[color]) {
                color = colors[color];
              } else if (!color.match(/[0-9a-f]{6}|[0-9a-f]{3}/i)) {
                message.channel.send(responseEmbed(lang.config.desc.EMBED_COLOR_ERROR));
                return;
              }
              const save: GuildConfigModel = {};
              save.embedColor = "#" + color.match(/[0-9a-f]{6}|[0-9a-f]{3}/i)[0];
              guildConfig
                .save(save)
                .then((result) => {
                  let embed = new MessageEmbed()
                    .setColor("#" + color.match(/[0-9a-f]{6}|[0-9a-f]{3}/i)[0])
                    .setDescription(`${lang.config.EMBED_COLOR_SET} \`#${color.match(/[0-9a-f]{6}|[0-9a-f]{3}/i)[0]}\`.`);
                  message.channel.send(embed);
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "emoji-sign-up" && isAdmin) {
              const emoji = params.join(" ");
              if (!aux.isEmoji(emoji) || (emoji.length > 2 && emoji.match(/\:[^\:]+\:/))) {
                message.channel.send(responseEmbed(lang.config.desc.EMOJI_ERROR.replace(/\:char/gi, emoji.replace(/\<|\>/g, ""))));
                return;
              }
              guildConfig
                .save({
                  emojiAdd: emoji,
                })
                .then((result) => {
                  message.channel.send(responseEmbed(lang.config.EMOJI_JOIN_SET));
                  guildConfig.emojiAdd = emoji;
                  guildConfig.updateReactions(client);
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "emoji-drop-out" && isAdmin) {
              const emoji = params.join(" ");
              if (!aux.isEmoji(emoji) || (emoji.length > 2 && emoji.match(/\:[^\:]+\:/))) {
                message.channel.send(responseEmbed(lang.config.desc.EMOJI_ERROR.replace(/\:char/gi, emoji.replace(/\<|\>/g, ""))));
                return;
              }
              await guildConfig
                .save({
                  emojiRemove: emoji,
                })
                .then((result) => {
                  message.channel.send(responseEmbed(lang.config.EMOJI_LEAVE_SET));
                  guildConfig.emojiRemove = emoji;
                  guildConfig.updateReactions(client);
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "prefix-char" && isAdmin) {
              let prefix = params.join("").trim().slice(0, 3);
              guildConfig
                .save({
                  escape: prefix.length ? prefix : "!",
                })
                .then((result) => {
                  message.channel.send(responseEmbed(lang.config.PREFIX_CHAR.replace(/\:CMD/gi, `${prefix.length ? prefix : "!"}${config.command}`)));
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "private-reminders" && isAdmin) {
              guildConfig
                .save({
                  privateReminders: !guildConfig.privateReminders,
                })
                .then((result) => {
                  message.channel.send(responseEmbed(!guildConfig.privateReminders ? lang.config.PRIVATE_REMINDERS_ON : lang.config.PRIVATE_REMINDERS_OFF));
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "reschedule-mode" && isAdmin) {
              let mode = params.join("").trim();
              const options = ["update", "repost"];
              guildConfig
                .save({
                  rescheduleMode: options.includes(mode) ? mode : "repost",
                })
                .then((result) => {
                  message.channel.send(responseEmbed(lang.config.RESCHEDULE_MODE_UPDATED));
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "reschedule" && isAdmin) {
              await rescheduleOldGames(message.guild.id);
            } else if (cmd === "remind" && isAdmin) {
              await postReminders(message.guild.id);
            } else if (cmd === "password" && isAdmin) {
              guildConfig
                .save({
                  password: params.join(" "),
                })
                .then((result) => {
                  message.channel.send(responseEmbed(lang.config.PASSWORD_SET));
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "toggle-drop-out" && isAdmin) {
              guildConfig
                .save({
                  dropOut: guildConfig.dropOut === false,
                })
                .then((result) => {
                  message.channel.send(responseEmbed(guildConfig.dropOut === false ? lang.config.DROP_OUTS_ENABLED : lang.config.DROP_OUTS_DISABLED));
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "role" && isAdmin) {
              const mentioned = (params[0] || "").match(/(\d+)/);
              let roleObj: ConfigRole = {
                id: null,
                name: params.join(" "),
              };
              if (roleObj.name.trim() === "All Roles") {
                roleObj.name = "";
              }
              if (mentioned) {
                const roleId = mentioned[0];
                const role = guild.roles.cache.array().find((r) => r.id === roleId);
                if (role) {
                  roleObj.id = role.id;
                  roleObj.name = role.name;
                }
              }
              const save: GuildConfigModel = {
                role: roleObj.id ? roleObj : null,
                gameTemplates: cloneDeep(guildConfig.gameTemplates).map((gt) => {
                  if (gt.name === "Default") gt.role = roleObj.id ? roleObj : null;
                  return gt;
                }),
              };
              guildConfig
                .save(save)
                .then((result) => {
                  message.channel.send(responseEmbed(roleObj.name.length > 0 ? lang.config.ROLE_SET.replace(/\:role/gi, roleObj.name) : lang.config.ROLE_CLEARED));
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "manager-role" && isAdmin) {
              const mentioned = (params[0] || "").match(/(\d+)/);
              let roleObj: ConfigRole = {
                id: null,
                name: params.join(" "),
              };
              if (mentioned) {
                const roleId = mentioned[0];
                const role = guild.roles.cache.array().find((r) => r.id === roleId);
                if (role) {
                  roleObj.id = role.id;
                  roleObj.name = role.name;
                }
              }
              guildConfig
                .save({
                  managerRole: roleObj.id ? roleObj : null,
                })
                .then((result) => {
                  message.channel.send(responseEmbed(roleObj.name.length > 0 ? lang.config.ROLE_SET.replace(/\:role/gi, roleObj.name) : lang.config.ROLE_CLEARED));
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "lang" && isAdmin) {
              const newLang = languages.find((l) => l.code === params[0].trim());
              if (!newLang) {
                return message.channel.send(lang.config.NO_LANG);
              }
              guildConfig
                .save({
                  lang: newLang.code,
                })
                .then((result) => {
                  message.channel.send(responseEmbed(newLang.config.LANG_SET.replace(/\:lang/gi, newLang.name)));
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "refresh" && member.user.tag === config.author) {
              const guildId = params[0] ? (params[0] === "all" ? null : params[0]) : message.guild.id;
              await client.shard.send({
                type: "refresh",
                guildId: guildId,
              });
              if (params[0] === "all") message.channel.send(responseEmbed(`Data refresh started for all servers`));
              else {
                const shards = await client.shard.broadcastEval(`this.guilds.cache.find(g => g.id === "${guildId}");`);
                const guild = shards.find((s) => s);
                if (guild) {
                  message.channel.send(responseEmbed(`Data refresh started for the \`${guild.name}\` server`));
                }
              }
            } else if (cmd === "reboot" && member.user.tag === config.author) {
              await client.shard.send({
                type: "reboot",
              });
            } else if (cmd === "bot-permissions" && (isAdmin || member.user.tag === config.author)) {
              let channelId = message.channel.id;
              if (params[0]) {
                channelId = params[0].replace(/\<\#|\>/g, "");
                if (channelId.trim().length === params[0].trim().length) {
                  const c = message.guild.channels.cache.find((ch) => ch.name === channelId.trim());
                  if (c) channelId = c.id;
                }
                if (channelId.trim().length === params[0].trim().length) {
                  return message.channel.send(responseEmbed(`Channel not found!`));
                }
              }
              const sGuilds = await shardManager.clientGuilds(client, [message.guild.id]);
              const sChannel = sGuilds[0].channels.find((c) => c.id === channelId);
              const requiredPermissions = ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "SEND_MESSAGES", "MANAGE_MESSAGES", "EMBED_LINKS", "ADD_REACTIONS"];
              const missingPermissions = requiredPermissions.filter((rp) => !sChannel.botPermissions.includes(rp));
              if (missingPermissions.length > 0) {
                message.channel.send(responseEmbed(`The bot is missing the following permissions in <#${sChannel.id}>: ${missingPermissions.join(", ")}`));
              } else {
                message.channel.send(responseEmbed(`The bot has all the permissions it needs in <#${sChannel.id}>.`));
              }
            } else if (cmd === "events") {
              const response = await cmdFetchEvents(message.guild, params.join(" "), lang);
              if (response) {
                if (Array.isArray(response)) {
                  response.forEach((r) => {
                    message.author.send(r);
                  });
                } else {
                  message.author.send(response);
                }
              } else message.author.send(lang.config.EVENTS_NONE);
              message.delete();
            } else {
              const response = await message.channel.send("Command not recognized");
              if (response) {
                setTimeout(() => {
                  response.delete();
                }, 3000);
              }
            }
          } catch (err) {
            aux.log("BotCommandError:", err);
          }
        }
      }
      if (message.channel instanceof DMChannel) {
        if (isCommand) {
          const userSettings = await RPGSUser.fetch(message.author.id);

          const prefix = "!";
          const botcmd = `${prefix}${config.command}`;
          if (!message.content.startsWith(botcmd)) return;

          const parts = message.content
            .trim()
            .split(" ")
            .filter((part) => part.length > 0);
          const cmd = parts.slice(1, 2)[0];
          const params = parts.slice(2);

          const languages = app.locals.langs;
          const lang = languages.find((l) => l.code === userSettings.lang) || languages.find((l) => l.code === "en");

          try {
            if (cmd === "events") {
              const guilds = flatten(await shardManager.clientShardGuilds(client, { memberIds: [message.author.id] }));
              let count = 0;
              for (let i = 0; i < guilds.length; i++) {
                const guild = guilds[i];
                const response = await cmdFetchEvents(guild, params.join(" "), lang, guilds);
                if (response) count++;
                if (response) {
                  if (Array.isArray(response)) {
                    response.forEach((r) => {
                      message.author.send(r);
                    });
                  } else {
                    message.author.send(response);
                  }
                }
              }
              if (!count) message.author.send(lang.config.EVENTS_NONE);
            } else {
              const response = await (<DMChannel>message.channel).send("Command not recognized");
              if (response) {
                setTimeout(() => {
                  response.delete();
                }, 3000);
              }
            }
          } catch (err) {
            aux.log("BotCommandError:", err);
          }
        }
      }
    } catch (err) {
      aux.log(err);
    }
  });

  /**
   * Discord.JS - messageReactionAdd
   */
  client.on("messageReactionAdd", async (reaction, user: User) => {
    try {
      if (!reaction) return;
      const message = reaction.message;
      const t = new Date().getTime();
      const guildConfig = await GuildConfig.fetch(message.guild.id);
      if (user.id !== message.author.id && (reaction.emoji.name === guildConfig.emojiAdd || reaction.emoji.name === guildConfig.emojiRemove)) {
        if (guildConfig.channel.length > 0 && guildConfig.channel.find((c) => c.channelId === message.channel.id)) reaction.users.remove(user);
        const game = await Game.fetchBy("messageId", message.id, client);
        if (game) {
          if (game.method !== GameMethod.AUTOMATED) return;
          if (reaction.emoji.name === guildConfig.emojiAdd) {
            game.signUp(user, t);
          }
          if (reaction.emoji.name === guildConfig.emojiRemove) {
            game.dropOut(user, guildConfig);
          }
        }
      }
    } catch (err) {
      aux.log("DiscordReactionError:", err);
    }
  });

  /**
   * Discord.JS - messageDelete
   * Delete the game from the database when the announcement message is deleted
   */
  client.on("messageDelete", async (message) => {
    if (message.author.id !== client.user.id) return;
    if (!(message.channel instanceof TextChannel || message.channel instanceof NewsChannel)) return;
    const games = await Game.fetchAllBy(
      {
        messageId: message.id,
        pruned: {
          $in: [false, null],
        },
        deleted: {
          $in: [false, null],
        },
      },
      client
    );
    games.forEach((game) => {
      if (game) game.delete();
    });
  });

  /**
   * Add events to non-cached messages
   */
  const events = {
    MESSAGE_REACTION_ADD: "messageReactionAdd",
    MESSAGE_REACTION_REMOVE: "messageReactionRemove",
  };

  client.on("raw", async (event: any) => {
    if (!events.hasOwnProperty(event.t)) return;

    const { d: data } = event;
    const user = client.users.cache.get(data.user_id);
    const channel = <TextChannel | NewsChannel>client.channels.cache.get(data.channel_id) || (await user.createDM());

    if (!channel || channel.messages.cache.has(data.message_id)) return;

    const message = await channel.messages.fetch(data.message_id);
    const emojiKey = data.emoji.id ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
    let reaction = message.reactions.cache.get(emojiKey);

    // if (!reaction) {
    //   const emoji = new discord.Emoji(client.guilds.cache.get(data.guild_id), data.emoji);
    //   reaction = new discord.MessageReaction(client, {
    //     emoji: emoji
    //   }, message);
    // }

    client.emit(events[event.t], reaction, user);
  });

  client.on("shardDisconnect", (ev, id) => {
    aux.log("Client: Shard Disconnect", id);
    aux.log(ev);
  });

  client.on("shardError", (err, id) => {
    aux.log("Client: Shard Error", id);
    aux.log(err);
  });

  client.on("shardReady", (id) => {
    aux.log("Client: Shard Ready", id);
  });

  client.on("shardReconnecting", (id) => {
    aux.log("Client: Shard Reconnecting", id);
  });

  client.on("shardResume", (id) => {
    aux.log("Client: Shard Resumed", id);
    sendGuildsToAPI();
  });

  client.on("invalidated", () => {
    aux.log("Client: Invalidated");
    // setTimeout(() => {
    //   discordLogin(client);
    // }, 60 * 1000);
  });
}

(async () => {
  if (!connected) connected = await db.database.connect();
  if (connected) {
    aux.log("Database connected in shard!");
    // Login the Discord bot
    client.login(process.env.TOKEN);
    // const result = await Game.deleteAllBy({ s: "497043627432738817", adventure: "Mothership: A Carrion-Eater Company" }, client);
    // console.log(result.deletedCount);

    // const games = await Game.fetchAllBy({});
    // let gameCounts = [];
    // games.filter((g:any) => !g.deleted).forEach(g => {
    //   const index = gameCounts.findIndex(gc => gc.s === g.s && gc.adventure === g.adventure);
    //   if (index >= 0) {
    //     gameCounts[index] = {
    //       ...gameCounts[index],
    //       count: gameCounts[index].count+1
    //     };
    //   }
    //   else {
    //     gameCounts.push({
    //       s: g.s,
    //       adventure: g.adventure,
    //       frequency: g.frequency,
    //       count: 1
    //     });
    //   }
    // });
    // console.log(gameCounts.filter(gc => gc.count > 100));
  }
})();

const responseEmbed = (message: string, title?: string) => {
  const embed = new MessageEmbed();
  if (title) embed.setTitle(title);
  embed.setDescription(message);
  embed.setColor("#2196f3");
  return embed;
};

const refreshMessages = async () => {
  let games = await Game.fetchAllBy(
    { s: { $in: client.guilds.cache.array().map((g) => g.id) }, messageId: null, when: "datetime", method: "automated", timestamp: { $gte: new Date().getTime() } },
    client
  );
  games.forEach(async (game) => {
    if (!game.discordGuild) return;

    try {
      await game.save();
    } catch (err) {}
  });
};

let rescheduled: Game[] = [];
const rescheduleOldGames = async (guildId?: string) => {
  let result: DeleteWriteOpResultObject;
  try {
    aux.log(`Rescheduling old games for ${guildId ? `guild ${guildId}` : `all servers`}`);
    const query: FilterQuery<any> = {
      when: "datetime",
      timestamp: {
        $lt: new Date().getTime(),
      },
      frequency: {
        $nin: ["0", null],
      },
      hideDate: {
        $in: [false, null],
      },
      rescheduled: {
        $in: [false, null],
      },
      pruned: {
        $in: [false, null],
      },
      deleted: {
        $in: [false, null],
      },
    };

    let guildIds = [];
    if (guildId) {
      guildIds.push(guildId);
    } else {
      guildIds = client.guilds.cache.array().map((g) => g.id);
    }

    let page = 0;
    const perpage = 200;
    let pages = guildIds.length / perpage;
    let count = 0;
    let totalGames = 0;
    while (pages > 0 && page < pages) {
      query.s = {
        $in: guildIds.slice(page * perpage, page * perpage + perpage),
      };

      page++;

      let games = await Game.fetchAllBy(query, client);
      totalGames += games.length;
      if (totalGames > 0 && page === pages) aux.log(`Found ${totalGames} games scheduled before now`);
      for (let i = 0; i < games.length; i++) {
        const game = games[i];

        if (
          game.canReschedule() &&
          !rescheduled.find((g) => g.s == game.s && g.c == game.c && g.adventure == game.adventure && g.date == game.date && g.time == game.time && g.timezone == game.timezone)
        ) {
          rescheduled.push(game);
          count++;
          try {
            await game.reschedule();
          } catch (err) {}
        }
      }
    }

    if (totalGames > 0) aux.log(`Rescheduled ${count} games`);
  } catch (err) {
    aux.log("GameReschedulingError:", err);
  }

  setTimeout(() => {
    rescheduled = [];
  }, 5 * 60 * 1000);
  return result;
};

const pruneOldGames = async (guild?: Guild) => {
  let pruned: UpdateWriteOpResult;
  const day = 24 * 3600 * 1000;
  try {
    aux.log(`Pruning old games for ${guild ? `${guild.name} server` : "all servers"}`);
    const query: FilterQuery<any> = {
      timestamp: {
        $lt: new Date().getTime() - 2 * day,
      },
      frequency: "0",
      hideDate: {
        $in: [false, null],
      },
      deleted: {
        $in: [false, null],
      },
    };

    let guildIds = [];
    if (guild) {
      guildIds.push(guild.id);
    } else {
      guildIds = client.guilds.cache.array().map((g) => g.id);
    }

    let page = 0;
    const perpage = 200;
    let pages = guildIds.length / perpage;
    while (pages > 0 && page < pages) {
      query.s = {
        $in: guildIds.slice(page * perpage, page * perpage + perpage),
      };

      page++;

      let games = await Game.fetchAllBy(query, client);
      games.sort((a, b) => {
        return a.s > b.s ? 1 : -1;
      });

      const guildConfigs = await GuildConfig.fetchAllBy({
        guild: guild
          ? guild.id
          : {
              $in: games.map((g) => g.s).filter((s, i, arr) => arr.indexOf(s) === i),
            },
      });

      const prunedIds = [];
      const deletedIds = [];

      for (let i = 0; i < games.length; i++) {
        let game = games[i];
        if (!game.discordGuild) continue;
        if (guild && game.discordGuild.id !== guild.id) continue;

        try {
          const guildConfig = guildConfigs.find((gc) => gc.guild === game.s) || new GuildConfig();
          if (!guildConfig) continue;

          if (!game.pruned && game.discordChannel && new Date().getTime() - game.timestamp >= guildConfig.pruneIntDiscord * day) {
            if (game.messageId) {
              if (guildConfig.pruning) {
                const message = await game.discordChannel.messages.fetch(game.messageId);
                if (message.deletable) message.delete();
              }

              if (guildConfig.pruneIntDiscord < guildConfig.pruneIntEvents && new Date().getTime() - game.timestamp < guildConfig.pruneIntEvents * day) {
                prunedIds.push(game._id);
                client.shard.send({
                  type: "socket",
                  name: "game",
                  data: { action: "pruned", gameId: game._id, room: `g-${game.s}` },
                });
              } else {
                deletedIds.push(game._id);
                client.shard.send({
                  type: "socket",
                  name: "game",
                  data: { action: "deleted", gameId: game._id, room: `g-${game.s}` },
                });
              }
            }

            if (game.reminderMessageId) {
              const message = await game.discordChannel.messages.fetch(game.reminderMessageId);
              if (message.deletable) message.delete();
            }
          } else if (new Date().getTime() - game.timestamp >= guildConfig.pruneIntEvents * day) {
            deletedIds.push(game._id);
            client.shard.send({
              type: "socket",
              name: "game",
              data: { action: "deleted", gameId: game._id, room: `g-${game.s}` },
            });
          }
        } catch (err) {
          aux.log("MessagePruningError:", err);
        }
      }

      pruned = <UpdateWriteOpResult>await Game.updateAllBy(
        {
          pruned: {
            $in: [false, null],
          },
          _id: {
            $in: prunedIds.map((pid) => new ObjectId(pid)),
          },
        },
        {
          $set: {
            pruned: true,
          },
        }
      );
      if (pruned.modifiedCount > 0) aux.log(`${pruned.modifiedCount} old game(s) pruned from Discord only`);

      pruned = await Game.softDeleteAllBy({
        _id: {
          $in: deletedIds.map((pid) => new ObjectId(pid)),
        },
      });
      if (pruned.modifiedCount > 0) aux.log(`${pruned.modifiedCount} old game(s) successfully pruned`);

      const hardDeleted = await Game.deleteAllBy(
        {
          $or: [
            {
              hideDate: {
                $in: [false, null],
              },
            },
            {
              deleted: true,
            },
          ],
          timestamp: {
            $lt: new Date().getTime() - 14 * day,
          },
        },
        client
      );
      if (hardDeleted.deletedCount > 0) aux.log(`${hardDeleted.deletedCount} old game(s) successfully deleted`);

      let count = 0;

      for (let gci = 0; gci < guildConfigs.length; gci++) {
        const gc = guildConfigs[gci];
        const guild = client.guilds.cache.find((g) => g.id === gc.guild);
        const channels = <(TextChannel | NewsChannel)[]>(
          guild.channels.cache.array().filter((c) => gc.channels.find((gcc) => gcc.channelId === c.id) && (c instanceof TextChannel || c instanceof NewsChannel))
        );

        for (let ci = 0; ci < channels.length; ci++) {
          const c = channels[ci];
          const messages = await c.messages.fetch({ limit: 100 });
          if (messages.size === 0) continue;

          const clientMessages = messages
            .array()
            .filter(
              (m) =>
                m.author.id === client.user.id &&
                m.deletable &&
                !m.deleted &&
                (new Date().getTime() - m.createdTimestamp >= 14 * day || new Date().getTime() - m.createdTimestamp >= gc.pruneIntDiscord * day)
            );

          if (clientMessages.length === 0) continue;

          try {
            const deleted = await c.bulkDelete(clientMessages, true);
            count += deleted.size;
            clientMessages
              .filter((cm) => !deleted.find((d) => d.id === cm.id))
              .forEach((cm) => {
                cm.delete({ reason: "Automated pruning..." });
                count++;
              });
          } catch (err) {
            console.log("AutomatedPruningError:", err);
          }
        }
      }

      if (count > 0) aux.log(`${count} old message(s) successfully pruned`);
      page++;
    }
  } catch (err) {
    aux.log("GamePruningError:", err);
  }
  return pruned;
};

const postReminders = async (guildId?: string) => {
  const cTime = new Date().getTime();
  const remExprs = gameReminderOptions.map((r) => {
    const rt = parseInt(r);
    return {
      reminder: r,
      timestamp: {
        $gte: cTime + (rt - 2) * 60 * 1000,
        $lte: cTime + rt * 60 * 1000,
      },
    };
  });

  const query: FilterQuery<any> = {
    when: "datetime",
    timestamp: {
      $gt: cTime,
    },
    hideDate: {
      $in: [false, null],
    },
    reminded: {
      $in: [false, null],
    },
    deleted: {
      $in: [false, null],
    },
    pruned: {
      $in: [false, null],
    },
    $or: remExprs,
  };

  if (guildId) {
    query.s = guildId;
  }

  const supportedLanguages = require("../../lang/langs.json");
  const langs = supportedLanguages.langs
    .map((lang: String) => {
      return {
        code: lang,
        ...require(`../../lang/${lang}.json`),
      };
    })
    .sort((a: any, b: any) => (a.name > b.name ? 1 : -1));

  const guildIds = client.guilds.cache.array().map((g) => g.id);

  let page = 0;
  const perpage = 100;
  let pages = Math.ceil(guildIds.length / perpage);
  let totalGames = 0;
  while (pages > 0 && page < pages) {
    query.s = {
      $in: guildIds.slice(page * perpage, page * perpage + perpage),
    };

    page++;

    const games = await Game.fetchAllBy(query, client);
    const filteredGames = games.filter((game) => {
      if (!client.guilds.cache.array().find((g) => g.id === game.s)) return false;
      if (game.timestamp - parseInt(game.reminder) * 60 * 1000 > new Date().getTime()) return false;
      if ((new Date().getTime() - (game.timestamp - parseInt(game.reminder) * 60 * 1000)) / 1000 > 2 * 60) return false;
      if (!game.discordGuild) return false;
      if (!game.discordChannel) return false;
      if (game.reminded) return false;
      return true;
    });
    totalGames += filteredGames.length;
    if (page === pages && totalGames > 0) aux.log(`Posting reminders for ${totalGames} games`);
    filteredGames.forEach(async (game) => {
      try {
        const reserved: string[] = [];
        const reservedUsers: ShardMember[] = [];
        let dmMember: ShardMember;
        let dm: string;

        try {
          const guildMembers = await game.discordGuild.members;

          var where = Game.parseDiscord(game.where, game.discordGuild);
          game.reserved.forEach((rsvp) => {
            if (rsvp.tag.length === 0) return;
            let member = guildMembers.find(
              (mem) => mem.user.tag.trim() === rsvp.tag.trim().replace("@", "") || mem.user.id == rsvp.tag.trim().replace(/[<@>]/g, "") || mem.user.id === rsvp.id
            );

            let name = rsvp.tag;
            if (member) name = member.user.toString();

            if (reserved.length < parseInt(game.players)) {
              if (member) reservedUsers.push(member);
              reserved.push(name);
            }
          });

          const member = guildMembers.find((mem) => mem.user.tag === game.dm.tag.trim().replace("@", "") || mem.user.id === game.dm.id);
          dm = game.dm.tag.trim().replace("@", "");
          dmMember = member;
          if (member) dm = member.user.toString();
        } catch (err) {
          console.log(err);
        }

        try {
          game.reminded = true;
          const result = await game.save({ force: true });
          if (!result || !result.modified) return;
        } catch (err) {
          aux.log("RemindedSaveError", game._id, err);
          return;
        }

        if (reserved.length == 0) return;

        let minPlayers = parseInt(game.minPlayers);
        if (!isNaN(parseInt(game.minPlayers))) minPlayers = 0;
        if (reserved.length < minPlayers) return;

        const message = await game.discordChannel.messages.fetch(game.messageId);
        if (!message || (message && message.author.id !== process.env.CLIENT_ID)) return false;

        const guildConfig = await GuildConfig.fetch(game.discordGuild.id);
        const lang = langs.find((l) => l.code === guildConfig.lang) || langs.find((l) => l.code === "en");
        const reminder = game.reminder;

        const siUnit = parseInt(reminder) > 60 ? "HOURS" : "MINUTES";
        const siLabel = lang.game[`STARTING_IN_${siUnit}`].replace(`:${siUnit}`, parseInt(reminder) / (parseInt(reminder) > 60 ? 60 : 1));

        if (!game.template) game.template = (guildConfig.gameTemplates.find((gt) => gt.isDefault) || guildConfig.gameTemplates[0]).id;
        const gameTemplate = guildConfig.gameTemplates.find((gt) => gt.id === game.template);

        if (guildConfig.privateReminders) {
          try {
            const dmEmbed = new MessageEmbed();
            dmEmbed.setColor(gameTemplate && gameTemplate.embedColor ? gameTemplate.embedColor : guildConfig.embedColor);
            dmEmbed.setDescription(
              `${lang.game.REMINDER_FOR} **[${game.adventure.replace(/\*/gi, "")}](https://discordapp.com/channels/${game.discordGuild.id}/${game.discordChannel.id}/${
                game.messageId
              })**\n`
            );
            dmEmbed.addField(lang.game.WHEN, siLabel, true);
            if (game.discordGuild) dmEmbed.addField(lang.game.SERVER, game.discordGuild.name, true);
            dmEmbed.addField(lang.game.GM, dmMember ? dmMember.user.toString() : game.dm.tag, true);
            dmEmbed.addField(lang.game.WHERE, where);

            for (const member of reservedUsers) {
              try {
                if (member) member.send(dmEmbed);
                if (dmMember && dmMember.user && member && member.user && dmMember.user.id == member.user.id) dmMember = null;
              } catch (err) {
                aux.log("PrivateMemberReminderError:", member && member.user && member.user.tag, err);
              }
            }

            try {
              if (dmMember) dmMember.send(dmEmbed);
            } catch (err) {
              aux.log("PrivateGMReminderError:", dmMember && dmMember.user && dmMember.user.tag, err);
            }
          } catch (err) {
            aux.log("PrivateReminderError:", err);
          }
        } else {
          try {
            let message = `${lang.game.REMINDER_FOR} **${game.adventure.replace(/\*/gi, "")}**\n`;
            message += `**${lang.game.WHEN}:** ${siLabel}\n`;
            message += `**${lang.game.WHERE}:** ${where}\n\n`;
            message += `**${lang.game.GM}:** ${dm}\n`;
            message += `**${lang.game.RESERVED}:**\n`;
            message += `${reserved.join(`\n`)}`;

            try {
              var sent = <Message>await game.discordChannel.send(message);
            } catch (err) {
              aux.log("PublicReminderError:", err);
            }

            game.reminderMessageId = sent.id;

            game.save();
          } catch (err) {
            aux.log("PublicReminderSaveError:", err);
          }
        }
      } catch (err) {
        aux.log("GameReminderError:", err);
      }
    });
  }
};

const apiGuildIds: any = {};

const sendGuildsToAPI = (all: boolean = false, slice: number = null) => {
  let guilds = client.guilds.cache.array().filter((guild) => all || !apiGuildIds[guild.shardID] || !apiGuildIds[guild.shardID].includes(guild.id));
  const sliceLimit = Math.ceil(guilds.length / numSlices);
  if (slice !== null) guilds = guilds.slice(slice * sliceLimit, slice * sliceLimit + sliceLimit);
  if (guilds.length > 0) {
    aux.log("Refreshing data for", guilds.length, "guilds", `(Shard: ${guilds[0].shardID})`, slice !== null ? `(Slice: ${slice + 1})` : null);
    client.shard.send({
      type: "shard",
      name: "guilds",
      data: guilds.map(guildMap),
    });
  }
};

const guildMap = (guild: Guild) => {
  if (!apiGuildIds[guild.shardID]) apiGuildIds[guild.shardID] = [];
  if (!apiGuildIds[guild.shardID].includes(guild.id)) apiGuildIds[guild.shardID].push(guild.id);
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
      ].filter((check) => check),
    })),
    roles: guild.roles.cache.array(),
  };
};

const cmdFetchEvents = async (guild: ShardGuild | Guild, time: string, lang: any, sGuilds: ShardGuild[] = null) => {
  try {
    const start = new Date();
    const end = new Date(start);
    let timeframe = "";

    let param = time;
    if (!param) param = "24hr";
    if (param.match(/\d{1,3} ?h(ou)?rs?/)) {
      const hours = param.replace(/ ?h(ou)?rs?/, "");
      end.setHours(start.getHours() + parseInt(hours));
      timeframe = `${hours} hours`;
    }
    if (param.match(/\d{1,3} ?days?/)) {
      const days = param.replace(/ ?days?/, "");
      end.setDate(start.getDate() + parseInt(days));
      timeframe = `${days} days`;
    }
    if (param.match(/\d{1,3} ?weeks?/)) {
      const weeks = param.replace(/ ?weeks?/, "");
      end.setDate(start.getDate() + 7 * parseInt(weeks));
      timeframe = `${weeks} weeks`;
    }

    const games = await Game.fetchAllBy(
      {
        s: guild.id,
        $and: [{ timestamp: { $gt: start.getTime() } }, { timestamp: { $lte: end.getTime() } }],
      },
      sGuilds ? null : client,
      sGuilds ? sGuilds : null
    );

    games.sort((a, b) => {
      return a.timestamp > b.timestamp ? 1 : -1;
    });

    let response: MessageEmbed[] = [];

    if (games.length > 0) {
      moment.locale(lang.code);
      let embed = new MessageEmbed();
      const title = lang.config.EVENTS_TITLE.replace(/\:SERVER/g, guild.name).replace(/\:TIMEFRAME/g, timeframe);
      embed.setTitle(title);
      games.forEach((game, i) => {
        const date = Game.ISOGameDate(game);
        const timezone = "UTC" + (game.timezone >= 0 ? "+" : "") + game.timezone;
        const calendarDate = moment(date).utcOffset(game.timezone).calendar();
        // console.log(date, '||', moment(date).calendar(), '||', moment(date).utcOffset(0).calendar(), '||', moment(date).utcOffset(game.timezone).calendar());
        const gameDate = calendarDate.indexOf(" at ") >= 0 ? calendarDate : moment(date).format(config.formats[game.tz ? "dateLongTZ" : "dateLong"]);
        embed.addField(lang.game.GAME_NAME, `[${game.adventure}](https://discordapp.com/channels/${game.discordGuild.id}/${game.discordChannel.id}/${game.messageId})`, true);
        embed.addField(lang.game.WHEN, `${gameDate} (${timezone})`, true);
        embed.addField(lang.game.RESERVED, `${game.reserved.length} / ${game.players}`, true);

        if ((i + 1) % 6 === 0) {
          if (games.length > 6) embed.setFooter(`Page ${response.length + 1}`);
          response.push(embed);
          embed = new MessageEmbed();
          // embed.setTitle(title);
        }
      });

      if ((games.length + 1) % 6 !== 0) {
        if (games.length > 6) embed.setFooter(`Page ${response.length + 1}`);
        response.push(embed);
      }
    }

    moment.locale("en");

    return response;
  } catch (err) {
    return `${err.name}: ${err.message}`;
  }
};
