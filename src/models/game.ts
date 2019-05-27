import mongodb from "mongodb";
import discord from "discord.js";
import moment from "moment";
import fromEntries from "object.fromEntries";

import db from "../db";
import socket from "../processes/socket";
import { GuildConfig } from "./guild-config";
import config from "./config";

const connection = db.connection;
const ObjectId = mongodb.ObjectId;
const collection = "games";
const host = process.env.HOST;

export interface GameModel {
    _id: string | number | mongodb.ObjectID;
    s: string,
    c: string,
    adventure: string,
    runtime: string,
    players: string,
    dm: string,
    where: string,
    description: string,
    reserved: string,
    method: string,
    customSignup: string,
    when: string,
    date: string,
    time: string,
    timezone: number,
    timestamp: number,
    reminder: string,
    messageId: string,
    reminderMessageId: string,
    pm: string
}

export class Game {
    static async save(channel: discord.TextChannel, game: GameModel) {
        if (!connection()) throw new Error("No database connection");
        const guild = channel.guild;
        const guildConfig = await GuildConfig.fetch(guild.id);

        let dm: string = game.dm
            .trim()
            .replace("@", "")
            .replace(/\#\d{4}/, "");
        let dmmember = guild.members.array().find(mem => {
            return mem.user.tag === game.dm.trim().replace("@", "");
        });
        if (!dmmember) throw new Error("DM must be a Discord tag");
        else if (guildConfig.embeds === false) dm = dmmember.user.toString();

        let reserved: string[] = [];
        let waitlist: string[] = [];
        game.reserved
            .replace(/@/g, "")
            .split(/\r?\n/)
            .forEach((res: string) => {
                if (res.trim().length === 0) return;
                let member = guild.members.array().find(mem => mem.user.tag === res.trim());

                let name: string = res.trim().replace(/\#\d{4}/, "");
                if (member && guildConfig.embeds === false) name = member.user.toString();

                if (reserved.length < parseInt(game.players)) {
                    reserved.push(reserved.length + 1 + ". " + name);
                } else {
                    waitlist.push(reserved.length + waitlist.length + 1 + ". " + name);
                }
            });

        const rawDate = `${game.date} ${game.time} GMT${game.timezone < 0 ? "-" : "+"}${Math.abs(game.timezone)}`;
        const timezone = "GMT" + (game.timezone >= 0 ? "+" : "") + game.timezone;
        const where = parseChannels(game.where, guild.channels);
        const description = parseChannels(game.description, guild.channels);

        let signups = "";
        if (game.method === "automated") {
            if (reserved.length > 0) signups += `\n**Sign Ups:**\n${reserved.join("\n")}\n`;
            if (waitlist.length > 0) signups += `\n**Waitlist:**\n${waitlist.join("\n")}\n`;
            signups += `\n(➕ Add Me | ➖ Remove Me)`;
        } else if (game.method === "custom") {
            signups += `\n${game.customSignup}`;
        }

        let when = "";
        if (game.when === "datetime") {
            const date = Game.ISOGameDate(game);
            when = moment(date)
                    .utcOffset(game.timezone)
                    .format(config.formats.dateLong) + ` (${timezone})`;
            game.timestamp = new Date(rawDate).getTime();
        } else if (game.when === "now") {
            when = "Now";
            game.timestamp = new Date().getTime();
        }

        const msg =
            `\n**DM:** ${dm}` +
            `\n**Adventure:** ${game.adventure}` +
            `\n**Runtime:** ${game.runtime} hours` +
            `\n${description.length > 0 ? "**Description:**\n" + description + "\n" : description}` +
            `\n**When:** ${when}` +
            `\n**Where:** ${where}` +
            `\n${signups}`;

        let embed = new discord.RichEmbed()
            .setTitle("Game Announcement")
            .setColor(0x2196f3)
            .setDescription(msg);

        embed.setThumbnail(dmmember.user.avatarURL);

        const dbCollection = connection().collection(collection);
        if (game._id) {
            const prev = await Game.fetch(game._id);
            const updated = await dbCollection.updateOne({ _id: new ObjectId(game._id) }, { $set: game });
            let message: discord.Message;
            try {
                message = await channel.fetchMessage(game.messageId);
                if (guildConfig.embeds === false) {
                    message = await message.edit(msg, { embed: {} });
                } else {
                    message = await message.edit(embed);
                }

                const updatedGame = fromEntries(Object.entries(prev).filter(([key, val]) => game[key] !== val));
                socket.io().emit("game", { action: "updated", gameId: game._id, game: updatedGame });
            } catch (err) {
                Game.delete(game);
                updated.modifiedCount = 0;
            }
            return {
                message: message,
                _id: game._id,
                modified: updated.modifiedCount > 0
            };
        } else {
            const inserted = await dbCollection.insertOne(game);
            let message: any;
            if (guildConfig.embeds === false) {
                message = await channel.send(msg);
            } else {
                message = await channel.send(embed);
            }
            if (game.method === "automated") await message.react("➕");
            if (game.method === "automated") await message.react("➖");
            const pm: any = await dmmember.send(
                "You can edit your `" + guild.name + "` - `" + game.adventure + "` game here:\n" + host + config.urls.game.create.url + "?g=" + inserted.insertedId
            );
            const updated = await dbCollection.updateOne({ _id: new ObjectId(inserted.insertedId) }, { $set: { messageId: message.id, pm: pm.id } });
            return {
                message: message,
                _id: inserted.insertedId,
                modified: updated.modifiedCount > 0
            };
        }
    }

    static async fetch(gameId: string | number | mongodb.ObjectID): Promise<GameModel> {
        if (!connection()) throw new Error("No database connection");
        return await connection()
            .collection(collection)
            .findOne({ _id: new ObjectId(gameId) });
    }

    static async fetchBy(key: string, value: any): Promise<GameModel> {
        if (!connection()) throw new Error("No database connection");
        const query = fromEntries([[key, value]]);
        return await connection()
            .collection(collection)
            .findOne(query);
    }

    static async fetchAllBy(query: any): Promise<GameModel[]> {
        if (!connection()) throw new Error("No database connection");
        return await connection()
            .collection(collection)
            .find(query)
            .toArray();
    }

    static async deleteAllBy(query: any) {
        if (!connection()) throw new Error("No database connection");
        return await connection()
            .collection(collection)
            .deleteMany(query);
    }

    static async delete(game: GameModel, channel: discord.TextChannel = null, options: any = {}) {
        if (!connection()) throw new Error("No database connection");
        
        const { sendWS = true } = options;

        if (channel) {
            try {
                if (game.messageId) {
                    const message = await channel.fetchMessage(game.messageId);
                    if (message) {
                        message.delete().catch(console.log);
                    }
                }
            } catch (e) {
                console.log("Announcement: ", e.message);
            }

            try {
                if (game.reminderMessageId) {
                    const message = await channel.fetchMessage(game.reminderMessageId);
                    if (message) {
                        message.delete().catch(console.log);
                    }
                }
            } catch (e) {
                console.log("Reminder: ", e.message);
            }

            try {
                if (game.pm) {
                    const dm = channel.guild.members.array().find(m => m.user.tag === game.dm);
                    if (dm) {
                        const pm = dm.user.dmChannel.messages.get(game.pm);
                        if (pm) {
                            pm.delete().catch(console.log);
                        }
                    }
                }
            } catch (e) {
                console.log("DM: ", e.message);
            }
        }
        if (sendWS) socket.io().emit("game", { action: "deleted", gameId: game._id });
        return await connection()
            .collection(collection)
            .deleteOne({ _id: new ObjectId(game._id) });
    }

    static ISOGameDate(game: GameModel) {
        return `${game.date.replace(/-/g, "")}T${game.time.replace(/:/g, "")}00${game.timezone >= 0 ? "+" : "-"}${parseTimeZoneISO(game.timezone)}`;
    }
};

const parseChannels = (text: string, channels: discord.Collection<string, discord.GuildChannel>) => {
    try {
        (text.match(/#[a-z0-9\-_]+/g) || []).forEach(m => {
            const chan = channels.array().find(c => c.name === m.substr(1));
            if (chan) {
                text = text.replace(new RegExp(m, "g"), chan.toString());
            }
        });
    } catch (err) {
        console.log(err);
    }
    return text;
};

const parseTimeZoneISO = timezone => {
    const tz = Math.abs(timezone);
    const hours = Math.floor(tz);
    const minutes = ((tz - hours) / 100) * 60;
    const zeroPad = (n: any, width: number, z = "0"): string => {
        n = n + "";
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    };
    return zeroPad(hours, 2) + zeroPad(minutes, 2);
};
