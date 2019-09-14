import db from "../db";
import { ObjectID, ObjectId } from "mongodb";

const connection = db.connection;
const collection = "guildConfig";

export interface GuildConfigModel {
  guild?: string;
  channel?: string | string[];
  pruning?: boolean;
  embeds?: boolean;
  embedColor?: string;
  emojiAdd?: string;
  emojiRemove?: string;
  password?: string;
  role?: string;
  hidden?: boolean;
  dropOut?: boolean;
  lang?: string;
  privateReminders?: boolean;
  managerRole?: string;
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
  emojiAdd: string = "➕";
  emojiRemove: string = "➖";
  password: string = "";
  role: string = null;
  hidden: boolean = false;
  dropOut: boolean = true;
  lang: string = "en";
  privateReminders: boolean = false;
  managerRole: string = null;

  constructor(guildConfig: GuildConfigDataModel = {}) {
    if (!guildConfig._id) this._id = new ObjectId();
    Object.entries(guildConfig).forEach(([key, value]) => {
      this[key] = value;
    });
  }

  async save(data: GuildConfigModel) {
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
      emojiAdd: this.emojiAdd,
      emojiRemove: this.emojiRemove,
      password: this.password,
      role: this.role,
      hidden: this.hidden,
      dropOut: this.dropOut,
      lang: this.lang,
      privateReminders: this.privateReminders,
      managerRole: this.managerRole
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
}
