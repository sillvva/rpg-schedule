const mongodb = require('mongodb');
const discord = require('discord.js');
const moment = require('moment');

const { connection } = require('../db');
const ws = require('../processes/socket');
const GuildConfig = require('./guild-config');
const config = require('./config');

const ObjectId = mongodb.ObjectId;
const collection = 'games';
const host = process.env.HOST;

module.exports = class Game {
    static async save(channel, game) {
        if (!connection()) throw new Error('No database connection');
        const guild = channel.guild;
        const guildConfig = await GuildConfig.fetch(guild.id);

        let dm = game.dm.trim().replace('@','').replace(/\#\d{4}/, '');
        let dmmember = guild.members.array().find(mem => {
            return mem.user.tag === game.dm.trim().replace('@','');
        });
        if (!dmmember) throw new Error('DM must be a Discord tag');
        else if (guildConfig.embeds === false) dm = dmmember.user.toString();

        let reserved = [];
        let waitlist = [];
        game.reserved.split(/\r?\n/).forEach(res => {
            if (res.trim().length === 0) return;
            let member = guild.members.array().find(mem => mem.user.tag === res.trim().replace('@',''));

            let name = res.trim().replace('@','').replace(/\#\d{4}/, '');
            if (member && guildConfig.embeds === false) name = member.user.toString();

            if (reserved.length < parseInt(game.players)) {
                reserved.push((reserved.length+1)+'. '+name);
            }
            else {
                waitlist.push((reserved.length+waitlist.length+1)+'. '+name);
            }
        });

        const timezone = 'GMT'+(game.timezone >=0 ? '+' : '')+game.timezone;
        const where = parseChannels(game.where, guild.channels);
        const description = parseChannels(game.description, guild.channels);

        let signups = '';
        if (game.method === 'automated') {
            if (reserved.length > 0) signups += `\n**Sign Ups:**\n${reserved.join("\n")}\n`;
            if (waitlist.length > 0) signups += `\n**Waitlist:**\n${waitlist.join("\n")}\n`;
            signups += `\n(➕ Add Me | ➖ Remove Me)`;
        }
        else if (game.method === 'custom') {
            signups += `\n${game.customSignup}`;
        }

        let when = '';
        if (game.when === 'datetime') {
            const date = `${game.date} ${game.time} GMT${game.timezone >= 0 ? '+' : '-'}${Math.abs(game.timezone)}`;
            when = moment(date).utcOffset(parseInt(game.timezone)).format(config.formats.dateLong)+` (${timezone})`;
            game.timestamp = new Date(date).getTime()
        }
        else if (game.when === 'now') {
            when = 'Now';
            game.timestamp = new Date.getTime();
        }

        const msg = `\n**DM:** ${dm}` +
            `\n**Adventure:** ${game.adventure}` +
            `\n**Runtime:** ${game.runtime} hours` +
            `\n${description.length > 0 ? "**Description:**\n"+description+"\n" : description}` +
            `\n**When:** ${when}` +
            `\n**Where:** ${where}` +
            `\n${signups}`;

        let embed = new discord.RichEmbed()
            .setTitle('Game Announcement')
            .setColor(0x2196F3)
            .setDescription(msg);

        embed.setThumbnail(dmmember.user.avatarURL);

        const dbCollection = connection().collection(collection);
        if (game._id) {
            const updated = await dbCollection.updateOne({ _id: new ObjectId(game._id) }, { $set: game });
            let message;
            try {
                message = await channel.fetchMessage(game.messageId);
                if (guildConfig.embeds === false) {
                    message = await message.edit(msg, { embed: {} });
                } else {
                    message = await message.edit(embed);
                }
                ws.getIo().emit('game', { action: 'updated', gameId: game._id, game: game });
            }
            catch(err) {
                Game.delete(game._id);
                updated.modifiedCount = 0;
            }
            return {
                message: message,
                _id: game._id,
                modified: updated.modifiedCount > 0
            };
        } else {
            const inserted = await dbCollection.insertOne(game);
            let message;
            if (guildConfig.embeds === false) {
                message = await channel.send(msg);
            } else {
                message = await channel.send(embed);
            }
            if (game.method === 'automated') await message.react('➕');
            if (game.method === 'automated') await message.react('➖');
            const pm = await dmmember.send("You can edit your `"+guild.name+"` - `"+game.adventure+"` game here:\n"+host+config.urls.game.create+'?g='+inserted.insertedId);
            const updated = await dbCollection.updateOne({ _id: new ObjectId(inserted.insertedId) }, { $set: { messageId: message.id, pm: pm.id } });
            return {
                message: message,
                _id: inserted.insertedId,
                modified: updated.modifiedCount > 0
            };
        }
    }

    static async fetch(gameId) {
        if (!connection()) throw new Error('No database connection');
        return await connection()
            .collection(collection)
            .findOne({ _id: new ObjectId(gameId) });
    }

    static async fetchBy(key, value) {
        if (!connection()) throw new Error('No database connection');
        const query = {};
        query[key] = value;
        return await connection()
            .collection(collection)
            .findOne(query);
    }

    static async fetchAllBy(query) {
        if (!connection()) throw new Error('No database connection');
        return await connection()
            .collection(collection)
            .find(query)
            .toArray();
    }

    static async deleteAllBy(query) {
        if (!connection()) throw new Error('No database connection');
        return await connection()
            .collection(collection)
            .deleteMany(query);
    }

    static async delete(game, channel, options = {}) {
        if (!connection()) throw new Error('No database connection');

        const {
            sendWS = true
        } = options;

        try {
            if (channel) {
                if (game.messageId) {
                    const message = await channel.fetchMessage(game.messageId);
                    if (message) {
                        message.delete().catch(console.log);
                    }
                }

                if (game.reminderMessageId) {
                    const message = await channel.fetchMessage(game.reminderMessageId);
                    if (message) {
                        message.delete().catch(console.log);
                    }
                }

                if (game.pm) {
                    const dm = channel.guild.members.array().find(m => m.user.tag === game.dm);
                    if (dm) {
                        const pm = dm.user.dmChannel.messages.get(game.pm);
                        if (pm) {
                            pm.delete();
                        }
                    }
                }
            }
        } catch(e) {

        }
        if(sendWS) ws.getIo().emit('game', { action: 'deleted', gameId: game._id });
        return await connection()
            .collection(collection)
            .deleteOne({ _id: new ObjectId(game._id) });
    }

    static ISOGameDate(game) {
        return `${game.date.replace(/-/g, '')}T${game.time.replace(/:/g, '')}:00${game.timezone >= 0 ? '+' : '-'}${parseTimeZoneISO(game.timezone)}`;
    }
};

const parseChannels = (text, channels) => {
    try {
        (text.match(/#[a-z0-9\-_]+/g) || []).forEach(m => {
            const chan = channels.array().find(c => c.name === m.substr(1));
            if (chan) {
                text = text.replace(new RegExp(m, 'g'), chan.toString())
            }
        });
    }
    catch(err) {
        console.log(err);
    }
    return text;
};

const parseTimeZoneISO = (timezone) => {
    const tz = Math.abs(timezone);
    const hours = Math.floor(tz);
    const minutes = (tz - hours) / 100 * 60;
    const zeroPad = (n, width, z) => {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    };
    return zeroPad(hours, 2)+zeroPad(minutes, 2);
};