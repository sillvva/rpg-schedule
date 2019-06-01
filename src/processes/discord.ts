import discord, { TextChannel, Client, Message } from "discord.js";
import { DeleteWriteOpResultObject } from "mongodb";

import { GuildConfig } from "../models/guild-config";
import { Game } from "../models/game";
import config from "../models/config";

let client: Client;

const discordProcesses = (readyCallback: () => {}) => {
    client = new discord.Client();

    /**
     * Discord.JS - ready
     */
    client.on("ready", () => {
        console.log(`Logged in as ${client.user.username}!`);
        readyCallback();
    });

    /**
     * Discord.JS - message
     */
    client.on("message", async message => {
        try {
            if (message.content.startsWith(process.env.BOTCOMMAND_SCHEDULE) && message.channel instanceof TextChannel) {
                const parts = message.content
                    .trim()
                    .split(" ")
                    .filter(part => part.length > 0)
                    .slice(1);
                const cmd = parts.reverse().pop();
                parts.reverse();
    
                if (!message.channel.guild) {
                    message.reply("This command will only work in a server");
                    return;
                }
    
                const guild = message.channel.guild;
                const guildId = guild.id;
                const guildConfig = await GuildConfig.fetch(guildId);
    
                const member = message.channel.guild.members.array().find(m => m.user.id === message.author.id);
                const canConfigure = member ? member.hasPermission(discord.Permissions.FLAGS.MANAGE_GUILD) : false;
    
                if (cmd === "help" || message.content.trim().split(" ").length === 1) {
                    let embed = new discord.RichEmbed()
                        .setTitle("RPG Schedule Help")
                        .setColor(0x2196f3)
                        .setDescription(
                            `__**Command List**__\n` +
                                `\`${process.env.BOTCOMMAND_SCHEDULE}\` - Display this help window\n` +
                                `\`${process.env.BOTCOMMAND_SCHEDULE} help\` - Display this help window\n` +
                                (canConfigure ? `\nConfiguration\n` +
                                    (canConfigure ? `\`${process.env.BOTCOMMAND_SCHEDULE} configuration\` - Get the bot configuration\n` : ``) +
                                    (canConfigure ? `\`${process.env.BOTCOMMAND_SCHEDULE} add-channel #channel-name\` - Add a channel where games are posted\n` : ``) +
                                    (canConfigure ? `\`${process.env.BOTCOMMAND_SCHEDULE} remove-channel #channel-name\` - Remove a channel where games are posted\n` : ``) +
                                    (canConfigure ? `\`${process.env.BOTCOMMAND_SCHEDULE} pruning ${guildConfig.pruning ? 'on' : 'off'}\` - \`on/off\` - Automatically delete old announcements\n` : ``) +
                                    (canConfigure ? `\`${process.env.BOTCOMMAND_SCHEDULE} embeds ${guildConfig.embeds || guildConfig.embeds == null ? 'on' : 'off'}\` - \`on/off\` - Use discord embeds for announcements\n` : ``) +
                                    (canConfigure ? `\`${process.env.BOTCOMMAND_SCHEDULE} role role name\` - Assign a role as a prerequisite for posting games\n` : ``) +
                                    (canConfigure ? `\`${process.env.BOTCOMMAND_SCHEDULE} password password\` - Configure a password for posting games\n` : ``) +
                                    (canConfigure ? `\`${process.env.BOTCOMMAND_SCHEDULE} password\` - Remove the password\n` : ``) : ``) +
                                `\nUsage\n` +
                                `\`${process.env.BOTCOMMAND_SCHEDULE} link\` - Retrieve link for posting games`
                        );
                    message.channel.send(embed);
                } else if (cmd === "link") {
                    message.channel.send(process.env.HOST + config.urls.game.create.url + "?s=" + guildId);
                } else if (cmd === "configuration") {
                    if (canConfigure) {
                        const channel = guildConfig.channels.map(c => {
                            return guild.channels.get(c);
                        }) || ([ guild.channels.array().find(c => c instanceof TextChannel) ]);
    
                        let embed = new discord.RichEmbed()
                            .setTitle("RPG Schedule Configuration")
                            .setColor(0x2196f3)
                            .setDescription(
                                `Guild: \`${guild.name}\`\n` +
                                `Channels: \`${channel.filter(c => c).map(c => c.name).join(' | ')}\`\n` +
                                `Pruning: \`${guildConfig.pruning ? "on" : "off"}\`\n` +
                                `Embeds: \`${!(guildConfig.embeds === false) ? "on" : "off"}\`\n` +
                                `Password: ${guildConfig.password ? `\`${guildConfig.password}\`` : "Disabled"}\n` +
                                `Role: ${guildConfig.role ? `\`${guildConfig.role}\`` : "All Roles"}`
                            );
                        message.author.send(embed);
                    }
                } else if (cmd === "add-channel") {
                    if (canConfigure) {
                        const channel: string = parts[0].replace(/\<\#|\>/g, "");
                        const channels = guildConfig.channels;
                        channels.push(channel);
                        guildConfig.save({
                            channel: channels
                        }).then(result => {
                            message.channel.send("Channel added! Make sure the bot has permissions in the designated channel.");
                        }).catch(err => {
                            console.log(err);
                        });
                    }
                } else if (cmd === "remove-channel") {
                    if (canConfigure) {
                        const channel: string = parts[0].replace(/\<\#|\>/g, "");
                        const channels = guildConfig.channels;
                        if (channels.indexOf(channel) >= 0) {
                            channels.splice(channels.indexOf(channel), 1);
                        }
                        guildConfig.save({
                            channel: channels
                        }).then(result => {
                            message.channel.send("Channel removed!");
                        }).catch(err => {
                            console.log(err);
                        });
                    }
                } else if (cmd === "pruning") {
                    if (canConfigure) {
                        guildConfig.save({
                            pruning: parts[0] === "on"
                        }).then(result => {
                            message.channel.send("Configuration updated! Pruning was turned " + (parts[0] === "on" ? "on" : "off"));
                        }).catch(err => {
                            console.log(err);
                        });
                    }
                } else if (cmd === "embeds") {
                    if (canConfigure) {
                        guildConfig.save({
                            embeds: !(parts[0] === "off")
                        }).then(result => {
                            message.channel.send("Configuration updated! Embeds were turned " + (!(parts[0] === "off") ? "on" : "off"));
                        }).catch(err => {
                            console.log(err);
                        });
                    }
                } else if (cmd === "password") {
                    if (canConfigure) {
                        guildConfig.save({
                            password: parts.join(" ")
                        }).then(result => {
                            message.channel.send("Password updated!");
                        }).catch(err => {
                            console.log(err);
                        });
                    }
                } else if (cmd === "role") {
                    if (canConfigure) {
                        guildConfig.save({
                            role: parts.join(" ")
                        }).then(result => {
                            message.channel.send(`Role set to \`${parts.join(" ")}\`!`);
                        }).catch(err => {
                            console.log(err);
                        });
                    }
                }
    
                // message.delete();
            }
        }
        catch(err) {
            console.log(err);
        }
    });

    /**
     * Discord.JS - messageReactionAdd
     */
    client.on("messageReactionAdd", async (reaction, user) => {
        const message = reaction.message;
        const game = await Game.fetchBy("messageId", message.id);
        if (game && user.id !== message.author.id) {
            if (reaction.emoji.name === "➕") {
                if (game.reserved.indexOf(user.tag) < 0) {
                    game.reserved = [...game.reserved.trim().split(/\r?\n/), user.tag].join("\n");
                    if (game.reserved.startsWith("\n")) game.reserved = game.reserved.substr(1);
                    game.save();
                }
            } else if (reaction.emoji.name === "➖") {
                if (game.reserved.indexOf(user.tag) >= 0) {
                    game.reserved = game.reserved
                        .split(/\r?\n/)
                        .filter(tag => tag !== user.tag)
                        .join("\n");
                    game.save();
                }
            }

            reaction.remove(user);
        }
    });

    /**
     * Discord.JS - messageDelete
     * Delete the game from the database when the announcement message is deleted
     */
    client.on("messageDelete", async message => {
        const game = await Game.fetchBy("messageId", message.id);
        if (game && message.channel instanceof TextChannel) {
            game.delete().then(result => {
                console.log("Game deleted");
            });
        }
    });

    /**
     * Add events to non-cached messages
     */
    const events = {
        MESSAGE_REACTION_ADD: "messageReactionAdd",
        MESSAGE_REACTION_REMOVE: "messageReactionRemove"
    };

    client.on("raw", async (event: any) => {
        if (!events.hasOwnProperty(event.t)) return;

        const { d: data } = event;
        const user = client.users.get(data.user_id);
        const channel = <TextChannel>client.channels.get(data.channel_id) || (await user.createDM());

        if (channel.messages.has(data.message_id)) return;

        const message = await channel.fetchMessage(data.message_id);
        const emojiKey = data.emoji.id ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
        let reaction = message.reactions.get(emojiKey);

        if (!reaction) {
            const emoji = new discord.Emoji(client.guilds.get(data.guild_id), data.emoji);
            reaction = new discord.MessageReaction(message, emoji, 1, data.user_id === client.user.id);
        }

        client.emit(events[event.t], reaction, user);
    });

    return client;
};

