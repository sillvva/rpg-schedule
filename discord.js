const discord = require('discord.js');

const host = process.env.HOST;
const gameUrl = '/game';

const discordProcesses = (app, db, readyCallback) => {
    const client = new discord.Client();

    /**
     * Discord.JS - ready
     */
    client.on('ready', () => {
        console.log(`Logged in as ${client.user.username}!`);
    
        readyCallback();
        
        if (process.env.HOST.indexOf('aws') >= 0) console.log('Demo Game: '+process.env.HOST+'/game?s=532564186023329792');
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
                    if (member.hasPermission(discord.Permissions.MANAGE_CHANNELS)) {
                        db.setGuildConfig({
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
        const game = await db.getGameBy('messageId', message.id);
        if (game && user.id !== message.author.id) {
            const channel = message.channel;
            console.log(reaction.emoji.name);
            if (reaction.emoji.name === '➕') {
                if (game.reserved.indexOf(user.tag) < 0) {
                    game.reserved = [ ...game.reserved.trim().split(/\r?\n/), user.tag ].join("\n");
                    if (game.reserved.startsWith("\n")) game.reserved = game.reserved.substr(1);
                    console.log(game.reserved);
                    db.setGame(channel, game);
                }
            } else if (reaction.emoji.name === '➖') {
                if (game.reserved.indexOf(user.tag) >= 0) {
                    game.reserved = game.reserved.split(/\r?\n/).filter(tag => tag !== user.tag).join("\n");
                    console.log(game.reserved);
                    db.setGame(channel, game);
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
        const game = await db.getGameBy('messageId', message.id);
        if (game) {
            db.deleteGame(game.id).then((result) => {
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
    
    client.login(process.env.TOKEN);
    
    return client;
}

module.exports = discordProcesses;