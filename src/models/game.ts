import mongodb, { ObjectID } from "mongodb";
import discord, { Message, Guild, TextChannel, MessageEditOptions, MessageEmbed } from "discord.js";
import moment from "moment";
import "moment-recur-ts";

import db from "../db";
import aux from "../appaux";
import { discordClient } from "../processes/discord";
import { io } from "../processes/socket";
import { GuildConfig } from "./guild-config";
import config from "./config";
import cloneDeep from "lodash/cloneDeep";

const connection = db.connection;
const ObjectId = mongodb.ObjectId;
const collection = "games";
const host = process.env.HOST;

export enum Frequency {
  NO_REPEAT = 0,
  DAILY = 1,
  WEEKLY = 2,
  BIWEEKLY = 3,
  MONTHLY = 4,
}

export enum MonthlyType {
  WEEKDAY = "weekday",
  DATE = "date"
}

export enum GameMethod {
  AUTOMATED = "automated",
  CUSTOM = "custom"
}

export enum GameWhen {
  DATETIME = "datetime",
  NOW = "now"
}

export enum RescheduleMode {
  REPOST = "repost",
  UPDATE = "update"
}

export interface GameModel {
  _id: string | number | ObjectID;
  s: string;
  c: string;
  guild: string;
  channel: string;
  adventure: string;
  runtime: string;
  minPlayers: string;
  players: string;
  dm: string;
  where: string;
  description: string;
  reserved: string;
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
  monthlyType: MonthlyType;
  clearReservedOnRepeat: boolean;
  rescheduled: boolean;
  sequence: number;
}

interface GameSaveData {
  _id: string | number | ObjectID;
  message: Message;
  modified: boolean;
}

export class Game implements GameModel {
  _id: string | number | ObjectID;
  s: string;
  c: string;
  guild: string;
  channel: string;
  adventure: string;
  runtime: string;
  minPlayers: string;
  players: string;
  dm: string;
  where: string;
  description: string;
  reserved: string;
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
  weekdays: boolean[] = [false,false,false,false,false,false,false];
  monthlyType: MonthlyType = MonthlyType.WEEKDAY;
  clearReservedOnRepeat: boolean = false;
  rescheduled: boolean = false;
  sequence: number = 1;

  private _guild: Guild;
  get discordGuild() {
    return this._guild;
  }
  
  private _channel: TextChannel;
  get discordChannel() {
    return this._channel;
  }

  constructor(game: GameModel) {
    Object.entries(game || {}).forEach(([key, value]) => {
      this[key] = value;
    });
    this._guild = discordClient().guilds.cache.get(this.s);
    if (!this._guild) this._guild = discordClient().guilds.resolve(this.s);
    if (this._guild) {
      this._guild.channels.cache.forEach(c => {
        if (!this._channel && c instanceof TextChannel) {
          this._channel = c;
        }
        if (c.id === this.c && c instanceof TextChannel) {
          this._channel = c;
        }
      });
    }
  }

  get data(): GameModel {
    return {
      _id: this._id,
      s: this.s,
      c: this.c,
      guild: this.guild,
      channel: this.channel,
      adventure: this.adventure,
      runtime: this.runtime,
      minPlayers: this.minPlayers,
      players: this.players,
      dm: this.dm,
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
      monthlyType: this.monthlyType,
      clearReservedOnRepeat: this.clearReservedOnRepeat,
      rescheduled: this.rescheduled,
      sequence: this.sequence
    };
  }

