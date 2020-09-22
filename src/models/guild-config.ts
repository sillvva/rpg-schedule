import db from "../db";
import { ObjectID, ObjectId, FilterQuery } from "mongodb";
import { Game, GameReminder } from "./game";
import aux from "../appaux";
import { GuildMember, Client, TextChannel, NewsChannel } from "discord.js";
import { ShardMember } from "../processes/shard-manager";
import { isObject } from "lodash";

const supportedLanguages = require("../../lang/langs.json");
const langs = supportedLanguages.langs
  .map((lang: String) => {
    return {
      code: lang,
      ...require(`../../lang/${lang}.json`),
    };
  })
  .sort((a: any, b: any) => (a.name > b.name ? 1 : -1));

const connection = db.connection;
const collection = "guildConfig";

export type MongoDBId = string | number | ObjectID;

export interface GameDefaults {
  minPlayers: number;
  maxPlayers: number;
  reminder: GameReminder;
}

export interface GameTemplate {
  id?: MongoDBId;
  name: string;
  isDefault: boolean;
  role?: string | ConfigRole;
  playerRole?: string | ConfigRole;
  embedColor?: string;
  gameDefaults?: GameDefaults;
}

export interface ConfigRole {
  id: string;
  name: string;
}

export interface ChannelConfig {
  channelId: string;
  gameTemplates: MongoDBId[];
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
  embedMentionsAbove?: boolean;
  emojiAdd?: string;
  emojiRemove?: string;
  password?: string;
  role?: string | ConfigRole;
  hidden?: boolean;
  dropOut?: boolean;
  lang?: string;
  privateReminders?: boolean;
  rescheduleMode?: string;
  managerRole?: string | ConfigRole;
  escape?: string;
  gameTemplates?: GameTemplate[];
}

interface GuildConfigDataModel extends GuildConfigModel {
  _id?: MongoDBId;
  saveDefaultTemplate?: boolean;
}

