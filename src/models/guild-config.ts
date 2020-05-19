import db from "../db";
import { ObjectID, ObjectId, FilterQuery } from "mongodb";
import { Game, GameReminder } from "./game";
import aux from "../appaux"

const connection = db.connection;
const collection = "guildConfig";

export interface GameDefaults {
  minPlayers?: number;
  maxPlayers: number;
  reminder: GameReminder;
}

export interface ChannelConfig {
  channelId: string;
  embedColor?: string;
  role?: string;
  gameDefaults?: GameDefaults;
}

export interface GuildConfigModel {
  guild?: string;
  channel?: ChannelConfig[];
  pruning?: boolean;
  pruneIntEvents?: number;
  pruneIntDiscord?: number;
  embeds?: boolean;
  embedColor?: string;
  embedMentions?: boolean;
  emojiAdd?: string;
  emojiRemove?: string;
  password?: string;
  role?: string;
  hidden?: boolean;
  dropOut?: boolean;
  lang?: string;
  privateReminders?: boolean;
  rescheduleMode?: string;
  managerRole?: string;
  escape?: string;
}

interface GuildConfigDataModel extends GuildConfigModel {
  _id?: string | number | ObjectID;
}

export class GuildConfig implements GuildConfigDataModel {
  _id: string | number | ObjectID;
  guild: string = null;
  channel: ChannelConfig[] = [];
  pruning: boolean = false;
  pruneIntEvents: number = 2;
  pruneIntDiscord: number = 2;
  embeds: boolean = true;
  embedColor: string = "#2196f3";
  embedMentions: boolean = false;
  emojiAdd: string = "➕";
  emojiRemove: string = "➖";
  password: string = "";
  role: string = null;
  hidden: boolean = false;
  dropOut: boolean = true;
  lang: string = "en";
  privateReminders: boolean = false;
  rescheduleMode: string = 'repost';
  managerRole: string = null;
  escape?: '!';

  constructor(guildConfig: GuildConfigDataModel = {}) {
    if (!guildConfig._id) this._id = new ObjectId();

    const gcEntries = Object.entries(guildConfig || {});
    for (let i = 0; i < gcEntries.length; i++) {
      let [key, value] = gcEntries[i];

      // Strip HTML Tags from Data
      if (typeof value === "string") {
        value = value.replace(/<\/?(\w+)((\s+\w+(\s*=\s*(?:".*?"|'.*?'|[\^'">\s]+))?)+\s*|\s*)\/?>/gm, "");
      }

      if (key === "channel") {
        const defaults = {
          minPlayers: 1,
          maxPlayers: 7,
          reminder: GameReminder.NO_REMINDER
        };
        if (typeof value === "string") {
          this[key] = [
            { 
              channelId: value,
              gameDefaults: defaults
            }
          ];
        }
        else if (Array.isArray(value)) {
          this[key] = value.map(c => {
            if (typeof c === "string") {
              return { 
                channelId: c,
                gameDefaults: defaults
              };
            }
            else return {
              gameDefaults: defaults,
              ...c
            };
          });
        }
      }
      else this[key] = value;
    }
  }

  async save(data: GuildConfigModel = {}) {
    if (!connection()) throw new Error("No database connection");
    if (!data.guild && !this.guild) throw new Error("Guild ID not specified");
    const config: GuildConfigDataModel = this.data;
    const updates = { ...config, ...data };
    
    const getData = await connection().collection(collection).findOne({ guild: config.guild });
    const currentConfig = new GuildConfig(getData || { guild: config.guild });
    updates.channel = updates.channel.map(c => {
      const ccChannel = currentConfig.channel.find(cc => cc.channelId === c.channelId);
      if (/^#([0-9abcdef]{4}$)/i.test((c.embedColor || "").trim())) c.embedColor = c.embedColor.slice(0, 4);
      if (/^#([0-9abcdef]{8}$)/i.test((c.embedColor || "").trim())) c.embedColor = c.embedColor.slice(0, 7);
      if (ccChannel && !ccChannel.embedColor && !/^#([0-9abcdef]{3}|[0-9abcdef]{6})$/i.test((c.embedColor || "").trim())) {
        c.embedColor = ccChannel.embedColor || null;
      }
      else if (!/^#([0-9abcdef]{3}|[0-9abcdef]{6})$/i.test((c.embedColor || "").trim())) c.embedColor = null;
      if (ccChannel && !ccChannel.role && (c.role || "").trim().length === 0) {
        c.role = ccChannel.role || null;
      }
      else if ((c.role || "").trim().length === 0) c.role = null;
      return c;
    });

    const col = connection().collection(collection);
    
    delete updates._id;
    return await col.updateOne({ _id: new ObjectId(this._id) }, { $set: updates }, { upsert: true });
  }

  get data(): GuildConfigDataModel {
    return {
      _id: this._id,
      guild: this.guild,
      channel: this.channel,
      pruning: this.pruning,
      pruneIntEvents: this.pruneIntEvents,
      pruneIntDiscord: this.pruneIntDiscord,
      embeds: this.embeds,
      embedColor: this.embedColor,
      embedMentions: this.embedMentions,
      emojiAdd: this.emojiAdd,
      emojiRemove: this.emojiRemove,
      password: this.password,
      role: this.role,
      hidden: this.hidden,
      dropOut: this.dropOut,
      lang: this.lang,
      privateReminders: this.privateReminders,
      rescheduleMode: this.rescheduleMode,
      managerRole: this.managerRole,
      escape: this.escape
    };
  }

  get channels(): ChannelConfig[] {
    return this.channel;
  }

  static async fetch(guildId: string): Promise<GuildConfig> {
    if (!connection()) throw new Error("No database connection");
    const data = await connection()
      .collection(collection)
      .findOne({ guild: guildId });
    return new GuildConfig(data || { guild: guildId });
  }

  static async fetchAll(): Promise<GuildConfig[]> {
    if (!connection()) throw new Error("No database connection");
    const guildConfigs = await connection()
      .collection(collection)
      .find()
      .toArray();
    return guildConfigs.map(gc => {
      return new GuildConfig(gc);
    });
  }

  static async fetchAllBy(query: FilterQuery<any>): Promise<GuildConfig[]> {
    if (!connection()) { aux.log("No database connection"); return []; }
    const guildConfigs: GuildConfigModel[] = await connection()
      .collection(collection)
      .find(query)
      .toArray();
    return guildConfigs.map(gc => {
      return new GuildConfig(gc);
    });
  }

  async updateReactions() {
    const games = await Game.fetchAllBy({
      s: this.guild,
      timestamp: {
        $gt: new Date().getTime()
      }
    });

    for(let i = 0; i < games.length; i++) {
      const game = games[i];
      const message = await game.discordChannel.messages.fetch(game.messageId);
      if (message) {
        try {
          await message.reactions.removeAll();
          message.react(this.emojiAdd);
          message.react(this.emojiRemove);
          game.save();
        }
        catch(err) {
          aux.log('UpdateReactionsError:', 'Could not update emojis for game', game.adventure, `(${game.s})`, err);
        }
      }
    }
  }
}
