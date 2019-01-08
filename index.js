const http = require('http');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const express = require('express');
const discord = require('discord.js');

const db = require('./db');

const client = new discord.Client();
const host = process.env.HOST;
const gameUrl = '/game';

const app = express();

app.use(bodyParser.urlencoded());

app.use(gameUrl, (req, res, next) => {
    const server = req.query.s;

    if (!db.connection()) next();
    
    console.log(req);

    if (server) {
        const guild = client.guilds.get(server);

        if (guild) {
            fs.readFile(path.join(__dirname, 'views', 'game.html'), 'utf8', async (err, data) => {
                try {
                    if (err) throw err;
                    
                    let channelId;
                    
                    if (req.query.g) {
                        result = await db.getGame(req.query.g);
                        if (!result) throw new Error('Game not found');
                        channelId = result.c;
                    }
                    else {
                        result = await db.getGuildConfig(guild.id);
                        if (!result) throw new Error('Discord server not found');
                        channelId = result.channel;
                    }
    
                    const channel = guild.channels.get(channelId) || guild.channels.array().find(c => c instanceof discord.TextChannel);
                    const d = new Date();
                    const tz = parseFloat(req.query.tz);
                    d.setHours(d.getHours()+tz);
    
                    if (!channel) {
                        throw new Error('Discord channel not found');
                    }
    
                    let dataValues = {
                        title: req.query.g ? 'Edit Game' : 'New Game',
                        guild: guild.name,
                        channel: channel.name,
                        s: server,
                        c: channel.id,
                        date: d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0')+'-'+(d.getDate()).toString().padStart(2, '0'),
                        time: d.getHours().toString().padStart(2, '0')+':'+d.getMinutes().toString().padStart(2, '0'),
                        timezone: -d.getTimezoneOffset()/60+tz,
                        dm: '',
                        adventure: '',
                        runtime: '',
                        where: '',
                        reserved: '',
                        description: '',
                        players: 7
                    };
    
                    if (req.query.g) {
                        const savedValues = { ...result };
                        delete savedValues.gameId;
                        delete savedValues.messageId;
                        dataValues = Object.assign(dataValues, savedValues);
                    }
    
                    if (req.method === 'POST') {
                        dataValues.date = req.body.date;
                        dataValues.time = req.body.time;
                        dataValues.dm = req.body.dm;
                        dataValues.adventure = req.body.adventure;
                        dataValues.runtime = req.body.runtime;
                        dataValues.where = req.body.where;
                        dataValues.description = req.body.description;
                        dataValues.reserved = req.body.reserved;
                        dataValues.timezone = req.body.timezone;
                        dataValues.players = req.body.players;
                    }
    
                    Object.entries(dataValues).forEach(entry => {
                        const [key, val] = entry;
                        data = data.replace(new RegExp('{{'+key+'}}', 'g'), val);
                    });
    
                    if (req.method === 'POST') {
                        let gameId = (new Date().getTime()).toString() +
                            (req.body.dm.match(/#\d{4}/) ? req.body.dm.split('#').pop() : Math.round(Math.random() * 9999));
    
                        if (req.query.g) {
                            gameId = req.query.g;
                        }
    
                        const game = { id: gameId, ...req.body };
    
                        db.setGame(channel, game).then(response => {
                            // res.send(data);
                            res.redirect(gameUrl+'?s='+req.body.s+'&g='+game.id);
                            
                            if (response.dm) {
                                response.dm.sendMessage("You can edit your `"+game.adventure+"` game here:\n"+host+gameUrl+'?s='+req.body.s+'&g='+game.id);
                            }
                        }).catch(err => {
                            if (err.message.startsWith('DM')) {
                                data = data.replace(/{{dm-error}}/g, `<small class="error">${err.message}</small>`);
                            }
    
                            data = data.replace(/{{[^-]+-error}}/g, '');
    
                            res.send(data);
                        });
                    } else {
                        data = data.replace(/{{[^-]+-error}}/g, '');
    
                        res.send(data);
                    }
                } catch(err) {
                    data = displayError(err);

                    res.send(data);
                }
            });
        } else {
            next();
        }
    } else {
        next();
    }
});

app.use('/', (req, res, next) => {
    res.send(`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 2rem; font-family: sans-serif; position: fixed; top: 0; left: 0; right: 0; bottom: 0;">
            <h3>I'm the RPG Schedule Bot!</h3>
            <div><a href="${process.env.INVITE}">Invite Me</a></div>
        </div>
    `);
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.username}!`);

    db.connect().then(connected => {
        if (connected) {
            console.log('Connected!');
        } else {
            console.log('Not connected!');
        }
    });

    server.listen(process.env.PORT || 5000);
});

client.on('message', (message) => {
    if (message.content.startsWith('!schedule')) {
        const parts = message.content.split(' ').slice(1);
        const cmd = parts.reverse().pop();

        if (cmd === 'help') {
            let embed = new discord.RichEmbed()
                .setTitle('RPG Schedule Help')
                .setColor(0x2196F3)
                .setDescription(`
                    __**Command List**__
                    \`!schedule help\` - Display this help window
                    
                    Configuration
                    \`!schedule channel #channel-name\` - Configure the channel where games are posted
                    
                    Usage
                    \`!schedule link\` - Retrieve link for posting games
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

client.on('messageReactionAdd', async (reaction, user) => {
    const message = reaction.message;
    const game = await db.getGameBy('messageId', message.id);
    if (game && user.id !== message.author.id) {
        const channel = message.channel;
        if (reaction.emoji.name === '➕') {
            if (game.reserved.indexOf(user.tag) < 0) {
                game.reserved = [ ...game.reserved.trim().split(/\r?\n/), user.tag ].join("\n");
                if (game.reserved.startsWith("\n")) game.reserved = game.reserved.substr(1);
                db.setGame(channel, game);
            }
        } else if (reaction.emoji.name === '➖') {
            if (game.reserved.indexOf(user.tag) >= 0) {
                game.reserved = game.reserved.split(/\r?\n/).filter(tag => tag !== user.tag).join("\n");
                db.setGame(channel, game);
            }
        }

        reaction.remove(user);
    }
});

client.on('messageDelete', async message => {
    const game = await db.getGameBy('messageId', message.id);
    if (game) {
        db.deleteGame(game.id).then((result) => {
            console.log('Game deleted');
        });
    }
});

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

// client.login(process.env.TOKEN);

const displayError = (err) => {
    return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 2rem; font-family: sans-serif; position: fixed; top: 0; left: 0; right: 0; bottom: 0;">
        <h3>Error:</h3>
        <pre>${err.message}</pre>
    </div>
    `;
}