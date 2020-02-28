import mongodb, { ObjectID } from "mongodb";
import discord, { Message, Guild, TextChannel, MessageEditOptions, RichEmbed } from "discord.js";
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

export interface GameModel {
  _id: string | number | ObjectID;
  s: string;
  c: string;
  guild: string;
  channel: string;
  adventure: string;
  runtime: string;
  players: string;
  dm: string;
  where: string;
  description: string;
  reserved: string;
  method: string;
  customSignup: string;
  when: string;
  date: string;
  time: string;
  timezone: number;
  timestamp: number;
  reminder: string;
  messageId: string;
  reminderMessageId: string;
  pm: string;
  gameImage: string;
  frequency: Frequency;
  weekdays: boolean[];
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
  players: string;
  dm: string;
  where: string;
  description: string;
  reserved: string;
  method: string;
  customSignup: string;
  when: string;
  date: string;
  time: string;
  timezone: number;
  timestamp: number;
  reminder: string;
  messageId: string;
  reminderMessageId: string;
  pm: string;
  gameImage: string;
  frequency: Frequency;
  weekdays: boolean[] = [false,false,false,false,false,false,false];

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
    this._guild = discordClient().guilds.get(this.s);
    if (this._guild) {
      this._guild.channels.forEach(c => {
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
      reminder: this.reminder,
      messageId: this.messageId,
      reminderMessageId: this.reminderMessageId,
      pm: this.pm,
      gameImage: this.gameImage,
      frequency: this.frequency,
      weekdays: this.weekdays
    };
  }

  async save() {
    if (!connection()) throw new Error("No database connection");
    const channel = this._channel;
    const guild = channel.guild;
    const guildConfig = await GuildConfig.fetch(guild.id);
    const game: GameModel = this.data;

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
    let dmmember = guild.members.array().find(mem => {
      return mem.user.tag === game.dm.trim().replace("@", "");
    });
    if (!dmmember) dm = game.dm.trim();//throw new Error(lang.game.GM_ERROR);
    else if (guildConfig.embeds === false) dm = dmmember.user.toString();

    let reserved: string[] = [];
    let waitlist: string[] = [];
    game.reserved
      .replace(/@/g, "")
      .split(/\r?\n/)
      .forEach((res: string) => {
        if (res.trim().length === 0) return;
        let member = guild.members.array().find(mem => mem.user.tag.trim() === res.trim());

        let name = res.trim().replace(/\#\d{4}/, "");
        if (member) {
          if (guildConfig.embeds === false) name = member.user.toString();
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
    const description = parseDiscord(game.description, guild);

    let signups = "";
    let automatedInstructions = `\n(${guildConfig.emojiAdd} ${lang.buttons.SIGN_UP}${
      guildConfig.dropOut ? ` | ${guildConfig.emojiRemove} ${lang.buttons.DROP_OUT}` : ""
    })`;
    if (game.method === "automated") {
      if (reserved.length > 0) signups += `\n**${lang.game.RESERVED}:**\n${reserved.join("\n")}\n`;
      if (waitlist.length > 0) signups += `\n**${lang.game.WAITLISTED}:**\n${waitlist.join("\n")}\n`;
      signups += automatedInstructions;
    } else if (game.method === "custom") {
      signups += `\n${game.customSignup}`;
    }

    let when = "";
    if (game.when === "datetime") {
      const date = Game.ISOGameDate(game);
      const tz = Math.round(parseFloat(game.timezone.toString()) * 4) / 4;
      when =
        moment(date)
          .utcOffset(tz)
          .format(config.formats.dateLong) + ` (${timezone})`;
      game.timestamp = new Date(rawDate).getTime();
    } else if (game.when === "now") {
      when = lang.game.options.NOW;
      game.timestamp = new Date().getTime();
    }

    let msg =
      `\n**${lang.game.GM}:** ${dm}` +
      `\n**${lang.game.GAME_NAME}:** ${game.adventure}` +
      `\n**${lang.game.RUN_TIME}:** ${game.runtime} ${lang.game.labels.HOURS}` +
      `\n**${lang.game.WHEN}:** ${when}` +
      `\n**${lang.game.WHERE}:** ${where}` +
      `\n${description.length > 0 ? `**${lang.game.DESCRIPTION}:**\n${description}\n` : description}` +
      `\n${signups}`;

    let embed: MessageEditOptions | RichEmbed = new discord.RichEmbed(); 
    if (guildConfig.embeds === false) {
      embed.setColor(guildConfig.embedColor);
      let embedded = false;
      if (game && game.gameImage && game.gameImage.trim().length > 0) { embedded = true; embed.setImage(game.gameImage.trim()); }
      if (!embedded) embed = { embed: {} };
    } 
    else {
      embed.setColor(guildConfig.embedColor);
      embed.setTitle(game.adventure);
      embed.setAuthor(dm, dmmember.user.avatarURL);
      if (dmmember) embed.setThumbnail(dmmember.user.avatarURL);
      if(description.length > 0) embed.setDescription(description);
      embed.addField(lang.game.WHEN, when, true);
      if(game.runtime && game.runtime.trim().length > 0 && game.runtime.trim() != '0') embed.addField(lang.game.RUN_TIME, `${game.runtime} ${lang.game.labels.HOURS}`, true);
      embed.addField(lang.game.WHERE, where);
      embed.addField(`${lang.game.RESERVED} (${reserved.length}/${game.players})`, reserved.length > 0 ? reserved.join("\n") : lang.game.NO_PLAYERS, true);
      if (waitlist.length > 0) embed.addField(`${lang.game.WAITLISTED} (${waitlist.length})`, waitlist.join("\n"), true);
      embed.addField("Links", `[📅 ${lang.game.ADD_TO_CALENDAR}](${eventTimes.googleCal})\n[🗺 ${lang.game.CONVERT_TIME_ZONE}](${eventTimes.convert.timeAndDate})\n[⏰ ${lang.game.COUNTDOWN}](${eventTimes.countdown})`, true);
      if (game.method === 'automated') embed.setFooter(automatedInstructions);
      if (game && game.gameImage && game.gameImage.trim().length > 0) embed.setImage(game.gameImage.trim());
    }

    const dbCollection = connection().collection(collection);
    if (game._id) {
      const prev = (await Game.fetch(game._id)).data;
      const updated = await dbCollection.updateOne({ _id: new ObjectId(game._id) }, { $set: game });
      let message: Message;
      try {
        message = await channel.fetchMessage(game.messageId);
        if (guildConfig.embeds === false) {
          message = await message.edit(msg, embed);
        } else {
          message = await message.edit(embed);
        }

        prev._id = prev._id.toString();
        game._id = game._id.toString();

        const updatedGame = aux.objectChanges(prev, game);
        io().emit("game", { action: "updated", gameId: game._id, game: updatedGame });
      } catch (err) {
        updated.modifiedCount = 0;
      }
      const saved: GameSaveData = {
        _id: game._id,
        message: message,
        modified: updated.modifiedCount > 0
      };
      return saved;
    } else {
      const inserted = await dbCollection.insertOne(game);
      let message: Message;
      if (guildConfig.embeds === false) {
        message = <Message>await channel.send(msg, embed);
      } else {
        message = <Message>await channel.send(embed);
      }
      if (game.method === "automated") await message.react(guildConfig.emojiAdd);
      if (game.method === "automated" && guildConfig.dropOut) await message.react(guildConfig.emojiRemove);
      const updated = await dbCollection.updateOne({ _id: new ObjectId(inserted.insertedId) }, { $set: { messageId: message.id } });
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
        catch(err) {}
      }
      const saved: GameSaveData = {
        _id: inserted.insertedId.toString(),
        message: message,
        modified: updated.modifiedCount > 0
      };
      return saved;
    }
  }

  static async fetch(gameId: string | number | ObjectID): Promise<Game> {
    if (!connection()) throw new Error("No database connection");
    const game = await connection()
      .collection(collection)
      .findOne({ _id: new ObjectId(gameId) });
    return game ? new Game(game) : null;
  }

  static async fetchBy(key: string, value: any): Promise<Game> {
    if (!connection()) throw new Error("No database connection");
    const query: mongodb.FilterQuery<any> = aux.fromEntries([[key, value]]);
    const game: GameModel = await connection()
      .collection(collection)
      .findOne(query);
    return game ? new Game(game) : null;
  }

  static async fetchAllBy(query: mongodb.FilterQuery<any>): Promise<Game[]> {
    if (!connection()) throw new Error("No database connection");
    const games: GameModel[] = await connection()
      .collection(collection)
      .find(query)
      .toArray();
    return games.map(game => {
      return new Game(game);
    });
  }

  static async deleteAllBy(query: mongodb.FilterQuery<any>) {
    if (!connection()) throw new Error("No database connection");
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
    const hours = this.runtime == null || this.runtime.trim() == '0' || this.runtime.trim() == '' ? 0 : parseFloat(this.runtime);
    const gameEnded = this.timestamp + hours * 3600 * 1000 < new Date().getTime();
    return gameEnded && ((this.frequency == Frequency.DAILY || this.frequency == Frequency.MONTHLY) ||
            ((this.frequency == Frequency.WEEKLY || this.frequency == Frequency.BIWEEKLY) && validDays.length > 0));
  }

  async reschedule() {
    const validDays = this.getWeekdays();
    const nextDate = Game.getNextDate(moment(this.date), validDays, Number(this.frequency));
    console.log(`rescheduling ${this._id} from ${this.date} to ${nextDate} ${new Date(nextDate).getTime()}`);
    this.date = nextDate;

    const guildConfig = await GuildConfig.fetch(this.s);

    if (guildConfig.rescheduleMode === "update") {
      this.save();
    }
    else {

      let data = cloneDeep(this.data);
      delete data._id;
      const game = new Game(data);
      const newGame = await game.save();
      io().emit("game", { action: "rescheduled", gameId: this._id, newGameId: newGame._id });
      this.delete();
    }
  }

  async delete(options: any = {}) {
    if (!connection()) throw new Error("No database connection");

    const { sendWS = true } = options;
    const game: GameModel = this;
    const channel = this._channel;

    if (channel) {
      try {
        if (game.messageId) {
          const message = await channel.fetchMessage(game.messageId);
          if (message) {
            message.delete().catch((err) => {
              console.log('Attempted to delete announcement message.');
              console.log(err);
            });
          }
        }
      } catch (e) {
        console.log("Announcement: ", e.message);
      }

      try {
        if (game.reminderMessageId) {
          const message = await channel.fetchMessage(game.reminderMessageId);
          if (message) {
            message.delete().catch((err) => {
              console.log('Attempted to delete reminder message.');
              console.log(err);
            });
          }
        }
      } catch (e) {
        console.log("Reminder: ", e.message);
      }

      try {
        if (game.pm) {
          const dm = channel.guild.members.array().find(m => m.user.tag === game.dm);
          if (dm && dm.user.dmChannel) {
            const pm = dm.user.dmChannel.messages.get(game.pm);
            if (pm) {
              pm.delete().catch((err) => {
                console.log('Attempted to delete game edit link pm.');
                console.log(err);
              });
            }
          }
        }
      } catch (e) {
        console.log("DM: ", e.message);
      }
    }
    if (sendWS) io().emit("game", { action: "deleted", gameId: game._id });
    return await connection()
      .collection(collection)
      .deleteOne({ _id: new ObjectId(game._id) });
  }

  static ISOGameDate(game: GameModel) {
    return `${game.date.replace(/-/g, "")}T${game.time.replace(/:/g, "")}00${game.timezone >= 0 ? "+" : "-"}${aux.parseTimeZoneISO(game.timezone)}`;
  }

  static getNextDate(baseDate: moment.Moment, validDays: string[], frequency: Frequency) {
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
        nextDate = moment(baseDate).add(1, 'month');
        break;
      default:
        throw new Error(`invalid frequency ${frequency} specified`);
    }
  
    return moment(nextDate).format('YYYY-MM-DD');
  }
}

const parseDiscord = (text: string, guild: Guild) => {
  try {
    guild.members.array().forEach(mem => {
      text = text.replace(new RegExp(`\@${aux.backslash(mem.user.tag)}`, "gi"), mem.toString());
    });
    guild.channels.array().forEach(c => {
      text = text.replace(new RegExp(`\#${aux.backslash(c.name)}`, "gi"), c.toString());
    });
    guild.roles.array().forEach(role => {
      if (!role.mentionable) return;
      text = text.replace(new RegExp(`\@${aux.backslash(role.name)}`, "gi"), role.toString());
    });
  } catch (err) {
    console.log(err);
  }
  return text;
};
