const mongodb = require('mongodb');
const discord = require('discord.js');

const { connection } = require('../db');
const ws = require('../processes/socket');

const ObjectId = mongodb.ObjectId;
const collection = 'games';
const host = process.env.HOST;
const gameUrl = '/game';

module.exports = class Game {
    static async save(channel, game) {
        if (!connection()) throw new Error('No database connection');
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
            game.timestamp = new Date(`${game.date} ${game.time} ${timeZone}`).getTime()
        } else if (game.when === 'now') {
            when = 'Now';
            game.timestamp = new Date.getTime();
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

        embed.setThumbnail(dmmember.user.avatarURL);

        const dbCollection = connection().collection(collection);
        if (game._id) {
            const updated = await dbCollection.updateOne({ _id: new ObjectId(game._id) }, { $set: game });
            let message;
            try {
                message = await channel.fetchMessage(game.messageId);
                message = await message.edit(embed);
                ws.getIo().emit('game', { action: 'updated', game: game });
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
            const message = await channel.send(embed);
            if (game.method === 'automated') await message.react('➕');
            if (game.method === 'automated') await message.react('➖');
            const pm = await dmmember.send("You can edit your `"+guild.name+"` `"+game.adventure+"` game here:\n"+host+gameUrl+'?s='+guild.id+'&g='+inserted.insertedId);
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
    
    static async delete(game, channel) {
        if (!connection()) throw new Error('No database connection');
        if (game.pm) {
            const dm = channel.guild.members.array().find(m => m.user.tag === game.dm);
            if (dm) {
                const pm = dm.user.dmChannel.messages.get(game.pm);
                if (pm) {
                    pm.delete();
                }
            }
        }
        ws.getIo().emit('game', { action: 'deleted', gameId: game._id });
        return await connection()
            .collection(collection)
            .deleteOne({ _id: new ObjectId(game._id) });
    }
}