const discordLogin = (client) => {
    client.login(process.env.TOKEN);
};

const refreshMessages = async () => {
    let games = await Game.fetchAllBy({ when: "datetime", method: "automated", timestamp: { $gte: new Date().getTime() } });
    games.forEach(async game => {
        if (!game.discordGuild) return;
        
        try {
            const message = await game.discordChannel.fetchMessage(game.messageId);
            // await message.clearReactions();
            // await message.react("➕");
            // await message.react("➖");
        } catch (err) {}
    });
};

const pruneOldGames = async () => {
    let result: DeleteWriteOpResultObject;
    console.log("Pruning old games");
    const query = {
        /*s: {
            $nin: [] // not in these specific servers
        },*/
        timestamp: {
            $lt: new Date().getTime() - 48 * 3600 * 1000 // timestamp lower than 48 hours ago
        }
    };

    const games = await Game.fetchAllBy(query);
    const guildConfigs = await GuildConfig.fetchAll();
    games.forEach(async game => {
        if (!game.discordGuild) return;

        try {
            const guildConfig = guildConfigs.find(gc => gc.guild === game.s);
            if ((guildConfig ? guildConfig.pruning : new GuildConfig().pruning) && game.discordChannel) {
                const message = await game.discordChannel.fetchMessage(game.messageId);
                if (message) message.delete();
                const reminder = await game.discordChannel.fetchMessage(game.reminderMessageId);
                if (reminder) reminder.delete();
            }
        } catch (err) {}
    });

    try {
        result = await Game.deleteAllBy(query);
        console.log(`${result.deletedCount} old games successfully pruned`);
    } catch (err) {
        console.log(err);
    }
    return result;
};