export class GuildConfig implements GuildConfigDataModel {
  _id: MongoDBId;
  guild: string = null;
  channel: ChannelConfig[] = [];
  pruning: boolean = false;
  pruneIntEvents: number = 2;
  pruneIntDiscord: number = 2;
  embeds: boolean = true;
  embedColor: string = "#2196f3";
  embedMentions: boolean = false;
  embedMentionsAbove: boolean = true;
  emojiAdd: string = "➕";
  emojiRemove: string = "➖";
  password: string = "";
  role: string | ConfigRole = null;
  hidden: boolean = false;
  dropOut: boolean = true;
  lang: string = "en";
  privateReminders: boolean = false;
  rescheduleMode: string = "repost";
  managerRole: string | ConfigRole = null;
  escape?: "!";
  gameTemplates?: GameTemplate[] = [];
  saveDefaultTemplate = false;

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
        if (typeof value === "string") {
          this[key] = [
            {
              channelId: value,
              gameTemplates: [],
            },
          ];
        } else if (Array.isArray(value)) {
          this[key] = value
            .map((c) => {
              if (typeof c === "string") {
                return {
                  channelId: c,
                  gameTemplates: [],
                };
              } else
                return {
                  gameTemplates: [],
                  ...c,
                };
            })
            .filter((c, i) => i === value.findIndex((ci) => ci.channelId === c.channelId));
        }
      } else if (key === "gameTemplates") {
        this[key] = (value || []).map((gt) => {
          gt.embedColor = aux.colorFixer(gt.embedColor);
          return gt;
        });
      } else if (key === "embedColor") {
        this[key] = aux.colorFixer(value);
      } else this[key] = value;
    }

    if (this.gameTemplates.length === 0) {
      this.saveDefaultTemplate = true;
      const defaultGameTemplate = this.defaultGameTemplate;
      this.gameTemplates.push(defaultGameTemplate);
      this.channel = this.channel.map((channel) => {
        channel.gameTemplates = [defaultGameTemplate.id];
        return channel;
      });
    }
  }

  get defaultGameTemplate(): GameTemplate {
    const defaultGT = this.gameTemplates.find((gt) => gt.isDefault);
    if (defaultGT) return defaultGT;

    const lang = langs.find((l) => l.code === this.lang) || langs.find((l) => l.code === "en");

    return {
      id: new ObjectId().toHexString(),
      name: lang ? lang.config.DEFAULT : "Default",
      isDefault: true,
      embedColor: aux.colorFixer(this.embedColor),
      role: this.role,
      playerRole: null,
      gameDefaults: {
        minPlayers: 1,
        maxPlayers: 7,
        reminder: GameReminder.NO_REMINDER,
      },
    };
  }

  async save(data: GuildConfigModel = {}) {
    if (!connection()) throw new Error("No database connection");
    if (!data.guild && !this.guild) throw new Error("Guild ID not specified");
    const config: GuildConfigDataModel = this.data;
    const updates = { ...config, ...data };

    const defaultGameTemplate = this.defaultGameTemplate;
    if (updates.gameTemplates.length === 0) updates.gameTemplates.push(defaultGameTemplate);
    updates.gameTemplates = updates.gameTemplates.map((gt) => {
      if (!gt.id) gt = { id: new ObjectId().toHexString(), ...gt };
      gt.embedColor = aux.colorFixer(gt.embedColor);
      return gt;
    });
    updates.channel = updates.channel.map((channel) => {
      if (!channel.gameTemplates) channel.gameTemplates = [];
      channel.gameTemplates = channel.gameTemplates.filter((cgt) => updates.gameTemplates.find((gt) => gt.id === cgt));
      channel.gameTemplates = channel.gameTemplates.map((cgt) => new ObjectId(cgt).toHexString());
      if (channel.gameTemplates.length === 0) {
        channel.gameTemplates = [defaultGameTemplate.id];
      }
      return channel;
    });
    updates.role = updates.gameTemplates.find((gt) => gt.isDefault).role;
    updates.embedColor = updates.gameTemplates.find((gt) => gt.isDefault).embedColor;

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
      embedMentionsAbove: this.embedMentionsAbove,
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
      escape: this.escape,
      gameTemplates: this.gameTemplates,
    };
  }

  get channels(): ChannelConfig[] {
    return this.channel;
  }

  static async fetch(guildId: string): Promise<GuildConfig> {
    if (!connection()) throw new Error("No database connection");
    const data = await connection().collection(collection).findOne({ guild: guildId });
    const gc = new GuildConfig(data || { guild: guildId });
    if (data && gc.saveDefaultTemplate) await gc.save();
    return gc;
  }

  static async fetchAll(): Promise<GuildConfig[]> {
    if (!connection()) throw new Error("No database connection");
    const guildConfigs = await connection().collection(collection).find().toArray();
    return guildConfigs.map((gc) => {
      return new GuildConfig(gc);
    });
  }

  static async fetchAllBy(query: FilterQuery<any>): Promise<GuildConfig[]> {
    if (!connection()) {
      aux.log("No database connection");
      return [];
    }
    const guildConfigs: GuildConfigModel[] = await connection().collection(collection).find(query).toArray();
    let gcs = [];
    for (let i = 0; i < guildConfigs.length; i++) {
      const gc = new GuildConfig(guildConfigs[i]);
      if (gc.saveDefaultTemplate) await gc.save();
      gcs.push(gc);
    }
    return gcs;
  }

  shardMemberHasPermission(member: ShardMember, channelId?: string) {
    return !!this.gameTemplates.find((gt) => {
      const matchedChannel = this.channel.find((c) => c.gameTemplates.find((cgt) => cgt === gt.id) && (!channelId || c.channelId === channelId));
      const userHasRole = !gt.role || !!member.roles.find((r) => isObject(gt.role) ? gt.role.id === r.id : gt.role.toLowerCase().trim() === r.name.toLowerCase().trim());
      return matchedChannel && userHasRole;
    });
  }

  memberHasPermission(member: GuildMember, channelId?: string) {
    return !!this.gameTemplates.find((gt) => {
      return (
        this.channel.find((c) => c.gameTemplates.find((cgt) => cgt === gt.id) && (!channelId || c.channelId === channelId)) &&
        (!gt.role || !!member.roles.cache.array().find((r) => isObject(gt.role) ? gt.role.id === r.id : gt.role.toLowerCase().trim() === r.name.toLowerCase().trim()))
      );
    });
  }

  async updateReactions(client: Client) {
    if (!client) return;

    const games = await Game.fetchAllBy(
      {
        s: this.guild,
        timestamp: {
          $gt: new Date().getTime(),
        },
      },
      client
    );

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const guild = client.guilds.cache.find((g) => g.id === game.discordGuild.id);
      if (guild) {
        const channel = <TextChannel | NewsChannel>guild.channels.cache.find((c) => (c instanceof TextChannel || c instanceof NewsChannel) && c.id === game.discordChannel.id);
        if (channel) {
          const message = await channel.messages.fetch(game.messageId);
          if (message) {
            try {
              await message.reactions.removeAll();
              message.react(this.emojiAdd);
              message.react(this.emojiRemove);
              game.save();
            } catch (err) {
              aux.log("UpdateReactionsError:", "Could not update emojis for game", game.adventure, `(${game.s})`, err);
            }
          }
        }
      }
    }
  }
}
