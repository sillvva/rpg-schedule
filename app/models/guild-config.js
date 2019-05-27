"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("../db"));
const connection = db_1.default.connection;
const collection = "guildConfig";
class GuildConfig {
    static defaultConfig(guildId = null) {
        return {
            guild: guildId,
            channel: null,
            pruning: false,
            embeds: true,
            password: "",
            role: null
        };
    }
    static async save(data) {
        if (!connection())
            throw new Error("No database connection");
        if (!data.guild)
            throw new Error("Guild ID not specified");
        const config = await GuildConfig.fetch(data.guild);
        const col = connection().collection(collection);
        if (config) {
            return await col.updateOne({ guild: data.guild }, { $set: { ...config, ...data } });
        }
        else {
            return await col.insertOne(data);
        }
    }
    static async fetch(guildId) {
        if (!connection())
            throw new Error("No database connection");
        return { ...GuildConfig.defaultConfig(guildId), ...await connection().collection(collection).findOne({ guild: guildId }) };
    }
    static async fetchAll() {
        if (!connection())
            throw new Error("No database connection");
        const guildConfigs = await connection().collection(collection).find().toArray();
        return guildConfigs.map(gc => {
            return { ...GuildConfig.defaultConfig(), ...gc };
        });
    }
}
exports.GuildConfig = GuildConfig;
;
