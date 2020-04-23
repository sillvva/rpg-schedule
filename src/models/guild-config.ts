import db from "../db";
import { ObjectID, ObjectId, FilterQuery } from "mongodb";
import { Game } from "./game";
import aux from "../appaux"

const connection = db.connection;
const collection = "guildConfig";

export interface GuildConfigModel {
  guild?: string;
  channel?: string | string[];
  pruning?: boolean;
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
  channel: string | string[] = [];
  pruning: boolean = false;
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
    Object.entries(guildConfig).forEach(([key, value]) => {
      this[key] = value;
    });
    for (let i in this.data) {
      if (typeof this[i] === "string") {
        this[i] = this[i].replace(/<\/?(\w+)((\s+\w+(\s*=\s*(?:".*?"|'.*?'|[\^'">\s]+))?)+\s*|\s*)\/?>/gm, "");
      }
    }
  }

  async save(data: GuildConfigModel = {}) {
    if (!connection()) throw new Error("No database connection");
    if (!data.guild && !this.guild) throw new Error("Guild ID not specified");
    const config: GuildConfigDataModel = this.data;
    const col = connection().collection(collection);
    return await col.updateOne({ _id: this._id }, { $set: { ...config, ...data } }, { upsert: true });
  }

  get data(): GuildConfigDataModel {
    return {
      _id: this._id,
      guild: this.guild,
      channel: this.channel,
      pruning: this.pruning,
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

  get channels(): string[] {
    if (this.channel instanceof Array) {
      return this.channel;
    } else {
      return [this.channel];
    }
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
    return guildConfigs.map(game => {
      return new GuildConfig(game);
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
