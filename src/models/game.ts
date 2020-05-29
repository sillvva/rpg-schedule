import mongodb, { ObjectID } from "mongodb";
import discord, { Message, MessageEmbed, User, Client } from "discord.js";
import moment from "moment";
import "moment-recur-ts";

import db from "../db";
import aux from "../appaux";
import ShardManager, { ShardGuild, ShardMember, ShardChannel } from "../processes/shard-manager";
import { io } from "../processes/socket";
import { GuildConfig } from "./guild-config";
import config from "./config";
import cloneDeep from "lodash/cloneDeep";

const connection = db.connection;
const ObjectId = mongodb.ObjectId;
const collection = "games";
const host = process.env.HOST;

const supportedLanguages = require("../../lang/langs.json");
const gmLanguages = supportedLanguages.langs
  .map((lang: String) => {
    return {
      code: lang,
      ...require(`../../lang/${lang}.json`),
    };
  })
  .sort((a: any, b: any) => (a.name > b.name ? 1 : -1));

export enum Frequency {
  NO_REPEAT = 0,
  DAILY = 1,
  WEEKLY = 2,
  BIWEEKLY = 3,
  MONTHLY = 4,
}

export enum MonthlyType {
  WEEKDAY = "weekday",
  DATE = "date",
}

export enum GameMethod {
  AUTOMATED = "automated",
  CUSTOM = "custom",
}

export enum GameWhen {
  DATETIME = "datetime",
  NOW = "now",
}

export enum RescheduleMode {
  REPOST = "repost",
  UPDATE = "update",
}

export interface RSVP {
  id?: string;
  tag: string;
}

export interface GameModel {
  _id: string | number | ObjectID;
  s: string;
  c: string;
  guild: string;
  channel: string;
  template: string | number | ObjectID;
  adventure: string;
  runtime: string;
  minPlayers: string;
  players: string;
  dm: RSVP;
  author: RSVP;
  where: string;
  description: string;
  reserved: RSVP[];
  method: GameMethod;
  customSignup: string;
  when: GameWhen;
  date: string;
  time: string;
  timezone: number;
  timestamp: number;
  hideDate: boolean;
  reminder: string;
  reminded: boolean;
  messageId: string;
  reminderMessageId: string;
  pm: string;
  gameImage: string;
  frequency: Frequency;
  weekdays: boolean[];
  xWeeks: number;
  monthlyType: MonthlyType;
  clearReservedOnRepeat: boolean;
  rescheduled: boolean;
  sequence: number;
  pruned?: boolean;
  createdTimestamp: number;
  updatedTimestamp: number;
}

interface GameSaveData {
  _id: string | number | ObjectID;
  message: Message;
  modified: boolean;
}

export enum GameReminder {
  NO_REMINDER = "0",
  MINUTES_15 = "15",
  MINUTES_30 = "30",
  MINUTES_60 = "60",
  HOURS_6 = "360",
  HOURS_12 = "720",
  HOURS_24 = "1440",
}

export const gameReminderOptions = [GameReminder.MINUTES_15, GameReminder.MINUTES_30, GameReminder.MINUTES_60, GameReminder.HOURS_6, GameReminder.HOURS_12, GameReminder.HOURS_24];

export class Game implements GameModel {
  _id: string | number | ObjectID;
  s: string;
  c: string;
  guild: string;
  channel: string;
  template: string | number | ObjectID;
  adventure: string;
  runtime: string;
  minPlayers: string;
  players: string;
  dm: RSVP;
  author: RSVP;
  where: string;
  description: string;
  reserved: RSVP[];
  method: GameMethod;
  customSignup: string;
  when: GameWhen;
  date: string;
  time: string;
  timezone: number;
  timestamp: number;
  hideDate: boolean;
  reminder: string;
  reminded: boolean;
  messageId: string;
  reminderMessageId: string;
  pm: string;
  gameImage: string;
  frequency: Frequency;
  weekdays: boolean[] = [false, false, false, false, false, false, false];
  xWeeks: number = 2;
  monthlyType: MonthlyType = MonthlyType.WEEKDAY;
  clearReservedOnRepeat: boolean = false;
  rescheduled: boolean = false;
  sequence: number = 1;
  pruned: boolean = false;
  createdTimestamp: number;
  updatedTimestamp: number;

  client: Client;

