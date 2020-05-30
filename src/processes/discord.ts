import { TextChannel, Client, Message, User, GuildChannel, MessageEmbed, Permissions, Guild, GuildMember } from "discord.js";
import { DeleteWriteOpResultObject, FilterQuery, ObjectId, UpdateWriteOpResult } from "mongodb";

import { io } from "./socket";
import { GuildConfig, GuildConfigModel } from "../models/guild-config";
import { Game, GameMethod, gameReminderOptions } from "../models/game";
import config from "../models/config";
import aux from "../appaux";
import db from "../db";

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
    if (!connected) connected = await db.database.connect();
    if (connected) {
      aux.log("Database connected!");
    }
    if (process.env.BACKGROUND || process.env.ALLLOGIC) {
      refreshMessages();
      // Once per hour, prune games from the database that are more than 48 hours old
      pruneOldGames();
      setInterval(() => {
        pruneOldGames();
      }, 60 * 60 * 1000); // 1 hour
      // Once per hour, reschedule recurring games from the database that have already occurred
      if (process.env.RESCHEDULING) {
        rescheduleOldGames();
        setInterval(() => {
          rescheduleOldGames();
        }, 60 * 60 * 1000); // 1 hour
      }
      // Post Game Reminders
      if (process.env.REMINDERS) {
        // postReminders();
        setInterval(() => {
          postReminders();
        }, 1 * 60 * 1000); // 1 minute
      }
    }
  }
});