const postReminders = async () => {
    let games = await Game.fetchAllBy({ when: "datetime", reminder: { $in: ["15", "30", "60"] } });
    games.forEach(async game => {
        if (game.timestamp - parseInt(game.reminder) * 60 * 1000 > new Date().getTime()) return;
        if (!game.discordGuild) return;
        
        if (game.discordChannel) {
            const reserved = [];
            game.reserved.split(/\r?\n/).forEach(res => {
                if (res.trim().length === 0) return;
                let member = game.discordGuild.members.array().find(mem => mem.user.tag === res.trim().replace("@", ""));

                let name = res.trim().replace("@", "");
                if (member) name = member.user.toString();

                if (reserved.length < parseInt(game.players)) {
                    reserved.push(name);
                }
            });

            const member = game.discordGuild.members.array().find(mem => mem.user.tag === game.dm.trim().replace("@", ""));
            let dm = game.dm.trim().replace("@", "");
            if (member) dm = member.user.toString();

            if (reserved.length > 0) {
                const channels = game.where.match(/#[a-z0-9\-_]+/gi);
                if (channels) {
                    channels.forEach(chan => {
                        const guildChannel = game.discordGuild.channels.find(c => c.name === chan.replace(/#/, ""));
                        if (guildChannel) {
                            game.where = game.where.replace(chan, guildChannel.toString());
                        }
                    });
                }

                let message = `Reminder for **${game.adventure}**\n`;
                message += `**When:** Starting in ${game.reminder} minutes\n`;
                message += `**Where:** ${game.where}\n\n`;
                message += `**DM:** ${dm}\n`;
                message += `**Players:**\n`;
                message += `${reserved.join(`\n`)}`;

                const sent = <Message>(await game.discordChannel.send(message));

                game.reminder = "0";
                game.reminderMessageId = sent.id;
                game.save();
            }
        }
    });
};

export default {
    processes: discordProcesses,
    login: discordLogin,
    refreshMessages: refreshMessages,
    pruneOldGames: pruneOldGames,
    postReminders: postReminders,
};

export function discordClient() {
    return client;
}