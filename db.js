const mongodb = require('mongodb');
const discord = require('discord.js');

let _db;

class database {
    constructor() {
        this.client = mongodb.MongoClient;
        this.connected = false;
        this.collections = {
            config: 'guildConfig',
            games: 'games'
        };
    }

    async connect() {
        let result = false;
        try {
            result = await this.client.connect(
                process.env.MONGODB_URL,
                { useNewUrlParser: true }
            )
        } catch (err) {
            console.log(err);
        }

        this.connected = true;
        _db = result.db();

        return true;
    }

    connection() {
        if (_db) {
            return _db;
        }
    }

    async getGuildConfig(guildId) {
        return await this.connection().collection(this.collections.config).findOne({ guild: guildId });
    }

    async setGuildConfig(config) {
        let guildConfig = await this.getGuildConfig(config.guild);
        const collection = this.connection().collection(this.collections.config);
        if (guildConfig) {
            return await collection.updateOne({ guild: config.guild }, { $set: { channel: config.channel } });
        } else {
            return await collection.insertOne(config);
        }
    }

    async getGameBy(key, value) {
        const query = {};
        query[key] = value;
        return await this.connection().collection(this.collections.games).findOne(query);
    }

    async getGame(gameId) {
        return await this.getGameBy('id', gameId);
    }

    async setGame(channel, game) {
        const guild = channel.guild;

        let dm;
        let dmmember = guild.members.array().find(mem => mem.user.tag === game.dm.trim());
        if (dmmember) dm = dmmember.user.toString();
        else throw new Error('DM must be a Discord tag');

        let reserved = [];
        let waitlist = [];
        game.reserved.split(/\r?\n/).forEach(res => {
            if (res.trim().length === 0) return;
            let member = guild.members.array().find(mem => mem.user.tag === res.trim());
            
            let name = res.trim();
            if (member) name = member.user.toString();
            
            if (reserved.length < parseInt(game.players)) {
                reserved.push((reserved.length+1)+'. '+name);
            } else {
                waitlist.push((reserved.length+waitlist.length+1)+'. '+name);
            }
        });

        const timeZone = 'GMT'+(game.timezone >=0 ? '+' : '')+game.timezone;
        const d = new Date(game.date+' '+game.time+' '+timeZone);
        d.setHours(d.getHours()+parseInt(game.timezone));
        const gameDate = d.toDateString();
        const gameTime = (d.getHours() > 12 ? d.getHours()-12 : d.getHours())+':'+d.getMinutes().toString().padStart(2, '0')+' '+(d.getHours() < 12 ? 'AM' : 'PM');

        (game.where.match(/#[^ ]+/g) || []).forEach(m => {
            const chan = guild.channels.array().find(c => c.name === m.substr(1));
            if (chan) {
                game.where.replace(new RegExp(m, 'g'), chan.toString())
            }
        });

        (game.description.match(/#[^ ]+/g) || []).forEach(m => {
            const chan = guild.channels.array().find(c => c.name === m.substr(1));
            if (chan) {
                game.description.replace(new RegExp(m, 'g'), chan.toString())
            }
        });
        
        let signups = '';
        if (game.method === 'automated') {
            if (reserved.length > 0) signups += `\n**Sign Ups:**\n${reserved.join("\n")}\n`;
            if (waitlist.length > 0) signups += `\n**Waitlist:**\n${waitlist.join("\n")}\n`;
            signups += `\n(➕ Add Me | ➖ Remove Me)`;
        } else if (game.method === 'custom') {
            signups += `\n${game.customSignup}`;
        }
        
        let when = '';
        if (game.when === 'datetime') {
            when = `${gameDate} - ${gameTime} (${timeZone})`;
        } else if (game.when === 'now') {
            when = 'Now';
        }
        
        let embed = new discord.RichEmbed()
            .setTitle('Game Announcement')
            .setColor(0x2196F3)
            .setDescription(`
                **DM:** ${dm}
                **Adventure:** ${game.adventure}
                **Runtime:** ${game.runtime} hours
                ${game.description.length > 0 ? "**Description:**\n"+game.description+"\n" : game.description}
                **When:** ${when}
                **Where:** ${game.where}
                ${signups}
            `);

        if (dmmember) embed.setThumbnail(dmmember.user.avatarURL);

        const collection = this.connection().collection(this.collections.games);
        if (!collection) throw new Error('Collection not found');
        const found = await this.getGame(game.id);
        if (found) {
            const updated = await collection.updateOne({ id: game.id }, { $set: game });
            let message = await channel.fetchMessage(found.messageId);
            return { message: await message.edit(embed) };
        } else {
            const inserted = await collection.insertOne(game);
            const message = await channel.send(embed);
            if (game.method === 'automated') await message.react('➕');
            if (game.method === 'automated') await message.react('➖');
            const updated = await collection.updateOne({ id: game.id }, { $set: { messageId: message.id } });
            return { message: message, dm: dmmember };
        }
    }

    async deleteGame(gameId) {
        const collection = this.connection().collection(this.collections.games);
        if (!collection) throw new Error('Collection not found');
        return await collection.deleteOne({ id: gameId });
    }
}

module.exports = new database();