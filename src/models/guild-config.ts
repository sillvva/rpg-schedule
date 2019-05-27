import db from "../db";
import { InsertOneWriteOpResult, UpdateWriteOpResult } from "mongodb";

const connection = db.connection;
const collection = "guildConfig";

export interface GuildConfigModel {
    guild: string;
    channel: string;
    pruning: boolean;
    embeds: boolean;
    password: string;
    role: string;
}

export class GuildConfig {
    static defaultConfig(guildId: string = null): GuildConfigModel {
        return {
            guild: guildId,
            channel: null,
            pruning: false,
            embeds: true,
            password: "",
            role: null
        };
    }

    static async save(data: {guild: string, channel: string}): Promise<InsertOneWriteOpResult | UpdateWriteOpResult>;
    static async save(data: {guild: string, pruning: boolean}): Promise<InsertOneWriteOpResult | UpdateWriteOpResult>;
    static async save(data: {guild: string, embeds: boolean}): Promise<InsertOneWriteOpResult | UpdateWriteOpResult>;
    static async save(data: {guild: string, password: string}): Promise<InsertOneWriteOpResult | UpdateWriteOpResult>;
    static async save(data: {guild: string, role: string}): Promise<InsertOneWriteOpResult | UpdateWriteOpResult>;
    static async save(data: any) {
        if (!connection()) throw new Error("No database connection");
        if (!data.guild) throw new Error("Guild ID not specified");
        const config = await GuildConfig.fetch(data.guild);
        const col = connection().collection(collection);
        if (config) {
            return await col.updateOne({ guild: data.guild }, { $set: { ...config, ...data } });
        } else {
            return await col.insertOne(data);
        }
    }

    static async fetch(guildId) {
        if (!connection()) throw new Error("No database connection");
        return <GuildConfigModel>{ ...GuildConfig.defaultConfig(guildId), ...await connection().collection(collection).findOne({ guild: guildId }) };
    }

    static async fetchAll(): Promise<GuildConfigModel[]> {
        if (!connection()) throw new Error("No database connection");
        const guildConfigs = await connection().collection(collection).find().toArray();
        return guildConfigs.map(gc => {
            return <GuildConfigModel>{  ...GuildConfig.defaultConfig(), ...gc };
        });
    }
};