  constructor(game: GameModel, guilds: ShardGuild[], client?: Client) {
    if (client) this.client = client;

    let guildMembers: ShardMember[] = [];
    const gameEntries = Object.entries(game || {});
    for (let i = 0; i < gameEntries.length; i++) {
      let [key, value] = gameEntries[i];

      // Strip HTML Tags from Data
      if (typeof value === "string") {
        value = value.replace(/<\/?(\w+)((\s+\w+(\s*=\s*(?:".*?"|'.*?'|[\^'">\s]+))?)+\s*|\s*)\/?>/gm, "");
      }

      if (key === "s") {
        this[key] = value;
        this._guild = guilds.find((g) => g.id === value);
        if (this._guild && !guildMembers.length) guildMembers = this._guild.members;
      } else if (key === "c" && this._guild) {
        this[key] = value;
        this._guild.channels.forEach((c) => {
          if (!this._channel && c.type === "text") {
            this._channel = c;
          }
          if (c.id === value && c.type === "text") {
            this._channel = c;
          }
        });
      } else if (key === "dm" && guildMembers) {
        this[key] = Game.updateDM(value, guildMembers);
      } else if (key === "reserved" && guildMembers) {
        this[key] = Game.updateReservedList(value, guildMembers);
      } else this[key] = value;
    }

    if (!this.author) this.author = this.dm;

    const d = new Date();
    d.setDate(d.getDate() - 2);
    if (!this.createdTimestamp) {
      this.createdTimestamp = d.getTime() - 24 * 3600 * 1000;
    }
    if (!this.updatedTimestamp) this.updatedTimestamp = this.createdTimestamp;
  }

  private _guild: ShardGuild;
  get discordGuild() {
    return this._guild;
  }

  private _channel: ShardChannel;
  get discordChannel() {
    return this._channel;
  }

  get data(): GameModel {
    return {
      _id: this._id,
      s: this.s,
      c: this.c,
      guild: this.guild,
      channel: this.channel,
      template: this.template,
      adventure: this.adventure,
      runtime: this.runtime,
      minPlayers: this.minPlayers,
      players: this.players,
      dm: this.dm,
      author: this.author,
      where: this.where,
      description: this.description,
      reserved: this.reserved,
      method: this.method,
      customSignup: this.customSignup,
      when: this.when,
      date: this.date,
      time: this.time,
      timezone: this.timezone,
      timestamp: this.timestamp,
      hideDate: this.hideDate,
      reminder: this.reminder,
      reminded: this.reminded,
      messageId: this.messageId,
      reminderMessageId: this.reminderMessageId,
      pm: this.pm,
      gameImage: this.gameImage,
      frequency: this.frequency,
      weekdays: this.weekdays,
      xWeeks: this.xWeeks,
      monthlyType: this.monthlyType,
      clearReservedOnRepeat: this.clearReservedOnRepeat,
      rescheduled: this.rescheduled,
      sequence: this.sequence,
      pruned: this.pruned,
      createdTimestamp: this.createdTimestamp,
      updatedTimestamp: this.updatedTimestamp,
    };
  }

  async save(force: boolean = false) {
    if (!connection()) {
      aux.log("No database connection");
      return null;
    }
    let channel = this._channel;
    const guild = this._guild;
    const guildConfig = await GuildConfig.fetch(guild.id);

    const game: GameModel = cloneDeep(this.data);
    const prev = cloneDeep(game);

    try {
      if (guild && !channel) {
        const textChannels = guild.channels.filter((c) => c.type === "text");
        const channels = guildConfig.channels.filter((c) => guild.channels.find((gc) => gc.id == c.channelId)).map((c) => guild.channels.find((ch) => ch.id === c.channelId));
        if (channels.length === 0 && textChannels.length > 0) channels.push(textChannels[0]);
        channel = channels[0];
      }

      const lang = gmLanguages.find((l) => l.code === guildConfig.lang) || gmLanguages.find((l) => l.code === "en");
      const guildMembers = guild.members;

      if (!game.template) game.template = (guildConfig.gameTemplates.find((gt) => gt.isDefault) || guildConfig.gameTemplates[0]).id;
      const gameTemplate = guildConfig.gameTemplates.find((gt) => gt.id === game.template);

      moment.locale(lang.code);

      let dm = game.dm.tag
        .trim()
        .replace("@", "")
        .replace(/\#\d{4}/, "");
      const dmParts = game.dm.tag.split("#");
      let dmmember = guildMembers.find((mem) => {
        return (
          (game.dm && mem.user.tag === game.dm.tag.trim().replace("@", "")) ||
          (dmParts[0] && dmParts[1] && mem.user.username === dmParts[0].trim() && mem.user.discriminator === dmParts[1].trim()) ||
          (dmParts[0] && mem.user.username === dmParts[0].trim()) ||
          mem.user.id === game.dm.id
        );
      });
      if (dmmember) {
        var gmTag = dmmember.user.toString();
        if (guildConfig.embeds === false) dm = gmTag;
        else dm = dmmember.nickname || dm;
      } else if (!game._id && !force) {
        return {
          _id: "",
          message: null,
          modified: false,
        };
      }

      game.reserved = game.reserved.filter((r) => r.tag);

      let reserved: string[] = [];
      let waitlist: string[] = [];
      let rMentions: string[] = [];
      game.reserved.forEach((rsvp, i) => {
        if (rsvp.tag.trim().length === 0 && !rsvp.id) return;
        let member = guildMembers.find((mem) => mem.user.tag.trim() === rsvp.tag.trim() || mem.user.id === rsvp.id);

        let name = rsvp.tag.trim().replace(/\#\d{4}/, "");
        if (member) {
          if (guildConfig.embeds === false || guildConfig.embedMentions) name = member.user.toString();
          else name = member.nickname || member.user.username;
          rsvp.tag = member.user.tag;
        }

        if (reserved.length < parseInt(game.players)) {
          reserved.push(reserved.length + 1 + ". " + name);
          if (member) rMentions.push(member.user.toString());
        } else {
          waitlist.push(reserved.length + waitlist.length + 1 + ". " + name);
        }
      });

      const eventTimes = aux.parseEventTimes(game, {
        isField: true,
      });
      const rawDate = eventTimes.rawDate;
      const timezone = "UTC" + (game.timezone >= 0 ? "+" : "") + game.timezone;
      const where = (await parseDiscord(game.where, guild)).trim();
      let description = (await parseDiscord(game.description, guild)).trim();

      let signups = "";
      let automatedInstructions = `\n(${guildConfig.emojiAdd} ${lang.buttons.SIGN_UP}${guildConfig.dropOut ? ` | ${guildConfig.emojiRemove} ${lang.buttons.DROP_OUT}` : ""})`;
      if (game.method === GameMethod.AUTOMATED) {
        if (reserved.length > 0) signups += `\n**${lang.game.RESERVED}:**\n${reserved.join("\n")}\n`;
        if (waitlist.length > 0) signups += `\n**${lang.game.WAITLISTED}:**\n${waitlist.join("\n")}\n`;
        signups += automatedInstructions;
      } else if (game.method === GameMethod.CUSTOM) {
        signups += `\n${game.customSignup}`;
      }

      let when = "",
        gameDate;
      if (game.when === GameWhen.DATETIME) {
        const date = Game.ISOGameDate(game);
        const tz = Math.round(parseFloat(game.timezone.toString()) * 4) / 4;
        when = moment(date).utcOffset(tz).format(config.formats.dateLong) + ` (${timezone})`;
        gameDate = new Date(rawDate);
      } else if (game.when === GameWhen.NOW) {
        when = lang.game.options.NOW;
        gameDate = new Date();
      }

      game.timestamp = gameDate.getTime();
      game.xWeeks = Math.max(1, parseInt(`${game.xWeeks}`));

      let msg =
        `\n**${lang.game.GM}:** ${dm}` +
        `\n**${lang.game.GAME_NAME}:** ${game.adventure}` +
        `\n**${lang.game.RUN_TIME}:** ${game.runtime} ${lang.game.labels.HOURS}` +
        `\n**${lang.game.WHEN}:** ${game.hideDate ? lang.game.labels.TBD : when}` +
        `\n**${lang.game.WHERE}:** ${where}` +
        `${description.length > 0 ? `\n**${lang.game.DESCRIPTION}:**\n${description}\n` : description}` +
        `\n${signups}`;

      if (game.gameImage.trim().length > 2048) {
        game.gameImage = "";
      }

      let embed: MessageEmbed;
      if (guildConfig.embeds === false) {
        if (game && game.gameImage && game.gameImage.trim().length > 0) {
          embed = new discord.MessageEmbed();
          embed.setColor(gameTemplate && gameTemplate.embedColor ? gameTemplate.embedColor : guildConfig.embedColor);
          embed.setImage(game.gameImage.trim().substr(0, 2048));
        }
      } else {
        const urlRegex = /^((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)$/gi;

        msg = "";
        embed = new discord.MessageEmbed();
        embed.setColor(gameTemplate && gameTemplate.embedColor ? gameTemplate.embedColor : guildConfig.embedColor);
        embed.setTitle(game.adventure);
        embed.setAuthor(dm, dmmember && dmmember.user.avatarUrl && urlRegex.test(dmmember.user.avatarUrl) ? dmmember.user.avatarUrl.substr(0, 2048) : null);
        if (dmmember && dmmember.user.avatarUrl && urlRegex.test(dmmember.user.avatarUrl)) embed.setThumbnail(dmmember.user.avatarUrl.substr(0, 2048));
        if (description.length > 0) embed.setDescription(description);
        if (game.hideDate) embed.addField(lang.game.WHEN, lang.game.labels.TBD, true);
        else embed.addField(lang.game.WHEN, when, true);
        if (game.runtime && game.runtime.trim().length > 0 && game.runtime.trim() != "0") embed.addField(lang.game.RUN_TIME, `${game.runtime} ${lang.game.labels.HOURS}`, true);
        embed.addField(lang.game.WHERE, where);
        if (guildConfig.embedMentions) embed.addField(lang.game.GM, gmTag);
        if (game.method === GameMethod.AUTOMATED) {
          embed.addField(`${lang.game.RESERVED} (${reserved.length}/${game.players})`, reserved.length > 0 ? reserved.join("\n") : lang.game.NO_PLAYERS, true);
          if (waitlist.length > 0) embed.addField(`${lang.game.WAITLISTED} (${waitlist.length})`, waitlist.join("\n"), true);
        } else if (game.method === GameMethod.CUSTOM) {
          embed.addField(lang.game.CUSTOM_SIGNUP_INSTRUCTIONS, game.customSignup);
        }
        if (!game.hideDate)
          embed.addField(
            "Links",
            `[📅 ${lang.game.ADD_TO_CALENDAR}](${eventTimes.googleCal})\n[🗺 ${lang.game.CONVERT_TIME_ZONE}](${eventTimes.convert.timeAndDate})\n[⏰ ${lang.game.COUNTDOWN}](${eventTimes.countdown})`,
            true
          );
        if (game.method === GameMethod.AUTOMATED) embed.setFooter(automatedInstructions);
        if (game && game.gameImage && game.gameImage.trim().length > 0 && urlRegex.test(game.gameImage.trim())) embed.setImage(game.gameImage.trim().substr(0, 2048));
        if (!this.hideDate) embed.setTimestamp(gameDate);
      }

      const dbCollection = connection().collection(collection);
      if (game._id) {
        game.sequence++;
        const gameData = cloneDeep(game);
        delete gameData._id;

        gameData.updatedTimestamp = new Date().getTime();
        const updated = await dbCollection.updateOne({ _id: new ObjectId(game._id) }, { $set: gameData });
        let message: Message;
        try {
          try {
            message = await channel.messages.fetch(game.messageId);
          } catch (err) {}

          if (guildConfig.embeds) msg = [await parseDiscord(game.description, guild, true), dmmember && dmmember.user.toString(), rMentions.join(" ")].filter((m) => m).join(" ");
          else embed = null;
          
          if (message) {
            if ((message.author ? message.author.id : (<any>message).authorID) === process.env.CLIENT_ID) {
              if (this.client) message = await ShardManager.clientMessageEdit(this.client, guild.id, channel.id, message.id, msg, embed);
              else message = await ShardManager.shardMessageEdit(guild.id, channel.id, message.id, msg, embed);
            }
          } else {
            message = <Message>(await channel.send(msg, embed))[0];

            if (message) {
              await dbCollection.updateOne({ _id: new ObjectId(game._id) }, { $set: { messageId: message.id } });
              game.messageId = message.id;
            }
          }

          if (message) {
            try {
              if (game.method === GameMethod.AUTOMATED) await ShardManager.shardMessageReact(guild.id, channel.id, message.id, guildConfig.emojiAdd);
            } catch (err) {
              if (!aux.isEmoji(guildConfig.emojiAdd)) {
                guildConfig.emojiAdd = "➕";
                if (game.method === GameMethod.AUTOMATED) await ShardManager.shardMessageReact(guild.id, channel.id, message.id, guildConfig.emojiAdd);
              }
            }
            try {
              if (game.method === GameMethod.AUTOMATED && guildConfig.dropOut) ShardManager.shardMessageReact(guild.id, channel.id, message.id, guildConfig.emojiRemove);
            } catch (err) {
              if (!aux.isEmoji(guildConfig.emojiRemove)) {
                guildConfig.emojiRemove = "➖";
                if (game.method === GameMethod.AUTOMATED && guildConfig.dropOut) ShardManager.shardMessageReact(guild.id, channel.id, message.id, guildConfig.emojiRemove);
              }
            }
          }

          prev._id = prev._id.toString();
          game._id = game._id.toString();

          this.dmNextWaitlist(prev.reserved, game.reserved);

          const updatedGame = aux.objectChanges(prev, game);
          if (this.client)
            this.client.shard.send({
              type: "socket",
              name: "game",
              data: { action: "updated", gameId: game._id, game: updatedGame, guildId: game.s },
            });
          else io().emit("game", { action: "updated", gameId: game._id, game: updatedGame, guildId: game.s });
        } catch (err) {
          aux.log("UpdateGameError:", err);
          if (updated) updated.modifiedCount = 0;
        }
        const saved: GameSaveData = {
          _id: game._id,
          message: <Message>message,
          modified: updated && updated.modifiedCount > 0,
        };
        return saved;
      } else {
        game.createdTimestamp = new Date().getTime();
        game.updatedTimestamp = new Date().getTime();
        const inserted = await dbCollection.insertOne(game);
        let message: Message;
        let gcUpdated = false;
        
        try {
          if (guildConfig.embeds) msg = [await parseDiscord(game.description, guild, true), dmmember && dmmember.user.toString(), rMentions.join(" ")].filter((m) => m).join(" ");
          else embed = null;

          message = <Message>await channel.send(msg, embed);

          try {
            if (game.method === GameMethod.AUTOMATED) await ShardManager.shardMessageReact(guild.id, channel.id, message.id, guildConfig.emojiAdd);
          } catch (err) {
            if (!aux.isEmoji(guildConfig.emojiAdd)) {
              gcUpdated = true;
              guildConfig.emojiAdd = "➕";
              if (game.method === GameMethod.AUTOMATED) await ShardManager.shardMessageReact(guild.id, channel.id, message.id, guildConfig.emojiAdd);
            }
          }
          try {
            if (game.method === GameMethod.AUTOMATED && guildConfig.dropOut) await ShardManager.shardMessageReact(guild.id, channel.id, message.id, guildConfig.emojiRemove);
          } catch (err) {
            if (!aux.isEmoji(guildConfig.emojiRemove)) {
              gcUpdated = true;
              guildConfig.emojiRemove = "➖";
              if (game.method === GameMethod.AUTOMATED && guildConfig.dropOut) await ShardManager.shardMessageReact(guild.id, channel.id, message.id, guildConfig.emojiRemove);
            }
          }
        } catch (err) {
          aux.log("InsertGameError:", game.s, err);
        }

        if (gcUpdated) {
          guildConfig.save(guildConfig.data);
          guildConfig.updateReactions(this.client);
        }

        let updated;
        if (message) {
          updated = await dbCollection.updateOne({ _id: new ObjectId(inserted.insertedId) }, { $set: { messageId: message.id } });
          if (dmmember) {
            try {
              const dmEmbed = new MessageEmbed();
              dmEmbed.setColor(gameTemplate && gameTemplate.embedColor ? gameTemplate.embedColor : guildConfig.embedColor);
              dmEmbed.setTitle(lang.buttons.EDIT_GAME);
              dmEmbed.setURL(host + config.urls.game.create.path + "?g=" + inserted.insertedId);
              dmEmbed.addField(lang.game.SERVER, guild.name, true);
              dmEmbed.addField(lang.game.GAME_NAME, `[${game.adventure}](https://discordapp.com/channels/${this.discordGuild.id}/${this.discordChannel.id}/${message.id})`, true);
              const pm = await dmmember.send(dmEmbed);
              await dbCollection.updateOne({ _id: new ObjectId(inserted.insertedId) }, { $set: { pm: pm.id } });
            } catch (err) {
              aux.log("EditLinkError:", err);
            }
          }
        } else {
          aux.log(`GameMessageNotPostedError:\n`, game.s, `${msg}\n`, embed);
        }

        if (this.client)
          this.client.shard.send({
            type: "socket",
            name: "game",
            data: { action: "new", gameId: inserted.insertedId.toString(), guildId: game.s, authorId: game.author.id },
          });
        else io().emit("game", { action: "new", gameId: inserted.insertedId.toString(), guildId: game.s, authorId: game.author.id });

        const saved: GameSaveData = {
          _id: inserted.insertedId.toString(),
          message: message,
          modified: updated && updated.modifiedCount > 0,
        };
        return saved;
      }
    } catch (err) {
      aux.log("GameSaveError", game._id, err);

      if (game._id && force) {
        const dbCollection = connection().collection(collection);
        await dbCollection.updateOne({ _id: new ObjectId(game._id) }, { $set: game });
      }

      return {
        _id: "",
        message: null,
        modified: false,
      };
    }
  }

  static async fetch(gameId: string | number | ObjectID, client?: Client): Promise<Game> {
    if (!connection()) {
      aux.log("No database connection");
      return null;
    }
    const game = await connection()
      .collection(collection)
      .findOne({ _id: new ObjectId(gameId) });
    const guilds = game.s ? (client ? await ShardManager.clientGuilds(client, [game.s]) : await ShardManager.shardGuilds([game.s])) : [];
    return game ? new Game(game, guilds, client) : null;
  }

  static async fetchBy(key: string, value: any, client?: Client): Promise<Game> {
    if (!connection()) {
      aux.log("No database connection");
      return null;
    }
    const query: mongodb.FilterQuery<any> = aux.fromEntries([[key, value]]);
    const game: GameModel = await connection().collection(collection).findOne(query);
    const guilds = client ? await ShardManager.clientGuilds(client, [game.s]) : await ShardManager.shardGuilds([game.s]);
    return game ? new Game(game, guilds, client) : null;
  }

  static async fetchAllBy(query: mongodb.FilterQuery<any>, client?: Client): Promise<Game[]> {
    if (!connection()) {
      aux.log("No database connection");
      return [];
    }
    const games: GameModel[] = await connection().collection(collection).find(query).toArray();
    const out: Game[] = [];
    for (let i = 0; i < games.length; i++) {
      const guilds = client ? await ShardManager.clientGuilds(client, [games[i].s]) : await ShardManager.shardGuilds([games[i].s]);
      out.push(new Game(games[i], guilds, client));
    }
    return out;
  }

  static async fetchAllByLimit(query: mongodb.FilterQuery<any>, limit: number, client?: Client): Promise<Game[]> {
    if (!connection()) {
      aux.log("No database connection");
      return [];
    }
    const games: GameModel[] = await connection().collection(collection).find(query).limit(limit).toArray();
    const out: Game[] = [];
    for (let i = 0; i < games.length; i++) {
      const guilds = client ? await ShardManager.clientGuilds(client, [games[i].s]) : await ShardManager.shardGuilds([games[i].s]);
      out.push(new Game(games[i], guilds, client));
    }
    return out;
  }

  static async deleteAllBy(query: mongodb.FilterQuery<any>) {
    if (!connection()) {
      aux.log("No database connection");
      return null;
    }
    return await connection().collection(collection).deleteMany(query);
  }

  static async updateAllBy(query: mongodb.FilterQuery<any>, update: any) {
    if (!connection()) {
      aux.log("No database connection");
      return [];
    }
    return await connection().collection(collection).updateMany(query, update, {
      upsert: false,
    });
  }

  public getWeekdays() {
    const days = this.weekdays;
    const validDays = [];
    for (let i = 0; i < days.length; i++) {
      if (days[i] == true) {
        validDays.push(moment.weekdays(true, i));
      }
    }
    return validDays;
  }

  public canReschedule() {
    const validDays = this.getWeekdays();
    const hours = isNaN(parseFloat(this.runtime.replace(/[^\d\.-]/g, "").trim())) ? 0 : Math.abs(parseFloat(this.runtime.replace(/[^\d\.-]/g, "").trim()));
    const gameEnded = this.timestamp + hours * 3600 * 1000 < new Date().getTime();
    const nextDate = Game.getNextDate(moment(this.date), validDays, Number(this.frequency), this.monthlyType, this.xWeeks);
    const nextISO = `${nextDate.replace(/-/g, "")}T${this.time.replace(/:/g, "")}00${this.timezone >= 0 ? "+" : "-"}${aux.parseTimeZoneISO(this.timezone)}`;
    const nextGamePassed = new Date(nextISO).getTime() <= new Date().getTime();
    return (
      gameEnded &&
      !this.rescheduled &&
      !nextGamePassed &&
      this.when == GameWhen.DATETIME &&
      (this.frequency == Frequency.DAILY ||
        this.frequency == Frequency.MONTHLY ||
        ((this.frequency == Frequency.WEEKLY || this.frequency == Frequency.BIWEEKLY) && validDays.length > 0))
    );
  }

  async reschedule() {
    try {
      const validDays = this.getWeekdays();
      const nextDate = Game.getNextDate(moment(this.date), validDays, Number(this.frequency), this.monthlyType, this.xWeeks);
      aux.log(`Rescheduling ${this.s}: ${this.adventure} from ${this.date} (${this.time}) to ${nextDate} (${this.time})`);
      this.date = nextDate;

      if (this.clearReservedOnRepeat) {
        this.reserved = [];
      }

      const guildConfig = await GuildConfig.fetch(this.s);
      if (guildConfig.rescheduleMode === RescheduleMode.UPDATE) {
        await this.save();
      } else if (guildConfig.rescheduleMode === RescheduleMode.REPOST) {
        let data = cloneDeep(this.data);
        let guilds;
        if (this.client) {
          guilds = await ShardManager.clientGuilds(this.client, [data.s]);
        } else {
          guilds = await ShardManager.shardGuilds([data.s]);
        }
        const id = data._id;
        delete data._id;
        delete data.pm;
        delete data.messageId;
        delete data.reminderMessageId;
        const game = new Game(data, guilds, this.client);
        const newGame = await game.save();
        const del = await this.delete();
        if (del.deletedCount == 0) {
          const del2 = await Game.softDelete(id);
          if (del2.deletedCount == 0) {
            this.rescheduled = true;
            await this.save();
          }
        }
        if (this.client)
          this.client.shard.send({
            type: "socket",
            name: "game",
            data: { action: "rescheduled", gameId: this._id, newGameId: newGame._id },
          });
        else io().emit("game", { action: "rescheduled", gameId: this._id, newGameId: newGame._id });
      }
      return true;
    } catch (err) {
      aux.log("GameRescheduleError:", err.message || err);
      return false;
    }
  }

  static async softDelete(_id: string | number | mongodb.ObjectID) {
    return await connection()
      .collection(collection)
      .deleteOne({ _id: new ObjectId(_id) });
  }

  async delete(options: any = {}) {
    if (!connection()) {
      aux.log("No database connection");
      return { deletedCount: 0 };
    }

    // const guilds = options.client ? await ShardManager.clientGuilds(options.client) : await ShardManager.shardGuilds();
    // const guild =

    try {
      var result = await Game.softDelete(this._id);
    } catch (err) {
      aux.log(err.message || err);
    }

    const { sendWS = true } = options;
    const game: GameModel = this;
    const channel = this._channel;

    if (channel) {
      try {
        if (game.messageId) {
          const message = await channel.messages.fetch(game.messageId);
          if (message) {
            message.delete().catch((err) => {
              aux.log("Attempted to delete announcement message.");
              // aux.log(err);
            });
          }
        }
      } catch (e) {
        aux.log("Announcement: ", e.message);
      }

      try {
        if (game.reminderMessageId) {
          const message = await channel.messages.fetch(game.reminderMessageId);
          if (message) {
            message.delete().catch((err) => {
              aux.log("Attempted to delete reminder message.");
              // aux.log(err);
            });
          }
        }
      } catch (e) {
        aux.log("Reminder: ", e.message);
      }

      // try {
      //   if (game.pm) {
      //     const guild = this._guild;
      //     const dm = guild.members.find(m => m.user.tag === game.dm.tag || m.user.id === game.dm.id);
      //     if (dm && dm.user.dmChannel) {
      //       await dm.user.dmChannel.delete(game.pm);
      //     }
      //   }
      // } catch (e) {
      //   aux.log("DM: ", e.message);
      // }
    }

    if (sendWS) {
      if (this.client)
        this.client.shard.send({
          type: "socket",
          name: "game",
          data: { action: "deleted", gameId: game._id, guildId: game.s },
        });
      else io().emit("game", { action: "deleted", gameId: game._id, guildId: game.s });
    }
    return result;
  }

  async dmCustomInstructions(tag: string) {
    if (this.method === "automated" && this.customSignup.trim().length > 0 && this.discordGuild) {
      const guild = this.discordGuild;
      const guildMembers = await guild.members;
      const guildConfig = await GuildConfig.fetch(guild.id);
      const dmmember = guildMembers.find((m) => m.user.tag === this.dm.tag.trim() || m.user.id === this.dm.id);
      const member = guildMembers.find((m) => m.user.tag === tag.trim());
      if (!this.template) this.template = (guildConfig.gameTemplates.find((gt) => gt.isDefault) || guildConfig.gameTemplates[0]).id;
      const gameTemplate = guildConfig.gameTemplates.find((gt) => gt.id === this.template);

      if (member) {
        const lang = gmLanguages.find((l) => l.code === guildConfig.lang) || gmLanguages.find((l) => l.code === "en");

        let waitlisted = "";
        if (this.reserved.findIndex((r) => r.id === member.user.id || r.tag === member.user.tag) + 1 > parseInt(this.players)) {
          const slotNum = this.reserved.findIndex((r) => r.id === member.user.id || r.tag === member.user.tag) + 1 - parseInt(this.players);
          waitlisted = `\n\n${lang.messages.DM_WAITLIST.replace(":NUM", slotNum)}`;
        }

        const dmEmbed = new MessageEmbed();
        dmEmbed.setDescription(
          `**[${this.adventure}](https://discordapp.com/channels/${this.discordGuild.id}/${this.discordChannel.id}/${this.messageId})**\n${this.customSignup}${waitlisted}`
        );
        dmEmbed.setColor(gameTemplate && gameTemplate.embedColor ? gameTemplate.embedColor : guildConfig.embedColor);

        member.send(`${lang.messages.DM_INSTRUCTIONS.replace(":DM", dmmember ? dmmember.user.toString() : this.dm.tag).replace(" :EVENT", ``)}:`, {
          embed: dmEmbed,
        });
      }
    }
  }

  async dmNextWaitlist(pReserved, gReserved) {
    if (pReserved.length <= gReserved.length) return;
    if (gReserved.length < parseInt(this.players)) return;
    const pMaxPlayer = (pReserved[parseInt(this.players) - 1] || { tag: "" }).tag;
    const gMaxPlayer = (gReserved[parseInt(this.players) - 1] || { tag: "" }).tag;
    if (pMaxPlayer.trim() == gMaxPlayer.trim()) return;
    const guildMembers = this.discordGuild.members;
    const guildConfig = await GuildConfig.fetch(this.discordGuild.id);
    const lang = gmLanguages.find((l) => l.code === guildConfig.lang) || gmLanguages.find((l) => l.code === "en");
    if (!this.template) this.template = (guildConfig.gameTemplates.find((gt) => gt.isDefault) || guildConfig.gameTemplates[0]).id;
    const gameTemplate = guildConfig.gameTemplates.find((gt) => gt.id === this.template);

    this.reserved.forEach((res, index) => {
      var member = guildMembers.find((mem) => mem.user.tag.trim() === res.tag.trim() || mem.user.id === res.id);

      if (index + 1 === parseInt(this.players)) {
        const embed = new MessageEmbed();

        embed.setColor(gameTemplate && gameTemplate.embedColor ? gameTemplate.embedColor : guildConfig.embedColor);

        let message = lang.messages.YOURE_IN;
        message = message.replace(
          ":GAME",
          this.messageId ? `[${this.adventure}](https://discordapp.com/channels/${this.discordGuild.id}/${this.discordChannel.id}/${this.messageId})` : this.adventure
        );
        message = message.replace(":SERVER", this.discordGuild.name);
        embed.setDescription(message);

        embed.addField(lang.game.WHERE, parseDiscord(this.where, this.discordGuild));

        const eventTimes = aux.parseEventTimes(this.data);
        if (!this.hideDate) embed.setTimestamp(new Date(eventTimes.rawDate));

        if (member) member.send(embed);
      }
    });
  }

  static ISOGameDate(game: GameModel) {
    return `${game.date.replace(/-/g, "")}T${game.time.replace(/:/g, "")}00${game.timezone >= 0 ? "+" : "-"}${aux.parseTimeZoneISO(game.timezone)}`;
  }

  static getNextDate(baseDate: moment.Moment, validDays: string[], frequency: Frequency, monthlyType: MonthlyType, xWeeks: number = 2) {
    if (frequency == Frequency.NO_REPEAT) return null;

    let dateGenerator;
    let nextDate = baseDate;

    try {
      switch (frequency) {
        case Frequency.DAILY:
          nextDate = moment(baseDate).add(1, "days");
          break;
        case Frequency.WEEKLY: // weekly
          if (validDays === undefined || validDays.length === 0) break;
          dateGenerator = moment(baseDate).recur().every(validDays).daysOfWeek();
          nextDate = dateGenerator.next(1)[0];
          break;
        case Frequency.BIWEEKLY: // biweekly
          if (validDays === undefined || validDays.length === 0) break;
          // this is a compound interval...
          dateGenerator = moment(baseDate).recur().every(validDays).daysOfWeek();
          nextDate = dateGenerator.next(1)[0];
          while (nextDate.week() - moment(baseDate).week() < xWeeks) {
            // if the next date is in the same week, diff = 0. if it is just next week, diff = 1, so keep going forward.
            dateGenerator = moment(nextDate).recur().every(validDays).daysOfWeek();
            nextDate = dateGenerator.next(1)[0];
          }
          break;
        case Frequency.MONTHLY:
          if (monthlyType == MonthlyType.WEEKDAY) {
            const weekOfMonth = moment(baseDate).monthWeekByDay();
            const validDay = moment(baseDate).day();
            dateGenerator = moment(baseDate).recur().every(validDay).daysOfWeek().every(weekOfMonth).weeksOfMonthByDay();
            nextDate = dateGenerator.next(1)[0];

            if (weekOfMonth == 4 && moment(nextDate).month() != moment(baseDate).month() + 1) {
              dateGenerator = moment(baseDate).recur().every(validDay).daysOfWeek().every(3).weeksOfMonthByDay();
              nextDate = dateGenerator.next(1)[0];
            }
          } else {
            nextDate = moment(baseDate).add(1, "month");
          }
          break;
        default:
          throw new Error(`invalid frequency ${frequency} specified`);
      }
    } catch (err) {
      console.log(err.message || err);
      return null;
    }

    return moment(nextDate).format("YYYY-MM-DD");
  }

  async updateReservedList() {
    let guildMembers: ShardMember[];
    let updated = false;
    try {
      if (this.dm && typeof this.dm === "string") {
        if (!guildMembers) guildMembers = this.discordGuild.members;
        this.dm = Game.updateDM(this.dm, guildMembers);
        updated = true;
      }
    } catch (err) {
      console.log(err.message);
    }
    try {
      if (typeof this.reserved === "string") {
        if (!guildMembers) guildMembers = await this.discordGuild.members;
        this.reserved = Game.updateReservedList(this.reserved, guildMembers);
        updated = true;
      }
    } catch (err) {
      console.log(err.message);
    }
    if (updated && this._id) this.save();
  }

  static updateReservedList(list: RSVP[] | string, guildMembers: ShardMember[]) {
    if (Array.isArray(list)) return list;
    let rsvps: RSVP[] = [];
    const reserved = list.split(/\r?\n/);
    reserved.forEach((r) => {
      const rsvp: RSVP = { tag: r.trim() };
      const member = guildMembers.find((m) => m.user.tag === r.trim());
      if (member) {
        rsvp.id = member.user.id;
      }
    });
    rsvps = rsvps.filter((r) => r.tag);
    return rsvps;
  }

  static updateDM(dm: RSVP | string, guildMembers: ShardMember[]) {
    if (typeof dm === "string") {
      const rsvp: RSVP = { tag: dm.trim() };
      const member = guildMembers.find((m) => m.user.tag === dm.trim());
      if (member) {
        rsvp.id = member.user.id;
      }
      return rsvp;
    } else {
      return dm;
    }
  }

  async signUp(user: User) {
    if (!this.reserved.find((r) => r.id === user.id || r.tag == user.tag)) {
      this.reserved.push({ id: user.id, tag: user.tag });
      this.save();
      this.dmCustomInstructions(user.tag);
    }
  }

  async dropOut(user: User, guildConfig: GuildConfig) {
    if (this.reserved.find((r) => r.tag === user.tag || r.id === user.id) && guildConfig.dropOut) {
      this.reserved = this.reserved.filter((r) => r.tag && r.tag !== user.tag && !(r.id && r.id === user.id));
      this.save();
    }
  }
}

const parseDiscord = async (text: string, guild: ShardGuild, getMentions: boolean = false) => {
  const mentions: string[] = [];
  try {
    guild.members.forEach((mem) => {
      if (new RegExp(`\@${aux.backslash(mem.user.tag)}`, "gi").test(text)) mentions.push(mem.user.toString());
      text = text.replace(new RegExp(`\@${aux.backslash(mem.user.tag)}`, "gi"), mem.user.toString());
    });
    guild.channels.forEach((c) => {
      text = text.replace(new RegExp(`\#${aux.backslash(c.name)}`, "gi"), `<#${c.id}>`);
    });
    guild.roles.forEach((role) => {
      // const canMention = guild.members.hasPermission(Permissions.FLAGS.toString()_EVERYONE);
      const canMention = true;
      if ((!role.mentionable && !canMention) || ["@everyone", "@here"].includes(role.name)) return;
      if (new RegExp(`\@${aux.backslash(role.name)}`, "gi").test(text)) mentions.push(`<@&${role.id}>`);
      text = text.replace(new RegExp(`\@${aux.backslash(role.name)}`, "gi"), `<@&${role.id}>`);
    });
  } catch (err) {
    aux.log(err);
  }
  if (getMentions) return mentions.join(" ");
  return text;
};