if (!process.env.BACKGROUND || process.env.ALLLOGIC) {
  /**
   * Discord.JS - message
   */
  client.on("message", async (message: Message) => {
    try {
      if (message.channel instanceof TextChannel) {
        let isCommand = false;
        for (let i = 1; i <= 3; i++) {
          isCommand = isCommand || message.content.startsWith(config.command, i);
        }

        if (isCommand) {
          const guild = message.channel.guild;
          const guildId = guild.id;
          const guildConfig = await GuildConfig.fetch(guildId);
          // const author: User = message.author;
          const member = message.member;

          if (process.env.LOCALENV && guildId != "532564186023329792") {
            return;
          }

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
              member.roles.cache.find((r) => r.name.toLowerCase().trim() === (guildConfig.managerRole || "").toLowerCase().trim())
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
                      ? `\n${lang.config.GENERAL_CONFIGURATION}\n` +
                        `\`${botcmd} configuration\` - ${lang.config.desc.CONFIGURATION}\n` +
                        `\`${botcmd} role role name\` - ${lang.config.desc.ROLE}\n` +
                        `\`${botcmd} manager-role role name\` - ${lang.config.desc.MANAGER_ROLE}\n` +
                        `\`${botcmd} password somepassword\` - ${lang.config.desc.PASSWORD_SET}\n` +
                        `\`${botcmd} password\` - ${lang.config.desc.PASSWORD_CLEAR}\n` +
                        `\`${botcmd} lang ${guildConfig.lang}\` - ${lang.config.desc.LANG} ${languages.map((l) => `\`${l.code}\` (${l.name})`).join(", ")}\n`
                      : ``) +
                    `\n${lang.config.USAGE}\n` +
                    (permission ? `\`${botcmd} link\` - ${lang.config.desc.LINK}` : ``)
                );
              (<TextChannel>message.channel).send(embed);
              let embed2 = new MessageEmbed()
                .setTitle("RPG Schedule Help")
                .setColor(guildConfig.embedColor)
                .setDescription(
                  isAdmin
                    ? `\n${lang.config.BOT_CONFIGURATION}\n` +
                        `\`${botcmd} embeds ${guildConfig.embeds || guildConfig.embeds == null ? "on" : "off"}\` - \`on/off\` - ${lang.config.desc.EMBEDS}\n` +
                        `\`${botcmd} embed-color ${guildConfig.embedColor}\` - ${lang.config.desc.EMBED_COLOR}\n` +
                        `\`${botcmd} embed-user-tags ${guildConfig.embedMentions || guildConfig.embedMentions == null ? "on" : "off"}\` - \`on/off\` - ${
                          lang.config.desc.EMBED_USER_TAGS
                        }\n` +
                        `\`${botcmd} emoji-sign-up ${guildConfig.emojiAdd}\` - ${lang.config.desc.EMOJI}\n` +
                        `\`${botcmd} emoji-drop-out ${guildConfig.emojiRemove}\` - ${lang.config.desc.EMOJI}\n` +
                        `\`${botcmd} drop-outs ${guildConfig.dropOut || guildConfig.dropOut == null ? "on" : "off"}\` - \`on/off\` - ${lang.config.desc.TOGGLE_DROP_OUT}\n` +
                        `\`${botcmd} prefix-char ${prefix}\` - ${lang.config.desc.PREFIX.replace(/\:CHAR/gi, prefix)}\n`
                    : ``
                );
              if (isAdmin) (<TextChannel>message.channel).send(embed2);
              let embed3 = new MessageEmbed()
                .setTitle("RPG Schedule Help")
                .setColor(guildConfig.embedColor)
                .setDescription(
                  isAdmin
                    ? `\n${lang.config.GAME_CONFIGURATION}\n` +
                        `\`${botcmd} add-channel #channel-name\` - ${lang.config.desc.ADD_CHANNEL}\n` +
                        `\`${botcmd} remove-channel #channel-name\` - ${lang.config.desc.REMOVE_CHANNEL}\n` +
                        `\`${botcmd} pruning ${guildConfig.pruning ? "on" : "off"}\` - \`on/off\` - ${lang.config.desc.PRUNING}\n` +
                        `\`${botcmd} prune\` - ${lang.config.desc.PRUNE}\n` +
                        `\`${botcmd} private-reminders ${guildConfig.privateReminders ? "on" : "off"}\` - \`on/off\` - ${lang.config.desc.PRIVATE_REMINDERS}\n` +
                        `\`${botcmd} reschedule-mode ${guildConfig.rescheduleMode}\` - ${lang.config.desc.RESCHEDULE_MODE}\n`
                    : ``
                );
              if (isAdmin) (<TextChannel>message.channel).send(embed3);
            } else if (cmd === "link" && permission) {
              (<TextChannel>message.channel).send(process.env.HOST + config.urls.game.create.path + "?s=" + guildId);
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
                const channel: string = params[0].replace(/\<\#|\>/g, "");
                const channels = guildConfig.channels;
                channels.push({ channelId: channel, gameTemplates: [guildConfig.defaultGameTemplate.id] });
                guildConfig
                  .save({
                    channel: channels,
                  })
                  .then((result) => {
                    (<TextChannel>message.channel).send(`${lang.config.CHANNEL_ADDED}`);
                  })
                  .catch((err) => {
                    aux.log(err);
                  });
              }
            } else if (cmd === "remove-channel" && isAdmin) {
              if (params[0]) {
                const channel: string = params[0].replace(/\<\#|\>/g, "");
                const channels = guildConfig.channels;
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
                    (<TextChannel>message.channel).send(`${lang.config.CHANNEL_REMOVED}`);
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
                    (<TextChannel>message.channel).send(params[0] === "on" ? lang.config.PRUNING_ON : lang.config.PRUNING_OFF);
                  })
                  .catch((err) => {
                    aux.log(err);
                  });
              }
            } else if (cmd === "prune" && isAdmin) {
              await pruneOldGames(message.guild);
              (<TextChannel>message.channel).send(lang.config.PRUNE);
            } else if (cmd === "embeds" && isAdmin) {
              if (params[0]) {
                guildConfig
                  .save({
                    embeds: !(params[0] === "off"),
                  })
                  .then((result) => {
                    (<TextChannel>message.channel).send(!(params[0] === "off") ? lang.config.EMBEDS_ON : lang.config.EMBEDS_OFF);
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
                    (<TextChannel>message.channel).send(!(params[0] === "off") ? lang.config.EMBED_USER_TAGS_ON : lang.config.EMBED_USER_TAGS_OFF);
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
              } else if (!color.match(/[0-9a-f]{3}|[0-9a-f]{6}/i)) {
                (<TextChannel>message.channel).send(lang.config.desc.EMBED_COLOR_ERROR);
                return;
              }
              const save: GuildConfigModel = {};
              save.embedColor = "#" + color.match(/[0-9a-f]{3}|[0-9a-f]{6}/i)[0];
              guildConfig
                .save(save)
                .then((result) => {
                  let embed = new MessageEmbed()
                    .setColor("#" + color.match(/[0-9a-f]{3}|[0-9a-f]{6}/i)[0])
                    .setDescription(`${lang.config.EMBED_COLOR_SET} \`#${color.match(/[0-9a-f]{3}|[0-9a-f]{6}/i)[0]}\`.`);
                  (<TextChannel>message.channel).send(embed);
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "emoji-sign-up" && isAdmin) {
              const emoji = params.join(" ");
              if (!aux.isEmoji(emoji) || (emoji.length > 2 && emoji.match(/\:[^\:]+\:/))) {
                (<TextChannel>message.channel).send(lang.config.desc.EMOJI_ERROR.replace(/\:char/gi, emoji.replace(/\<|\>/g, "")));
                return;
              }
              guildConfig
                .save({
                  emojiAdd: emoji,
                })
                .then((result) => {
                  (<TextChannel>message.channel).send(lang.config.EMOJI_JOIN_SET);
                  guildConfig.emojiAdd = emoji;
                  guildConfig.updateReactions(client);
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "emoji-drop-out" && isAdmin) {
              const emoji = params.join(" ");
              if (!aux.isEmoji(emoji) || (emoji.length > 2 && emoji.match(/\:[^\:]+\:/))) {
                (<TextChannel>message.channel).send(lang.config.desc.EMOJI_ERROR.replace(/\:char/gi, emoji.replace(/\<|\>/g, "")));
                return;
              }
              await guildConfig
                .save({
                  emojiRemove: emoji,
                })
                .then((result) => {
                  (<TextChannel>message.channel).send(lang.config.EMOJI_LEAVE_SET);
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
                  (<TextChannel>message.channel).send(lang.config.PREFIX_CHAR.replace(/\:CMD/gi, `${prefix.length ? prefix : "!"}${config.command}`));
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
                  (<TextChannel>message.channel).send(!guildConfig.privateReminders ? lang.config.PRIVATE_REMINDERS_ON : lang.config.PRIVATE_REMINDERS_OFF);
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
                  (<TextChannel>message.channel).send(lang.config.RESCHEDULE_MODE_UPDATED);
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "reschedule" && isAdmin) {
              await rescheduleOldGames(message.guild.id);
            } else if (cmd === "password" && isAdmin) {
              guildConfig
                .save({
                  password: params.join(" "),
                })
                .then((result) => {
                  (<TextChannel>message.channel).send(lang.config.PASSWORD_SET);
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
                  (<TextChannel>message.channel).send(guildConfig.dropOut === false ? lang.config.DROP_OUTS_ENABLED : lang.config.DROP_OUTS_DISABLED);
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "role" && isAdmin) {
              const mentioned = (params[0] || "").match(/(\d+)/);
              let roleName = params.join(" ");
              if (roleName.trim() === "All Roles") {
                roleName = "";
              }
              if (mentioned) {
                const roleId = mentioned[0];
                const role = guild.roles.cache.array().find((r) => r.id === roleId);
                if (role) roleName = role.name;
              }
              const save: GuildConfigModel = {};
              save.role = roleName == "" ? null : roleName;
              guildConfig
                .save(save)
                .then((result) => {
                  (<TextChannel>message.channel).send(roleName.length > 0 ? lang.config.ROLE_SET.replace(/\:role/gi, roleName) : lang.config.ROLE_CLEARED);
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "manager-role" && isAdmin) {
              const mentioned = (params[0] || "").match(/(\d+)/);
              let roleName = params.join(" ");
              if (mentioned) {
                const roleId = mentioned[0];
                const role = guild.roles.cache.array().find((r) => r.id === roleId);
                if (role) roleName = role.name;
              }
              guildConfig
                .save({
                  managerRole: roleName == "" ? null : roleName,
                })
                .then((result) => {
                  (<TextChannel>message.channel).send(roleName.length > 0 ? lang.config.ROLE_SET.replace(/\:role/gi, roleName) : lang.config.ROLE_CLEARED);
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else if (cmd === "lang" && isAdmin) {
              const newLang = languages.find((l) => l.code === params[0].trim());
              if (!newLang) {
                return (<TextChannel>message.channel).send(lang.config.NO_LANG);
              }
              guildConfig
                .save({
                  lang: newLang.code,
                })
                .then((result) => {
                  (<TextChannel>message.channel).send(newLang.config.LANG_SET.replace(/\:lang/gi, newLang.name));
                })
                .catch((err) => {
                  aux.log(err);
                });
            } else {
              const response = await (<TextChannel>message.channel).send("Command not recognized");
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
      const message = reaction.message;
      const channelId = message.channel.id;
      if (process.env.LOCALENV && channelId != "532564186023329794") {
        return;
      }
      const game = await Game.fetchBy("messageId", message.id, client);
      if (game.method !== GameMethod.AUTOMATED) return;
      if (game && user.id !== message.author.id) {
        const guildConfig = await GuildConfig.fetch(game.s);
        if (reaction.emoji.name === guildConfig.emojiAdd) {
          reaction.users.remove(user);
          game.signUp(user);
        }
        if (reaction.emoji.name === guildConfig.emojiRemove) {
          reaction.users.remove(user);
          game.dropOut(user, guildConfig);
        }
      }
    } catch (err) {}
  });

  client.on("userUpdate", async (oldUser: User, newUser: User) => {
    if (process.env.LOCALENV) return;
    // aux.log(aux.backslash(oldUser.tag));
    if (oldUser.tag != newUser.tag) {
      const games = await Game.fetchAllBy({ $or: [{ dm: oldUser.tag }, { reserved: new RegExp(aux.backslash(oldUser.tag), "gi") }] }, client);
      games.forEach(async (game) => {
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

  /**
   * Discord.JS - messageDelete
   * Delete the game from the database when the announcement message is deleted
   */
  client.on("messageDelete", async (message) => {
    if (message.author.id !== client.user.id) return;
    const games = await Game.fetchAllBy(
      {
        messageId: message.id,
        pruned: {
          $in: [false, null],
        },
      },
      client
    );
    games.forEach((game) => {
      if (game && message.channel instanceof TextChannel) {
        game.delete().then((result) => {
          aux.log("Game deleted");
        });
      }
    });
  });

  /**
   * Discord.JS - channelDelete
   * Delete the games in the channel and remove the channel id from the guild configuration
   */
  client.on("channelDelete", async (channel: GuildChannel) => {
    const channelId = channel.id;
    const guildId = channel.guild.id;
    const guildConfig = await GuildConfig.fetch(guildId);
    if (guildConfig.channels.find((c) => c.channelId === channelId)) {
      guildConfig.channel.splice(
        guildConfig.channel.findIndex((c) => c.channelId === channelId),
        1
      );
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
    const channel = <TextChannel>client.channels.cache.get(data.channel_id) || (await user.createDM());

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
  });

  client.on("invalidated", () => {
    aux.log("Client: Invalidated");
    // setTimeout(() => {
    //   discordLogin(client);
    // }, 60 * 1000);
  });
}

(async () => {
  let connected = await db.database.connect();
  if (connected) {
    aux.log("Database connected!");
    // Login the Discord bot
    client.login(process.env.TOKEN);
  }
})();

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
      $and: [
        {
          frequency: {
            $ne: "0",
          },
        },
        {
          frequency: {
            $ne: null,
          },
        },
      ],
      $or: [
        {
          rescheduled: false,
        },
        {
          rescheduled: null,
        },
      ],
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
          } catch (err) {
            const newGames = await Game.fetchAllBy(
              {
                s: game.s,
                c: game.c,
                adventure: game.adventure,
                date: {
                  $ne: game.date,
                },
                time: game.time,
              },
              client
            );
            if (newGames.length > 0) {
              await game.delete();
            }
          }
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
  let result: DeleteWriteOpResultObject;
  try {
    aux.log(`Pruning old games for ${guild ? `${guild.name} server` : "all servers"}`);
    const query: FilterQuery<any> = {
      timestamp: {
        $lt: new Date().getTime() - 48 * 3600 * 1000,
      },
      hideDate: {
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
      const guildConfigs = await GuildConfig.fetchAllBy({
        pruning: true,
        guild: guild
          ? guild.id
          : {
              $in: games.map((g) => g.s).filter((s, i, arr) => arr.indexOf(s) === i),
            },
      });
      const gameChannelMessages: { guild: string; channel: string; message: string }[] = [];
      const prunedIds = [];
      const deletedIds = [];
      for (let i = 0; i < games.length; i++) {
        let game = games[i];
        if (!game.discordGuild) continue;
        if (guild && game.discordGuild.id !== guild.id) continue;

        try {
          const guildConfig = guildConfigs.find((gc) => gc.guild === game.s) || new GuildConfig();
          if (!guildConfig) continue;

          if (guildConfig.pruning && !game.pruned && game.discordChannel && new Date().getTime() - game.timestamp >= guildConfig.pruneIntDiscord * 24 * 3600 * 1000) {
            if (game.messageId) {
              if (guildConfig.pruneIntDiscord < guildConfig.pruneIntEvents && new Date().getTime() - game.timestamp < guildConfig.pruneIntEvents * 24 * 3600 * 1000) {
                prunedIds.push(game._id);
                io().emit("game", { action: "pruned", gameId: game._id });
              } else {
                deletedIds.push(game._id);
                io().emit("game", { action: "deleted", gameId: game._id });
              }
              gameChannelMessages.push({ guild: game.s, channel: game.c, message: game.messageId });
            }
            if (game.reminderMessageId) {
              gameChannelMessages.push({ guild: game.s, channel: game.c, message: game.messageId });
            }
            // if (game.pm) {
            //   const m = game.discordGuild.members.find(m => m.user.tag === game.dm.tag || m.user.id === game.dm.id);
            //   if (m && m.user.dmChannel) {
            //     const msg = m.user.dmChannel.messages.resolve(game.pm);
            //     if (msg) await msg.delete();
            //   }
            // }
          } else if (new Date().getTime() - game.timestamp >= guildConfig.pruneIntEvents * 24 * 3600 * 1000) {
            deletedIds.push(game._id);
            io().emit("game", { action: "deleted", gameId: game._id });
          }
        } catch (err) {
          aux.log("MessagePruningError:", err);
        }
      }

      const updateResult = await Game.updateAllBy(
        {
          ...query,
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
            messageId: null,
            reminderMessageId: null,
            pm: null,
          },
        }
      );
      if ((<UpdateWriteOpResult>updateResult).modifiedCount > 0) aux.log(`${(<UpdateWriteOpResult>updateResult).modifiedCount} old game(s) pruned from Discord only`);

      result = await Game.deleteAllBy({
        ...query,
        _id: {
          $in: deletedIds.map((pid) => new ObjectId(pid)),
        },
      });
      if (result.deletedCount > 0) aux.log(`${result.deletedCount} old game(s) successfully pruned`);

      let count = 0;

      for (let gci = 0; gci < guildConfigs.length; gci++) {
        const gc = guildConfigs[gci];
        const guild = client.guilds.cache.find((g) => g.id === gc.guild);
        const channels = <TextChannel[]>guild.channels.cache.array().filter((c) => gc.channels.find((gcc) => gcc.channelId === c.id) && c instanceof TextChannel);
        for (let ci = 0; ci < channels.length; ci++) {
          const c = channels[ci];
          const messages = await c.messages.fetch({ limit: 100 });
          if (messages.size === 0) continue;
          const clientMessages = messages
            .array()
            .filter(
              (m) =>
                m.embeds.filter((e) => new Date().getTime() - e.timestamp >= gc.pruneIntDiscord * 24 * 3600 * 1000).length > 0 &&
                m.author.id === client.user.id &&
                m.deletable &&
                !m.deleted
            );
          for (let i = 0; i < gameChannelMessages.length; i++) {
            const msg = gameChannelMessages[i];
            if (guild.id === msg.guild && c.id === msg.channel && !clientMessages.find((cm) => cm.id === msg.message)) {
              const chm = await c.messages.resolve(msg.message);
              if (chm) clientMessages.push(chm);
            }
          }
          if (clientMessages.length === 0) continue;
          try {
            const deleted = await c.bulkDelete(clientMessages);
            count += deleted.size;
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
  return result;
};

const postReminders = async () => {
  const cTime = new Date().getTime();
  const reminderOptions = gameReminderOptions;
  const remExprs = reminderOptions.map((r) => {
    const rt = parseInt(r);
    return {
      reminder: r,
      timestamp: {
        $lte: cTime + rt * 60 * 1000,
      },
    };
  });

  const query: FilterQuery<any> = {
    when: "datetime",
    timestamp: {
      $gt: cTime,
    },
    $and: [
      {
        $or: remExprs,
      },
      {
        reminded: {
          $in: [false, null],
        },
      },
    ],
  };

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
      if (!game.discordGuild) return false;
      if (!game.discordChannel) return false;
      if (game.reminded) return false;
      return true;
    });
    totalGames += filteredGames.length;
    if (page === pages) aux.log(`Posting reminders for ${totalGames} games`);
    filteredGames.forEach(async (game) => {
      try {
        const reserved: string[] = [];
        const reservedUsers: GuildMember[] = [];

        try {
          const guildMembers = await game.discordGuild.members;

          var where = game.where;
          game.reserved.forEach((rsvp) => {
            if (rsvp.tag.length === 0) return;
            let member = guildMembers.find((mem) => mem.user.tag === rsvp.tag.replace("@", "") || rsvp.id === member.user.id);

            let name = rsvp.tag.replace("@", "");
            if (member) name = member.user.toString();
            if (member) reservedUsers.push(member);

            if (reserved.length < parseInt(game.players)) {
              reserved.push(name);
            }
          });

          const member = guildMembers.find((mem) => mem.user.tag === game.dm.tag.trim().replace("@", "") || mem.user.id === game.dm.id);
          var dm = game.dm.tag.trim().replace("@", "");
          var dmMember = member;
          if (member) dm = member.user.toString();
        } catch (err) {}

        if (reserved.length == 0) return;

        let minPlayers = parseInt(game.minPlayers);
        if (!isNaN(parseInt(game.minPlayers))) minPlayers = 0;
        if (reserved.length < minPlayers) return;

        const message = await game.discordChannel.messages.fetch(game.messageId);
        if (!message || (message && message.author.id !== process.env.CLIENT_ID)) return false;

        try {
          game.reminded = true;
          game.save(true);
        } catch (err) {
          aux.log("RemindedSaveError", game._id, err);
          return;
        }

        const channels = game.where.match(/#[a-z0-9\-_]+/gi);
        if (channels) {
          channels.forEach((chan) => {
            const guildChannel = game.discordGuild.channels.find((c) => c.name === chan.replace(/#/, ""));
            if (guildChannel) {
              where = game.where.replace(chan, guildChannel.toString());
            }
          });
        }

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
            dmEmbed.addField(lang.game.GM, dmMember ? (dmMember.nickname ? dmMember.nickname : dmMember.user && dmMember.user.username) : game.dm, true);
            dmEmbed.addField(lang.game.WHERE, where);

            for (const member of reservedUsers) {
              try {
                if (member) member.send(dmEmbed);
                if (dmMember && dmMember.user && member && member.user && dmMember.user.username == member.user.username) dmMember = null;
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
