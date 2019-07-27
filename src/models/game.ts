import mongodb, { ObjectID } from "mongodb";
import discord, { Message, Guild, TextChannel, GuildChannel, Collection } from "discord.js";
import moment from "moment";

import db from "../db";
import aux from "../appaux";
import { discordClient } from "../processes/discord";
import { io } from "../processes/socket";
import { GuildConfig } from "./guild-config";
import config from "./config";

const connection = db.connection;
const ObjectId = mongodb.ObjectId;
const collection = "games";
const host = process.env.HOST;

export interface GameModel {
    _id: string | number | ObjectID;
    s: string;
    c: string;
    guild: string;
    channel: string;
    adventure: string;
    runtime: string;
    players: string;
    dm: string;
    where: string;
    description: string;
    reserved: string;
    method: string;
    customSignup: string;
    when: string;
    date: string;
    time: string;
    timezone: number;
    timestamp: number;
    reminder: string;
    messageId: string;
    reminderMessageId: string;
    pm: string;
}

interface GameSaveData {
    _id: string | number | ObjectID;
    message: Message;
    modified: boolean;
}

export class Game implements GameModel {
    _id: string | number | ObjectID;
    s: string;
    c: string;
    guild: string;
    channel: string;
    adventure: string;
    runtime: string;
    players: string;
    dm: string;
    where: string;
    description: string;
    reserved: string;
    method: string;
    customSignup: string;
    when: string;
    date: string;
    time: string;
    timezone: number;
    timestamp: number;
    reminder: string;
    messageId: string;
    reminderMessageId: string;
    pm: string;

    private _guild: Guild;
    get discordGuild() { return this._guild; }
    private _channel: TextChannel;
    get discordChannel() { return this._channel; }

    constructor(game: GameModel) {
        Object.entries(game || {}).forEach(([key, value]) => {
            this[key] = value;
        });
        this._guild = discordClient().guilds.get(this.s);
        if (this._guild) {
            this._guild.channels.forEach(c => {
                if (!this._channel && c instanceof TextChannel) {
                    this._channel = c;
                }
                if (c.id === this.c && c instanceof TextChannel) {
                    this._channel = c;
                }
            });
        }
    }

    get data(): GameModel {
        return {
            _id: this._id,
            s: this.s,
            c: this.c,
            guild: this.guild,
            channel: this.channel,
            adventure: this.adventure,
            runtime: this.runtime,
            players: this.players,
            dm: this.dm,
            where: this.where,
            description: this.description,
            reserved: this.reserved,
            method: this.method,
            customSignup: this.customSignup,
            when: this.when,
            date: this.date,
            time: this.time,
            timezone: this.timezone,
            timestamp: this.timestamp,
            reminder: this.reminder,
            messageId: this.messageId,
            reminderMessageId: this.reminderMessageId,
            pm: this.pm
        };
    }

    async save() {
        if (!connection()) throw new Error("No database connection");
        const channel = this._channel;
        const guild = channel.guild;
        const guildConfig = await GuildConfig.fetch(guild.id);
        const game: GameModel = this.data;

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
            signups += `\n(✅ Add Me | ❎ Remove Me)`;
        } else if (game.method === "custom") {
            signups += `\n${game.customSignup}`;
        }

        let when = "";
        if (game.when === "datetime") {
            const date = Game.ISOGameDate(game);
            const tz = (Math.round(parseFloat(game.timezone.toString()) * 4) / 4)
            when = moment(date)
                    .utcOffset(tz)
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
            .setColor(guildConfig.embedColor)
            .setDescription(msg);

        embed.setThumbnail(dmmember.user.avatarURL);

        const dbCollection = connection().collection(collection);
        if (game._id) {
            const prev = (await Game.fetch(game._id)).data;
            const updated = await dbCollection.updateOne({ _id: new ObjectId(game._id) }, { $set: game });
            let message: Message;
            try {
                message = await channel.fetchMessage(game.messageId);
                if (guildConfig.embeds === false) {
                    message = await message.edit(msg, { embed: {} });
                } else {
                    message = await message.edit(embed);
                }

                prev._id = prev._id.toString();
                game._id = game._id.toString();
                
                const updatedGame = aux.objectChanges(prev, game);
                io().emit("game", { action: "updated", gameId: game._id, game: updatedGame });
            } catch (err) {
                this.delete();
                updated.modifiedCount = 0;
            }
            const saved: GameSaveData = {
                _id: game._id,
                message: message,
                modified: updated.modifiedCount > 0
            };
            return saved;
        } else {
            const inserted = await dbCollection.insertOne(game);
            let message: Message;
            if (guildConfig.embeds === false) {
                message = <Message>(await channel.send(msg));
            } else {
                message = <Message>(await channel.send(embed));
            }
            if (game.method === "automated") await message.react("✅");
            if (game.method === "automated") await message.react("❎");
            const pm: any = await dmmember.send(
                "You can edit your `" + guild.name + "` - `" + game.adventure + "` game here:\n" + host + config.urls.game.create.url + "?g=" + inserted.insertedId
            );
            const updated = await dbCollection.updateOne({ _id: new ObjectId(inserted.insertedId) }, { $set: { messageId: message.id, pm: pm.id } });
            const saved: GameSaveData = {
                _id: inserted.insertedId.toString(),
                message: message,
                modified: updated.modifiedCount > 0
            };
            return saved;
        }
    }

    static async fetch(gameId: string | number | ObjectID): Promise<Game> {
        if (!connection()) throw new Error("No database connection");
        const game = await connection().collection(collection).findOne({ _id: new ObjectId(gameId) });
        return game ? new Game(game) : null;
    }

    static async fetchBy(key: string, value: any): Promise<Game> {
        if (!connection()) throw new Error("No database connection");
        const query: mongodb.FilterQuery<any> = aux.fromEntries([[key, value]]);
        const game: GameModel = await connection().collection(collection).findOne(query);
        return game ? new Game(game) : null;
    }

    static async fetchAllBy(query: mongodb.FilterQuery<any>): Promise<Game[]> {
        if (!connection()) throw new Error("No database connection");
        const games: GameModel[] = await connection().collection(collection).find(query).toArray()
        return games.map(game => {
            return new Game(game);
        });
    }

    static async deleteAllBy(query: mongodb.FilterQuery<any>) {
        if (!connection()) throw new Error("No database connection");
        return await connection().collection(collection).deleteMany(query);
    }

    async delete(options: any = {}) {
        if (!connection()) throw new Error("No database connection");
        
        const { sendWS = true } = options;
        const game: GameModel = this;
        const channel = this._channel;

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
        if (sendWS) io().emit("game", { action: "deleted", gameId: game._id });
        return await connection()
            .collection(collection)
            .deleteOne({ _id: new ObjectId(game._id) });
    }

    static ISOGameDate(game: GameModel) {
        return `${game.date.replace(/-/g, "")}T${game.time.replace(/:/g, "")}00${game.timezone >= 0 ? "+" : "-"}${parseTimeZoneISO(game.timezone)}`;
    }
};

const parseChannels = (text: string, channels: Collection<string, GuildChannel>) => {
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
    const minutes = ((tz - hours)) * 60;
    const zeroPad = (n: any, width: number, z = "0"): string => {
        n = n + "";
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    };
    return zeroPad(hours, 2) + zeroPad(minutes, 2);
};