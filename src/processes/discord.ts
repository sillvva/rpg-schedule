import discord, { TextChannel, Client, Message, UserResolvable, User } from "discord.js";
import { DeleteWriteOpResultObject, FilterQuery, ObjectID } from "mongodb";
import { Express } from "express";

import { io } from "../processes/socket";
import { GuildConfig } from "../models/guild-config";
import { Game } from "../models/game";
import config from "../models/config";
import aux from "../appaux";

let client: Client;
type DiscordProcessesOptions = {
  app: Express;
};

const discordProcesses = (options: DiscordProcessesOptions, readyCallback: () => {}) => {
  client = new discord.Client();
  const app = options.app;

  client.on("debug", function(info) {
    if (info.indexOf("hit on route") >= 0) return;
    if (info.indexOf("Sending a heartbeat") >= 0) return;
    if (info.indexOf("Heartbeat acknowledged") >= 0) return;
    aux.log(info);
  })

  /**
   * Discord.JS - ready
   */
  client.on("ready", () => {
    aux.log(`Logged in as ${client.user.username}!`);
    readyCallback();
  });

  /**
   * Discord.JS - message
   */
  client.on("message", async (message: Message) => {
    try {
      if (message.channel instanceof TextChannel) {
        let isCommand = false;
        for(let i = 1; i <= 3; i++) {
          isCommand = isCommand || message.content.startsWith(config.command, i);
        }

        if (isCommand) {
          const guild = message.channel.guild;
          const guildId = guild.id;
          const guildConfig = await GuildConfig.fetch(guildId);
          let author: User = message.author;

          if (process.env.LOCALENV && guildId != "532564186023329792") {
            return;
          }
  
          const prefix = (guildConfig.escape || "").trim().length ? guildConfig.escape.trim() : '!';
          const botcmd = `${prefix}${config.command}`;
          if (!message.content.startsWith(botcmd)) return;

          const parts = message.content.trim().split(" ").filter(part => part.length > 0);
          const cmd = parts.slice(1,2)[0];
          const params = parts.slice(2);

          const languages = app.locals.langs;
          const lang = languages.find(l => l.code === guildConfig.lang) || languages.find(l => l.code === "en");

          if (!message.channel.guild) {
            message.reply(lang.config.desc.SERVER_COMMAND);
            return;
          }

          const member = message.channel.guild.members.cache.array().find(m => m.user.id === message.author.id);
          const canConfigure = member ? member.hasPermission(discord.Permissions.FLAGS.MANAGE_GUILD) : false;

          if (cmd === "help" || message.content.trim().split(" ").length === 1) {
            let embed = new discord.MessageEmbed()
              .setTitle("RPG Schedule Help")
              .setColor(guildConfig.embedColor)
              .setDescription(
                `__**${lang.config.COMMAND_LIST}**__\n` +
                  `\`${botcmd}\` - ${lang.config.desc.HELP}\n` +
                  `\`${botcmd} help\` - ${lang.config.desc.HELP}\n` +
                  (canConfigure
                    ? `\n${lang.config.GENERAL_CONFIGURATION}\n` +
                      (canConfigure ? `\`${botcmd} configuration\` - ${lang.config.desc.CONFIGURATION}\n` : ``) +
                      (canConfigure ? `\`${botcmd} role role name\` - ${lang.config.desc.ROLE}\n` : ``) +
                      (canConfigure ? `\`${botcmd} manager-role role name\` - ${lang.config.desc.MANAGER_ROLE}\n` : ``) +
                      (canConfigure ? `\`${botcmd} password somepassword\` - ${lang.config.desc.PASSWORD_SET}\n` : ``) +
                      (canConfigure ? `\`${botcmd} password\` - ${lang.config.desc.PASSWORD_CLEAR}\n` : ``) +
                      (canConfigure
                        ? `\`${botcmd} lang ${guildConfig.lang}\` - ${lang.config.desc.LANG} ${languages.map(l => `\`${l.code}\` (${l.name})`).join(", ")}\n`
                        : ``) +
                      `\n${lang.config.BOT_CONFIGURATION}\n` +
                      (canConfigure
                        ? `\`${botcmd} embeds ${guildConfig.embeds || guildConfig.embeds == null ? "on" : "off"}\` - \`on/off\` - ${lang.config.desc.EMBEDS}\n`
                        : ``) +
                      (canConfigure ? `\`${botcmd} embed-color ${guildConfig.embedColor}\` - ${lang.config.desc.EMBED_COLOR}\n` : ``) +
                      (canConfigure
                        ? `\`${botcmd} embed-user-tags ${guildConfig.embedMentions || guildConfig.embedMentions == null ? "on" : "off"}\` - \`on/off\` - ${lang.config.desc.EMBED_USER_TAGS}\n`
                        : ``) +
                      (canConfigure ? `\`${botcmd} emoji-sign-up ${guildConfig.emojiAdd}\` - ${lang.config.desc.EMOJI}\n` : ``) +
                      (canConfigure ? `\`${botcmd} emoji-drop-out ${guildConfig.emojiRemove}\` - ${lang.config.desc.EMOJI}\n` : ``) +
                      (canConfigure ? `\`${botcmd} toggle-drop-out\` - ${lang.config.desc.TOGGLE_DROP_OUT}\n` : ``) +
                      (canConfigure ? `\`${botcmd} prefix-char ${prefix}\` - ${lang.config.desc.PREFIX.replace(/\:CHAR/gi, prefix)}\n` : ``) +
                      `\n${lang.config.GAME_CONFIGURATION}\n` +
                      (canConfigure ? `\`${botcmd} add-channel #channel-name\` - ${lang.config.desc.ADD_CHANNEL}\n` : ``) +
                      (canConfigure ? `\`${botcmd} remove-channel #channel-name\` - ${lang.config.desc.REMOVE_CHANNEL}\n` : ``) +
                      (canConfigure ? `\`${botcmd} pruning ${guildConfig.pruning ? "on" : "off"}\` - \`on/off\` - ${lang.config.desc.PRUNING}\n` : ``) +
                      (canConfigure ? `\`${botcmd} prune\` - ${lang.config.desc.PRUNE}\n` : ``) +
                      (canConfigure
                        ? `\`${botcmd} private-reminders\` - ${lang.config.desc.PRIVATE_REMINDERS.replace(/\:PR/gi,guildConfig.privateReminders ? "on" : "off")}\n`
                        : ``) +
                      (canConfigure ? `\`${botcmd} rechedule-mode ${guildConfig.rescheduleMode}\` - ${lang.config.desc.RESCHEDULE_MODE}\n` : ``)
                    : ``) +
                  `\n${lang.config.USAGE}\n` +
                  `\`${botcmd} link\` - ${lang.config.desc.LINK}`
              );
            (<TextChannel>message.channel).send(embed);
          } else if (cmd === "link") {
            (<TextChannel>message.channel).send(process.env.HOST + config.urls.game.create.path + "?s=" + guildId);
          } else if (cmd === "prune") {
            await pruneOldGames(message.guild);
            (<TextChannel>message.channel).send(lang.config.PRUNE);
          } else if (cmd === "configuration") {
            if (canConfigure) {
              const channel = guildConfig.channels.map(c => {
                return guild.channels.cache.get(c);
              }) || [guild.channels.cache.array().find(c => c instanceof TextChannel)];

              let embed = new discord.MessageEmbed()
                .setTitle(`RPG Schedule ${lang.config.CONFIGURATION}`)
                .setColor(guildConfig.embedColor)
                .setDescription(
                  `${lang.config.PREFIX}: ${prefix.length ? prefix : "!"}${config.command}\n` +
                  `${lang.config.GUILD}: \`${guild.name}\`\n` +
                    `${lang.config.CHANNELS}: \`${channel
                      .filter(c => c)
                      .map(c => c.name)
                      .join(" | ")}\`\n` +
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
              if (author.dmChannel) author.dmChannel.send(embed);
            }
          } else if (cmd === "add-channel") {
            if (canConfigure && params[0]) {
              const channel: string = params[0].replace(/\<\#|\>/g, "");
              const channels = guildConfig.channels;
              channels.push(channel);
              guildConfig
                .save({
                  channel: channels
                })
                .then(result => {
                  (<TextChannel>message.channel).send(`${lang.config.CHANNEL_ADDED}`);
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "remove-channel") {
            if (canConfigure && params[0]) {
              const channel: string = params[0].replace(/\<\#|\>/g, "");
              const channels = guildConfig.channels;
              if (channels.indexOf(channel) >= 0) {
                channels.splice(channels.indexOf(channel), 1);
              }
              guildConfig
                .save({
                  channel: channels
                })
                .then(result => {
                  (<TextChannel>message.channel).send(`${lang.config.CHANNEL_REMOVED}`);
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "pruning") {
            if (canConfigure && params[0]) {
              guildConfig
                .save({
                  pruning: params[0] === "on"
                })
                .then(result => {
                  (<TextChannel>message.channel).send(params[0] === "on" ? lang.config.PRUNING_ON : lang.config.PRUNING_OFF);
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "embeds") {
            if (canConfigure && params[0]) {
              guildConfig
                .save({
                  embeds: !(params[0] === "off")
                })
                .then(result => {
                  (<TextChannel>message.channel).send(!(params[0] === "off") ? lang.config.EMBEDS_ON : lang.config.EMBEDS_OFF);
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "embed-user-tags") {
            if (canConfigure && params[0]) {
              guildConfig
                .save({
                  embedMentions: !(params[0] === "off")
                })
                .then(result => {
                  (<TextChannel>message.channel).send(!(params[0] === "off") ? lang.config.EMBED_USER_TAGS_ON : lang.config.EMBED_USER_TAGS_OFF);
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "embed-color") {
            if (canConfigure) {
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
                yellowgreen: "#9acd32"
              };
              if (colors[color]) {
                color = colors[color];
              } else if (!color.match(/[0-9a-f]{6}/i)) {
                (<TextChannel>message.channel).send(lang.config.desc.EMBED_COLOR_ERROR);
                return;
              }
              guildConfig
                .save({
                  embedColor: "#" + color.match(/[0-9a-f]{6}/i)[0]
                })
                .then(result => {
                  let embed = new discord.MessageEmbed()
                    .setColor("#" + color.match(/[0-9a-f]{6}/i)[0])
                    .setDescription(`${lang.config.EMBED_COLOR_SET} \`#"+color.match(/[0-9a-f]{6}/i)[0]+"\`.`);
                  (<TextChannel>message.channel).send(embed);
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "emoji-sign-up") {
            if (canConfigure) {
              const emoji = params.join(" ");
              if (!aux.isEmoji(emoji) || (emoji.length > 2 && emoji.match(/\:[^\:]+\:/))) {
                (<TextChannel>message.channel).send(lang.config.desc.EMOJI_ERROR.replace(/\:char/gi, emoji.replace(/\<|\>/g, "")));
                return;
              }
              guildConfig
                .save({
                  emojiAdd: emoji
                })
                .then(result => {
                  (<TextChannel>message.channel).send(lang.config.EMOJI_JOIN_SET);
                  guildConfig.emojiAdd = emoji;
                  guildConfig.updateEmojis();
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "emoji-drop-out") {
            if (canConfigure) {
              const emoji = params.join(" ");
              if (!aux.isEmoji(emoji) || (emoji.length > 2 && emoji.match(/\:[^\:]+\:/))) {
                (<TextChannel>message.channel).send(lang.config.desc.EMOJI_ERROR.replace(/\:char/gi, emoji.replace(/\<|\>/g, "")));
                return;
              }
              await guildConfig
                .save({
                  emojiRemove: emoji
                })
                .then(result => {
                  (<TextChannel>message.channel).send(lang.config.EMOJI_LEAVE_SET);
                  guildConfig.emojiRemove = emoji;
                  guildConfig.updateEmojis();
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "prefix-char") {
            if (canConfigure) {
              let prefix = params.join("").trim().slice(0,3);
              guildConfig
                .save({
                  escape: prefix.length ? prefix : "!"
                })
                .then(result => {
                  (<TextChannel>message.channel).send(lang.config.PREFIX_CHAR.replace(/\:CMD/gi, `${prefix.length ? prefix : "!"}${config.command}`));
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "private-reminders") {
            if (canConfigure) {
              guildConfig
                .save({
                  privateReminders: !guildConfig.privateReminders
                })
                .then(result => {
                  (<TextChannel>message.channel).send(!guildConfig.privateReminders ? lang.config.PRIVATE_REMINDERS_ON : lang.config.PRIVATE_REMINDERS_OFF);
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "reschedule-mode") {
            if (canConfigure) {
              let mode = params.join("").trim();
              const options = ["update","repost"];
              guildConfig
                .save({
                  rescheduleMode: options.includes(mode) ? mode : "repost"
                })
                .then(result => {
                  (<TextChannel>message.channel).send(lang.config.RESCHEDULE_MODE_UPDATED);
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          // } else if (cmd === "reschedule") {
            // rescheduleOldGames(guildId);
          } else if (cmd === "password") {
            if (canConfigure) {
              guildConfig
                .save({
                  password: params.join(" ")
                })
                .then(result => {
                  (<TextChannel>message.channel).send(lang.config.PASSWORD_SET);
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "toggle-drop-out") {
            if (canConfigure) {
              guildConfig
                .save({
                  dropOut: guildConfig.dropOut === false
                })
                .then(result => {
                  (<TextChannel>message.channel).send(guildConfig.dropOut === false ? lang.config.DROP_OUTS_ENABLED : lang.config.DROP_OUTS_DISABLED);
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "role") {
            const mentioned = (params[0] || "").match(/(\d+)/);
            let roleName = params.join(" ");
            if (roleName.trim() === "All Roles") {
              roleName = "";
            }
            if (mentioned) {
              const roleId = mentioned[0];
              const role = guild.roles.cache.get(roleId);
              if (role) roleName = role.name;
            }
            if (canConfigure) {
              guildConfig
                .save({
                  role: roleName == "" ? null : roleName
                })
                .then(result => {
                  (<TextChannel>message.channel).send(roleName.length > 0 ? lang.config.ROLE_SET.replace(/\:role/gi, roleName) : lang.config.ROLE_CLEARED);
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "manager-role") {
            const mentioned = (params[0] || "").match(/(\d+)/);
            let roleName = params.join(" ");
            if (mentioned) {
              const roleId = mentioned[0];
              const role = guild.roles.cache.get(roleId);
              if (role) roleName = role.name;
            }
            if (canConfigure) {
              guildConfig
                .save({
                  managerRole: roleName == "" ? null : roleName
                })
                .then(result => {
                  (<TextChannel>message.channel).send(roleName.length > 0 ? lang.config.ROLE_SET.replace(/\:role/gi, roleName) : lang.config.ROLE_CLEARED);
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else if (cmd === "lang") {
            const newLang = languages.find(l => l.code === params[0].trim());
            if (!newLang) {
              return (<TextChannel>message.channel).send(lang.config.NO_LANG);
            }
            if (canConfigure) {
              guildConfig
                .save({
                  lang: newLang.code
                })
                .then(result => {
                  (<TextChannel>message.channel).send(newLang.config.LANG_SET.replace(/\:lang/gi, newLang.name));
                })
                .catch(err => {
                  aux.log(err);
                });
            }
          } else {
            (<TextChannel>message.channel).send('Command not recognized');
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
      const game = await Game.fetchBy("messageId", message.id);
      if (game && user.id !== message.author.id) {
        const guildConfig = await GuildConfig.fetch(game.s);
        if (reaction.emoji.name === guildConfig.emojiAdd) {
          reaction.users.remove(<UserResolvable>user);
          if (game.reserved.indexOf(user.tag) < 0) {
            game.reserved = [...game.reserved.trim().split(/\r?\n/), user.tag].join("\n");
            if (game.reserved.startsWith("\n")) game.reserved = game.reserved.substr(1);
            game.save();
          }
        }
        if (reaction.emoji.name === guildConfig.emojiRemove) {
          reaction.users.remove(<UserResolvable>user);
          if (game.reserved.indexOf(user.tag) >= 0 && guildConfig.dropOut) {
            game.reserved = game.reserved
              .split(/\r?\n/)
              .filter(tag => tag !== user.tag)
              .join("\n");
            game.save();
          }
        }
      }
    } catch (err) {
    }
  });

  client.on("userUpdate", async (oldUser: User, newUser: User) => {
    if (process.env.LOCALENV) return;
    // aux.log(aux.backslash(oldUser.tag));
    if (oldUser.tag != newUser.tag) {
      const games = await Game.fetchAllBy({ $or: [ { dm: oldUser.tag }, { reserved: new RegExp(aux.backslash(oldUser.tag), "gi") } ] });
      games.forEach(game => {
        // aux.log(game.adventure);
        if (game.dm === oldUser.tag) game.dm = newUser.tag;
        if (game.reserved.includes(oldUser.tag)) game.reserved = game.reserved.replace(new RegExp(aux.backslash(oldUser.tag), "gi"), newUser.tag);
        game.save();
      });
    }
  });

  /**
   * Discord.JS - messageDelete
   * Delete the game from the database when the announcement message is deleted
   */
  client.on("messageDelete", async message => {
    const game = await Game.fetchBy("messageId", message.id);
    if (game && message.channel instanceof TextChannel) {
      if (process.env.LOCALENV && message.channel.guild.id != "532564186023329792") return;
      game.delete().then(result => {
        aux.log("Game deleted");
      });
    }
  });

  /**
   * Add events to non-cached messages
   */
  const events = {
    MESSAGE_REACTION_ADD: "messageReactionAdd",
    MESSAGE_REACTION_REMOVE: "messageReactionRemove"
  };

  client.on("raw", async (event: any) => {
    if (!events.hasOwnProperty(event.t)) return;

    const { d: data } = event;
    const user = client.users.cache.get(data.user_id);
    const channel = <TextChannel>client.channels.cache.get(data.channel_id) || (await user.createDM());

    if (channel.messages.cache.has(data.message_id)) return;

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

  return client;
};

const discordLogin = (client: discord.Client) => {
  client.login(process.env.TOKEN);
};

const refreshMessages = async () => {
  let games = await Game.fetchAllBy({ when: "datetime", method: "automated", timestamp: { $gte: new Date().getTime() } });
  games.forEach(async game => {
    if (!game.discordGuild) return;

    try {
      const message = await game.discordChannel.messages.fetch(game.messageId);
    } catch (err) {}
  });
};

let rescheduled: Game[] = [];
const rescheduleOldGames = async (guildId?: string) => {
  let result: DeleteWriteOpResultObject;
  try {
    aux.log(`Rescheduling old games for all servers`);
    const query: FilterQuery<any> = {
      when: "datetime",
      timestamp: {
        $lt: new Date().getTime()
      },
      $and: [
        {
          frequency: {
            $ne: '0'
          }
        },
        {
          frequency: {
            $ne: null
          }
        }
      ],
      $or: [
        {
          rescheduled: false
        },
        {
          rescheduled: null
        }
      ]
    };

    if (guildId) query.s = guildId;

    let games = await Game.fetchAllBy(query);
    games = games.filter(game => client.guilds.cache.array().find(g => g.id === game.s));
    aux.log(`Found ${games.length} games scheduled before now`);
    let count = 0;
    for(let i = 0; i < games.length; i++) {
      const game = games[i];

      if(game.canReschedule() && !rescheduled.find(g => g.s == game.s && g.c == game.c && g.adventure == game.adventure && g.date == game.date && g.time == game.time && g.timezone == game.timezone)) {
        rescheduled.push(game);
        count++;
        try {
          await game.reschedule();
        }
        catch(err) {
          const newGames = await Game.fetchAllBy({
            s: game.s,
            c: game.c,
            adventure: game.adventure,
            date: {
              $ne: game.date
            },
            time: game.time
          });
          if (newGames.length > 0) {
            await game.delete();
          }
        }
      }   
    }

    aux.log(`rescheduled ${count} games`);
  } catch (err) {
    aux.log("GameReschedulingError:", err);
  }

  setTimeout(() => {
    rescheduled = [];
  }, 5 * 60 * 1000);
  return result;
}

const pruneOldGames = async (guild?: discord.Guild) => {
  let result: DeleteWriteOpResultObject;
  try {
    aux.log(`Pruning old games for ${guild ? `${guild.name} server` : 'all servers'}`);
    const query: FilterQuery<any> = {
      timestamp: {
        $lt: new Date().getTime() - 48 * 3600 * 1000
      }
    };
    
    let games = await Game.fetchAllBy(query);
    games = games.filter(game => client.guilds.cache.array().find(g => g.id === game.s));
    const guildConfigs = await GuildConfig.fetchAll();
    for(let i = 0; i < games.length; i++) {
      let game = games[i];
      if (!game.discordGuild) continue;
      if (guild && game.discordGuild.id !== guild.id) continue;

      io().emit("game", { action: "deleted", gameId: game._id });

      try {
        const guildConfig = guildConfigs.find(gc => gc.guild === game.s);
        if ((guildConfig || new GuildConfig()).pruning && game.discordChannel) {
          if (game.messageId) {
            const message = await game.discordChannel.messages.fetch(game.messageId);
            if (message) message.delete();
          }
          if (game.reminderMessageId) {
            const reminder = await game.discordChannel.messages.fetch(game.reminderMessageId);
            if (reminder) reminder.delete();
          }
        }
      } catch (err) {
        aux.log("MessagePruningError:", err);
      }
    }
    
    result = await Game.deleteAllBy(query);
    aux.log(`${result.deletedCount} old games successfully pruned`);
  } catch (err) {
    aux.log("GamePruningError:", err);
  }
  return result;
};

const postReminders = async (app: Express) => {
  const cTime = new Date().getTime();
  const reminderOptions = ["15", "30", "60", "360", "720", "1440"];
  const remExprs = reminderOptions.map(r => {
    const rt = parseInt(r);
    return {
      reminder: r,
      timestamp: {
        $lte: cTime + rt * 60 * 1000
      }
    }
  });
  
  const query: FilterQuery<any> = {
    when: "datetime",
    timestamp: {
      $gt: cTime
    },
    $and: [
      {
        $or: remExprs
      },
      {
        $or: [
          {
            reminded: null
          },
          {
            reminded: false
          }
        ]
      }
    ]
  };
  
  let games = await Game.fetchAllBy(query); 
  games = games.filter(game => client.guilds.cache.array().find(g => g.id === game.s));
  aux.log(`Posting reminders for ${games.length} games`);
  games.forEach(async game => {
    if (game.timestamp - parseInt(game.reminder) * 60 * 1000 > new Date().getTime()) return;
    if (!game.discordGuild) return;
    if (!game.discordChannel) return;
    if (game.reminded) return;

    const reserved: string[] = [];
    const reservedUsers: discord.GuildMember[] = [];

    try {
      var where = game.where;
      game.reserved.split(/\r?\n/).forEach(res => {
        if (res.trim().length === 0) return;
        let member = game.discordGuild.members.cache.array().find(mem => mem.user.tag === res.trim().replace("@", ""));

        let name = res.trim().replace("@", "");
        if (member) name = member.user.toString();
        if (member) reservedUsers.push(member);

        if (reserved.length < parseInt(game.players)) {
          reserved.push(name);
        }
      });

      const guildMembers = await game.discordGuild.members.fetch();
      const member = guildMembers.array().find(mem => mem.user.tag === game.dm.trim().replace("@", ""));
      var dm = game.dm.trim().replace("@", "");
      var dmMember = member;
      if (member) dm = member.user.toString();
    }
    catch(err) {

    }

    if (reserved.length == 0) return;
    
    let minPlayers = parseInt(game.minPlayers);
    if (!isNaN(parseInt(game.minPlayers))) minPlayers = 0;
    if (reserved.length < minPlayers) return;

    try {
      game.reminded = true;
      game.save();
    } catch (err) {
      aux.log(err);
      return;
    }

    const channels = game.where.match(/#[a-z0-9\-_]+/gi);
    if (channels) {
      channels.forEach(chan => {
        const guildChannel = game.discordGuild.channels.cache.array().find(c => c.name === chan.replace(/#/, ""));
        if (guildChannel) {
          where = game.where.replace(chan, guildChannel.toString());
        }
      });
    }

    const guildConfig = await GuildConfig.fetch(game.discordGuild.id);
    const languages = app.locals.langs;
    const lang = languages.find(l => l.code === guildConfig.lang) || languages.find(l => l.code === "en");
    const reminder = game.reminder;

    const siUnit = parseInt(reminder) > 60 ? 'HOURS' : 'MINUTES';
    const siLabel = lang.game[`STARTING_IN_${siUnit}`].replace(`:${siUnit}`, parseInt(reminder) / (parseInt(reminder) > 60 ? 60 : 1));

    if (guildConfig.privateReminders) {
      try {
        let message = `${lang.game.REMINDER_FOR} **${game.adventure.replace(/\*/gi, "")}**\n`;
        message += `**${lang.game.WHEN}:** ${siLabel}\n`;
        message += `**${lang.game.SERVER}:** ${game.discordGuild && game.discordGuild.name}\n`;
        message += `**${lang.game.WHERE}:** ${where}\n`;
        message += `**${lang.game.GM}:** ${dmMember ? (dmMember.nickname ? dmMember.nickname : dmMember.user && dmMember.user.username) : game.dm}\n`;

        for (const member of reservedUsers) {
          if (member && member.user) member.user.send(message);
          if (dmMember && dmMember.user && member && member.user && dmMember.user.username == member.user.username) dmMember = null;
        }

        if (dmMember && dmMember.user) dmMember.user.send(message);
      } catch (err) {
        aux.log(err);
      }
    } else {
      let message = `${lang.game.REMINDER_FOR} **${game.adventure.replace(/\*/gi, "")}**\n`;
      message += `**${lang.game.WHEN}:** ${siLabel}\n`;
      message += `**${lang.game.WHERE}:** ${where}\n\n`;
      message += `**${lang.game.GM}:** ${dm}\n`;
      message += `**${lang.game.RESERVED}:**\n`;
      message += `${reserved.join(`\n`)}`;

      const sent = <Message>await game.discordChannel.send(message);

      game.reminderMessageId = sent.id;
      game.save();
    }
  });
};

const fixReschedules = async () => {
  try {
    const query: FilterQuery<any> = {
      // _id: {
      //   $in: [
      //     new ObjectID("5e71b0f1ffbe22002abb54e5")
      //   ]
      // },
      // _id: { $ne: new ObjectID("5e738c431501d4002a5d75c0") },
      // adventure: "Pre-Market Prep",
      // where: "3SIX9",
      // time: "08:30",
      $and: [
        {
          frequency: {
            $ne: '0'
          }
        },
        {
          frequency: {
            $ne: null
          }
        }
      ]
    };
  
    let games = await Game.fetchAllByLimit(query, 50);
    games = games.filter(game => client.guilds.cache.array().find(g => g.id === game.s));
    aux.log(`Found ${games.length} games scheduled before now`);
    for(let i = 0; i < games.length; i++) {
      const game = games[i];
  
      if (game.when === "datetime") {
        aux.log(game.dm, game.adventure, game.date, game.time, game._id);
        await game.delete();
      }   
    }
  }
  catch(err) {
    aux.log('Error')
  }
};

export default {
  processes: discordProcesses,
  login: discordLogin,
  refreshMessages: refreshMessages,
  pruneOldGames: pruneOldGames,
  rescheduleOldGames: rescheduleOldGames,
  postReminders: postReminders,
  fixReschedules: fixReschedules
};

export function discordClient() {
  return client;
}