  async save() {
    if (!connection()) { aux.log("No database connection"); return null; }
    let channel = this._channel;
    const guild = channel.guild;
    const guildConfig = await GuildConfig.fetch(guild.id);
    const game: GameModel = this.data;

    if (guild && !channel) {
      const textChannels = <TextChannel[]>guild.channels.cache.array().filter(c => c instanceof TextChannel);
      const channels = guildConfig.channels.filter(c => guild.channels.cache.array().find(gc => gc.id == c)).map(c => guild.channels.cache.get(c));
      if (channels.length === 0 && textChannels.length > 0) channels.push(textChannels[0]);
      channel = <TextChannel>(channels[0]);
    }

    const supportedLanguages = require("../../lang/langs.json");
    const languages = supportedLanguages.langs
      .map((lang: String) => {
        return {
          code: lang,
          ...require(`../../lang/${lang}.json`)
        };
      })
      .sort((a: any, b: any) => (a.name > b.name ? 1 : -1));
    const lang = languages.find(l => l.code === guildConfig.lang) || languages.find(l => l.code === "en");

    moment.locale(lang.code);

    let dm = game.dm
      .trim()
      .replace("@", "")
      .replace(/\#\d{4}/, "");
    let guildMembers = (await guild.members.fetch()).array();
    let dmmember = guildMembers.find(mem => {
      return mem.user.tag === game.dm.trim().replace("@", "");
    });
    if (dmmember) {
      var gmTag = dmmember.user.toString();
      if (guildConfig.embeds === false) dm = gmTag;
      else dm = dmmember.nickname || dm;
    }

    let reserved: string[] = [];
    let waitlist: string[] = [];
    game.reserved
      .replace(/@/g, "")
      .split(/\r?\n/)
      .forEach((res: string) => {
        if (res.trim().length === 0) return;
        let member = guildMembers.find(mem => mem.user.tag.trim() === res.trim());

        let name = res.trim().replace(/\#\d{4}/, "");
        if (member) {
          if (guildConfig.embeds === false || guildConfig.embedMentions) name = member.user.toString();
          else name = member.nickname || member.user.username;
        }

        if (reserved.length < parseInt(game.players)) {
          reserved.push(reserved.length + 1 + ". " + name);
        } else {
          waitlist.push(reserved.length + waitlist.length + 1 + ". " + name);
        }
      });

    const eventTimes = aux.parseEventTimes(game.date, game.time, game.timezone, {
      name: game.adventure,
      location: `${guild.name} - ${game.where}`,
      description: game.description
    });
    const rawDate = eventTimes.rawDate;
    const timezone = "UTC" + (game.timezone >= 0 ? "+" : "") + game.timezone;
    const where = parseDiscord(game.where, guild);
    let description = parseDiscord(game.description, guild);

    let signups = "";
    let automatedInstructions = `\n(${guildConfig.emojiAdd} ${lang.buttons.SIGN_UP}${
      guildConfig.dropOut ? ` | ${guildConfig.emojiRemove} ${lang.buttons.DROP_OUT}` : ""
    })`;
    if (game.method === GameMethod.AUTOMATED) {
      if (reserved.length > 0) signups += `\n**${lang.game.RESERVED}:**\n${reserved.join("\n")}\n`;
      if (waitlist.length > 0) signups += `\n**${lang.game.WAITLISTED}:**\n${waitlist.join("\n")}\n`;
      signups += automatedInstructions;
    } else if (game.method === GameMethod.CUSTOM) {
      signups += `\n${game.customSignup}`;
    }

    let when = "";
    if (game.when === GameWhen.DATETIME) {
      const date = Game.ISOGameDate(game);
      const tz = Math.round(parseFloat(game.timezone.toString()) * 4) / 4;
      when =
        moment(date)
          .utcOffset(tz)
          .format(config.formats.dateLong) + ` (${timezone})`;
      game.timestamp = new Date(rawDate).getTime();
    } else if (game.when === GameWhen.NOW) {
      when = lang.game.options.NOW;
      game.timestamp = new Date().getTime();
    }

    let msg =
      `\n**${lang.game.GM}:** ${dm}` +
      `\n**${lang.game.GAME_NAME}:** ${game.adventure}` +
      `\n**${lang.game.RUN_TIME}:** ${game.runtime} ${lang.game.labels.HOURS}` +
      `\n**${lang.game.WHEN}:** ${game.hideDate ? lang.game.labels.TBD : when}` +
      `\n**${lang.game.WHERE}:** ${where}` +
      `\n${description.length > 0 ? `**${lang.game.DESCRIPTION}:**\n${description}\n` : description}` +
      `\n${signups}`;

    if (game.gameImage.trim().length > 2048) {
      game.gameImage = "";
    }

    let embed: MessageEmbed;
    if (guildConfig.embeds === false) {
      if (game && game.gameImage && game.gameImage.trim().length > 0) { 
        embed = new discord.MessageEmbed();
        embed.setColor(guildConfig.embedColor);
        embed.setImage(game.gameImage.trim().substr(0, 2048)); 
      }
    } 
    else {
      msg = "";
      embed = new discord.MessageEmbed();
      embed.setColor(guildConfig.embedColor);
      embed.setTitle(game.adventure);
      if (dmmember && dmmember.user.avatarURL()) embed.setAuthor(dm, dmmember.user.avatarURL().substr(0, 2048));
      if (dmmember && dmmember.user.avatarURL()) embed.setThumbnail(dmmember.user.avatarURL().substr(0, 2048));
      if(description.length > 0) embed.setDescription(description);
      if (game.hideDate) embed.addField(lang.game.WHEN, lang.game.labels.TBD, true);
      else embed.addField(lang.game.WHEN, when, true);
      if(game.runtime && game.runtime.trim().length > 0 && game.runtime.trim() != '0') embed.addField(lang.game.RUN_TIME, `${game.runtime} ${lang.game.labels.HOURS}`, true);
      embed.addField(lang.game.WHERE, where);
      if (guildConfig.embedMentions) embed.addField(lang.game.GM, gmTag);
      if (game.method === GameMethod.AUTOMATED) {
        embed.addField(`${lang.game.RESERVED} (${reserved.length}/${game.players})`, reserved.length > 0 ? reserved.join("\n") : lang.game.NO_PLAYERS, true);
        if (waitlist.length > 0) embed.addField(`${lang.game.WAITLISTED} (${waitlist.length})`, waitlist.join("\n"), true);
      } else if (game.method === GameMethod.CUSTOM) {
        embed.addField(lang.game.CUSTOM_SIGNUP_INSTRUCTIONS, game.customSignup);
      }
      embed.addField("Links", `[📅 ${lang.game.ADD_TO_CALENDAR}](${eventTimes.googleCal})\n[🗺 ${lang.game.CONVERT_TIME_ZONE}](${eventTimes.convert.timeAndDate})\n[⏰ ${lang.game.COUNTDOWN}](${eventTimes.countdown})`, true);
      if (game.method === GameMethod.AUTOMATED) embed.setFooter(automatedInstructions);
      if (game && game.gameImage && game.gameImage.trim().length > 0) embed.setImage(game.gameImage.trim().substr(0, 2048));
    }

    const dbCollection = connection().collection(collection);
    if (game._id) {
      game.sequence++;

      const prev = (await Game.fetch(game._id)).data;
      const updated = await dbCollection.updateOne({ _id: new ObjectId(game._id) }, { $set: game });
      let message: Message;
      try {
        message = await channel.messages.fetch(game.messageId);
        if (message) {
          message = await message.edit(msg, embed);
        }
        else {
          if (guildConfig.embeds === false) {
            message = <Message>await channel.send(msg, embed);
          } else {
            message = <Message>await channel.send(embed);
          }

          if (message) {
            await dbCollection.updateOne({ _id: new ObjectId(game._id) }, { $set: { messageId: message.id } });
            game.messageId = message.id;
          }
        }

        prev._id = prev._id.toString();
        game._id = game._id.toString();

        const updatedGame = aux.objectChanges(prev, game);
        io().emit("game", { action: "updated", gameId: game._id, game: updatedGame, guildId: game.s });
      } catch (err) {
        aux.log('UpdateGameError:', err);
        if (updated) updated.modifiedCount = 0;
      }
      const saved: GameSaveData = {
        _id: game._id,
        message: message,
        modified: updated && updated.modifiedCount > 0
      };
      return saved;
    } else {
      const inserted = await dbCollection.insertOne(game);
      let message: Message;
      let gcUpdated = false;

      try {
        if (guildConfig.embeds === false) {
          message = <Message>await channel.send(msg, embed);
        } else {
          message = <Message>await channel.send(embed);
        }
        
        try {
          if (game.method === GameMethod.AUTOMATED) await message.react(guildConfig.emojiAdd);
        }
        catch(err) {
          if (!aux.isEmoji(guildConfig.emojiAdd)) {
            gcUpdated = true;
            guildConfig.emojiAdd = '➕';
            if (game.method === GameMethod.AUTOMATED) await message.react(guildConfig.emojiAdd);
          }
        }
        try {
          if (game.method === GameMethod.AUTOMATED && guildConfig.dropOut) await message.react(guildConfig.emojiRemove);
        }
        catch(err) {
          if (!aux.isEmoji(guildConfig.emojiRemove)) {
            gcUpdated = true;
            guildConfig.emojiRemove = '➖';
            if (game.method === GameMethod.AUTOMATED && guildConfig.dropOut) await message.react(guildConfig.emojiRemove);
          }
        }
      }
      catch(err) {
        aux.log('InsertGameError:', game.s, err);
      }

      if (gcUpdated) {
        guildConfig.save(guildConfig.data);
        guildConfig.updateReactions();
      }

      let updated;
      if (message) {
        updated = await dbCollection.updateOne({ _id: new ObjectId(inserted.insertedId) }, { $set: { messageId: message.id } });
        if (dmmember) {
          try {
            const pm: any = await dmmember.send(
              lang.game.EDIT_LINK.replace(/\:server_name/gi, guild.name).replace(/\:game_name/gi, game.adventure) +
                "\n" +
                host +
                config.urls.game.create.path +
                "?g=" +
                inserted.insertedId
            );
            await dbCollection.updateOne({ _id: new ObjectId(inserted.insertedId) }, { $set: { pm: pm.id } });
          }
          catch(err) {
            aux.log('EditLinkError:', err);
          }
        }
      }
      else {
        aux.log(`GameMessageNotPostedError:\n`, game.s, `${msg}\n`, embed);
      }

      io().emit("game", { action: "new", gameId: inserted.insertedId.toString(), guildId: game.s });

      const saved: GameSaveData = {
        _id: inserted.insertedId.toString(),
        message: message,
        modified: updated && updated.modifiedCount > 0
      };
      return saved;
    }
  }

  static async fetch(gameId: string | number | ObjectID): Promise<Game> {
    if (!connection()) { aux.log("No database connection"); return null; }
    const game = await connection()
      .collection(collection)
      .findOne({ _id: new ObjectId(gameId) });
    return game ? new Game(game) : null;
  }

  static async fetchBy(key: string, value: any): Promise<Game> {
    if (!connection()) { aux.log("No database connection"); return null; }
    const query: mongodb.FilterQuery<any> = aux.fromEntries([[key, value]]);
    const game: GameModel = await connection()
      .collection(collection)
      .findOne(query);
    return game ? new Game(game) : null;
  }

  static async fetchAllBy(query: mongodb.FilterQuery<any>): Promise<Game[]> {
    if (!connection()) { aux.log("No database connection"); return []; }
    const games: GameModel[] = await connection()
      .collection(collection)
      .find(query)
      .toArray();
    return games.map(game => {
      return new Game(game);
    });
  }

  static async fetchAllByLimit(query: mongodb.FilterQuery<any>, limit: number): Promise<Game[]> {
    if (!connection()) { aux.log("No database connection"); return []; }
    const games: GameModel[] = await connection()
      .collection(collection)
      .find(query)
      .limit(limit)
      .toArray();
    return games.map(game => {
      return new Game(game);
    });
  }

  static async deleteAllBy(query: mongodb.FilterQuery<any>) {
    if (!connection()) { aux.log("No database connection"); return null; }
    return await connection()
      .collection(collection)
      .deleteMany(query);
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
    const hours = isNaN(parseFloat(this.runtime.trim())) ? 0 : Math.abs(parseFloat(this.runtime.trim()));
    const gameEnded = this.timestamp + hours * 3600 * 1000 < new Date().getTime();
    const nextDate = Game.getNextDate(moment(this.date), validDays, Number(this.frequency), this.monthlyType);
    const nextISO = `${nextDate.replace(/-/g, "")}T${this.time.replace(/:/g, "")}00${this.timezone >= 0 ? "+" : "-"}${aux.parseTimeZoneISO(this.timezone)}`;
    const nextGamePassed = new Date(nextISO).getTime() <= new Date().getTime();
    return gameEnded && !this.rescheduled && !nextGamePassed && ((this.frequency == Frequency.DAILY || this.frequency == Frequency.MONTHLY) ||
            ((this.frequency == Frequency.WEEKLY || this.frequency == Frequency.BIWEEKLY) && validDays.length > 0));
  }

  async reschedule() {
    const validDays = this.getWeekdays();
    const nextDate = Game.getNextDate(moment(this.date), validDays, Number(this.frequency), this.monthlyType);
    aux.log(`Rescheduling ${this.s}: ${this.adventure} from ${this.date} (${this.time}) to ${nextDate} (${this.time})`);
    this.date = nextDate;

    if (this.clearReservedOnRepeat) {
      this.reserved = "";
    }

    const guildConfig = await GuildConfig.fetch(this.s);
    if (guildConfig.rescheduleMode === RescheduleMode.UPDATE) {
      await this.save();
    }
    else if (guildConfig.rescheduleMode === RescheduleMode.REPOST) {
      let data = cloneDeep(this.data);
      delete data._id;
      const game = new Game(data);
      const newGame = await game.save();
      const del = await this.delete();
      if (del.deletedCount == 0) {
        const del2 = await this.softDelete(this._id);
        if (del2.deletedCount == 0) {
          this.reminded = true;
          await this.save();
        }
      }
      io().emit("game", { action: "rescheduled", gameId: this._id, newGameId: newGame._id, guildId: game.s });
    }
    return true;
  }

  async softDelete(_id: string | number | mongodb.ObjectID) {
    return await connection()
      .collection(collection)
      .deleteOne({ _id: new ObjectId(_id) });
  }

  async delete(options: any = {}) {
    if (!connection()) { aux.log("No database connection"); return null; }

    const result = await this.softDelete(this._id);

    const { sendWS = true } = options;
    const game: GameModel = this;
    const channel = this._channel;

    if (channel) {
      try {
        if (game.messageId) {
          const message = await channel.messages.fetch(game.messageId);
          if (message) {
            message.delete().catch((err) => {
              aux.log('Attempted to delete announcement message.');
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
              aux.log('Attempted to delete reminder message.');
              // aux.log(err);
            });
          }
        }
      } catch (e) {
        aux.log("Reminder: ", e.message);
      }

      try {
        if (game.pm) {
          const guildMembers = await channel.guild.members.fetch();
          const dm = guildMembers.find(m => m.user.tag === game.dm);
          if (dm && dm.user.dmChannel) {
            const pm = await dm.user.dmChannel.messages.fetch(game.pm);
            if (pm) {
              pm.delete().catch((err) => {
                aux.log('Attempted to delete game edit link pm.');
                // aux.log(err);
              });
            }
          }
        }
      } catch (e) {
        aux.log("DM: ", e.message);
      }
    }

    if (sendWS) io().emit("game", { action: "deleted", gameId: game._id, guildId: game.s });
    return result;
  }

  static ISOGameDate(game: GameModel) {
    return `${game.date.replace(/-/g, "")}T${game.time.replace(/:/g, "")}00${game.timezone >= 0 ? "+" : "-"}${aux.parseTimeZoneISO(game.timezone)}`;
  }

  static getNextDate(baseDate: moment.Moment, validDays: string[], frequency: Frequency, monthlyType: MonthlyType) {
    if (frequency == Frequency.NO_REPEAT)
        return null;
  
    let dateGenerator;
    let nextDate = baseDate;

    switch(frequency) {
      case Frequency.DAILY:
        nextDate = moment(baseDate).add(1, 'days');
        break;
      case Frequency.WEEKLY: // weekly
        if (validDays === undefined || validDays.length === 0)
          break;
        dateGenerator = moment(baseDate).recur().every(validDays).daysOfWeek();
        nextDate = dateGenerator.next(1)[0];
        break;
      case Frequency.BIWEEKLY: // biweekly
        if (validDays === undefined || validDays.length === 0)
          break;
        // this is a compound interval...
        dateGenerator = moment(baseDate).recur().every(validDays).daysOfWeek();
        nextDate = dateGenerator.next(1)[0];
        while(nextDate.week() - moment(baseDate).week() == 1) { // if the next date is in the same week, diff = 0. if it is just next week, diff = 1, so keep going forward.
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
        }
        else {
          nextDate = moment(baseDate).add(1, 'month');
        }
        break;
      default:
        throw new Error(`invalid frequency ${frequency} specified`);
    }
  
    return moment(nextDate).format('YYYY-MM-DD');
  }
}

const parseDiscord = (text: string, guild: Guild) => {
  try {
    guild.members.cache.array().forEach(mem => {
      text = text.replace(new RegExp(`\@${aux.backslash(mem.user.tag)}`, "gi"), mem.toString());
    });
    guild.channels.cache.array().forEach(c => {
      text = text.replace(new RegExp(`\#${aux.backslash(c.name)}`, "gi"), c.toString());
    });
    guild.roles.cache.array().forEach(role => {
      if (!role.mentionable) return;
      text = text.replace(new RegExp(`\@${aux.backslash(role.name)}`, "gi"), role.toString());
    });
  } catch (err) {
    aux.log(err);
  }
  return text;
};
