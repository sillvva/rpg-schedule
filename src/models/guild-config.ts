import db from "../db";

const connection = db.connection;
const collection = "guildConfig";

export interface GuildConfigModel {
    guild?: string;
    channel?: string | string[];
    pruning?: boolean;
    embeds?: boolean;
    password?: string;
    role?: string;
    hidden?: boolean;
}

export class GuildConfig implements GuildConfigModel {
    guild: string = null;
    channel: string | string[] = null;
    pruning: boolean = false;
    embeds: boolean = true;
    password: string = "";
    role: string = null;
    hidden: boolean = false;

    constructor(guildConfig: GuildConfigModel = {}) {
        Object.entries(guildConfig).forEach(([key, value]) => {
            this[key] = value;
        });
    }

    async save(data: GuildConfigModel) {
        if (!connection()) throw new Error("No database connection");
        if (!data.guild && !this.guild) throw new Error("Guild ID not specified");
        const config: GuildConfigModel = this;
        const col = connection().collection(collection);
        if (config) {
            return await col.updateOne({ guild: data.guild }, { $set: { ...config, ...data } });
        } else {
            return await col.insertOne(data);
        }
    }

    get channels(): string[] {
        let channels: string[] = [];
        if (this.channel instanceof Array) {
            channels = this.channel;
        } else {
            channels.push(this.channel);
        }
        return channels;
    }

    static async fetch(guildId: string): Promise<GuildConfig> {
        if (!connection()) throw new Error("No database connection");
        const guildConfig = new GuildConfig(await connection().collection(collection).findOne({ guild: guildId }));
        return guildConfig;
    }

    static async fetchAll(): Promise<GuildConfig[]> {
        if (!connection()) throw new Error("No database connection");
        const guildConfigs = await connection().collection(collection).find().toArray();
        return guildConfigs.map(gc => {
            return new GuildConfig(gc);
        });
    }
};
