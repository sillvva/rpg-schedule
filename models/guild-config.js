const { connection } = require("../db");
const collection = "guildConfig";

module.exports = class GuildConfig {
    static defaultConfig(guildId) {
        return {
            guild: guildId,
            pruning: false,
            embeds: true,
            password: ""
        };
    }

    static async save(data) {
        if (!connection()) throw new Error("No database connection");
        const config = await GuildConfig.fetch(data.guild, false);
        const col = connection().collection(collection);
        if (config) {
            return await col.updateOne({ guild: data.guild }, { $set: { ...config, ...data } });
        } else {
            return await col.insertOne(data);
        }
    }

    static async fetch(guildId, defaults = true) {
        if (!connection()) throw new Error("No database connection");
        return (
            (await connection()
                .collection(collection)
                .findOne({ guild: guildId })) || (defaults ? GuildConfig.defaultConfig(guildId) : null)
        );
    }

    static async fetchAll() {
        if (!connection()) throw new Error("No database connection");
        return await connection()
            .collection(collection)
            .find()
            .toArray();
    }
};
