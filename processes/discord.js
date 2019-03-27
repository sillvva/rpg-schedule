const discord = require('discord.js');

const GuildConfig = require('../models/guild-config');
const Game = require('../models/game');

const host = process.env.HOST;
const gameUrl = '/game';

const discordProcesses = (readyCallback) => {
    const client = new discord.Client();

    /**
     * Discord.JS - ready
     */
    client.on('ready', () => {
        console.log(`Logged in as ${client.user.username}!`);
    
        readyCallback();
        
        if (process.env.HOST.indexOf('aws') >= 0) console.log('Demo Game: '+process.env.HOST+Game.url+'?s=531279336632877106');
    });
    
    /**
     * Discord.JS - message
     */
    client.on('message', (message) => {
        if (message.content.startsWith(process.env.BOTCOMMAND_SCHEDULE)) {
            const parts = message.content.split(' ').slice(1);
            const cmd = parts.reverse().pop();

            if (cmd === 'help' || message.content.split(' ').length === 1) {
                let embed = new discord.RichEmbed()
                    .setTitle('RPG Schedule Help')
                    .setColor(0x2196F3)
                    .setDescription(`
                        __**Command List**__
                        \`${process.env.BOTCOMMAND_SCHEDULE}\` - Display this help window
                        \`${process.env.BOTCOMMAND_SCHEDULE} help\` - Display this help window
                        
                        Configuration
                        \`${process.env.BOTCOMMAND_SCHEDULE} channel #channel-name\` - Configure the channel where games are posted
                        
                        Usage
                        \`${process.env.BOTCOMMAND_SCHEDULE} link\` - Retrieve link for posting games
                    `);
                message.channel.send(embed);
            } else if (cmd === 'link') {
                if (!message.channel.guild) {
                    message.reply('This command will only work in a server');
                    return;
                }
                const guildId = message.channel.guild.id;
                message.channel.send(host+gameUrl+'?s='+guildId);
            } else if (cmd === 'channel') {
                if (!message.channel.guild) {
                    message.reply('This command will only work in a server');
                    return;
                }
                const member = message.channel.guild.members.array().find(m => m.user.id === message.author.id);
                if (member) {
                    if (member.hasPermission(discord.Permissions.FLAGS.MANAGE_CHANNELS)) {
                        GuildConfig.save({
                            guild: message.channel.guild.id,
                            channel: parts[0].replace(/\<\#|\>/g,'')
                        }).then(result => {
                            message.channel.send('Channel updated! Make sure the bot has permissions in the designated channel.');
                        });
                    }
                }
            }
    
            message.delete();
        }
    });
    
    /**
     * Discord.JS - messageReactionAdd
     */
    client.on('messageReactionAdd', async (reaction, user) => {
        const message = reaction.message;
        const game = await Game.fetchBy('messageId', message.id);
        if (game && user.id !== message.author.id) {
            const channel = message.channel;
            if (reaction.emoji.name === '➕') {
                if (game.reserved.indexOf(user.tag) < 0) {
                    game.reserved = [ ...game.reserved.trim().split(/\r?\n/), user.tag ].join("\n");
                    if (game.reserved.startsWith("\n")) game.reserved = game.reserved.substr(1);
                    Game.save(channel, game);
                }
            } else if (reaction.emoji.name === '➖') {
                if (game.reserved.indexOf(user.tag) >= 0) {
                    game.reserved = game.reserved.split(/\r?\n/).filter(tag => tag !== user.tag).join("\n");
                    Game.save(channel, game);
                }
            }
    
            reaction.remove(user);
        }
    });
    
    /**
     * Discord.JS - messageDelete
     * Delete the game from the database when the announcement message is deleted
     */
    client.on('messageDelete', async message => {
        const game = await Game.fetchBy('messageId', message.id);
        if (game) {
            Game.delete(game, message.channel).then((result) => {
                console.log('Game deleted');
            });
        }
    });
    
    /**
     * Add events to non-cached messages
     */
    const events = {
        MESSAGE_REACTION_ADD: 'messageReactionAdd',
        MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
    };
    
    client.on('raw', async event => {
        if (!events.hasOwnProperty(event.t)) return;
    
        const { d: data } = event;
        const user = client.users.get(data.user_id);
        const channel = client.channels.get(data.channel_id) || await user.createDM();
    
        if (channel.messages.has(data.message_id)) return;
    
        const message = await channel.fetchMessage(data.message_id);
        const emojiKey = (data.emoji.id) ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
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

const refreshMessages = async guilds => {
    const guildConfigs = await GuildConfig.fetchAll();
    guilds.array().forEach(async guild => {
        const channel = guild.channels.array().find(c => guildConfigs.find(gc => gc.guild === guild.id && gc.channel === c.id ))
        if (channel) {
            let games = await Game.fetchAllBy({ s: guild.id, c: channel.id, when: 'datetime', method: 'automated', timestamp: {$gte: new Date().getTime()}  });
            games.forEach(async game => {
                try {
                    const message = await channel.fetchMessage(game.messageId);
                    await message.clearReactions();
                    await message.react('➕');
                    await message.react('➖');
                }
                catch(err) {
                    
                }
            })
        }
    })
};

const pruneOldGames = async () => {
    let result;
    try {
        console.log('Pruning old games');
        const query = { s: { $nin: ['532564186023329792', '531279336632877106'] }, timestamp: { $lt: (new Date().getTime()) - 24 * 3600 * 1000 } };
        result = await Game.deleteAllBy(query);
        console.log(`${result.deletedCount} old games successfully pruned`);
    } catch (err) {
        console.log(err);
    }
    return result;
};

const postReminders = async (client) => {
    let games = await Game.fetchAllBy({ when: 'datetime', reminder: { $in: ['15','30','60'] } });
    games.forEach(async game => {
        if (game.timestamp - parseInt(game.reminder) > new Date().getTime()) return;
        const guild = client.guilds.get(game.s);
        if (guild) {
            const channel = guild.channels.get(game.c);
            if (channel) {
                const reserved = [];
                game.reserved.split(/\r?\n/).forEach(res => {
                    if (res.trim().length === 0) return;
                    let member = guild.members.array().find(mem => mem.user.tag === res.trim());

                    let name = res.trim();
                    if (member) name = member.user.toString();

                    if (reserved.length < parseInt(game.players)) {
                        reserved.push(name);
                    }
                });

                if (reserved.length > 0) {
                    const gameTime = (d.getHours() > 12 ? d.getHours()-12 : d.getHours())+':'+d.getMinutes().toString().padStart(2, '0')+' '+(d.getHours() < 12 ? 'AM' : 'PM');

                    let message = `Reminder for the game starting at ${gameTime} (${game.timezone})\n\n`;
                    message += `**DM:** ${game.dm}\n`;
                    message += `**Players:**\n`;
                    message += `${reserved.join(`\n`)}`;

                    await channel.send(message);

                    game.reminder = '0';
                    Game.save(channel, game);
                }
            }
        }
    });
};

module.exports = {
    processes: discordProcesses,
    login: discordLogin,
    refreshMessages: refreshMessages,
    pruneOldGames: pruneOldGames,
    postReminders: postReminders
};