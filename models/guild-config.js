const { connection } = require('../db');
const collection = 'guildConfig';

module.exports = class GuildConfig {
    static async save(data) {
        if (!connection()) throw new Error('No database connection');
        const config = await GuildConfig.fetch(data.guild);
        console.log(collection);
        const col = connection().collection(collection);
        if (config) {
            return await col.updateOne({ guild: data.guild }, { $set: { ...config, ...data } });
        } else {
            return await col.insertOne(data);
        }
    }
    
    static async fetch(guildId) {
        if (!connection()) throw new Error('No database connection');
        return await connection()
            .collection(collection)
            .findOne({ guild: guildId });
    }
    
    static async fetchAll() {
        if (!connection()) throw new Error('No database connection');
        return await connection()
            .collection(collection)
            .find()
            .toArray();
    }
}