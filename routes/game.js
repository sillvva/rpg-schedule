const fs = require('fs');
const path = require('path');
const express = require('express');
const discord = require('discord.js');

const db = require('../db');

const host = process.env.HOST;
const gameUrl = '/game';

module.exports = (options) => {
    const router = express.Router();
    const { client } = options; 
    
    router.use(gameUrl, async (req, res, next) => {
        const server = req.query.s;
    
        if (!db.connection()) next();
    
        if (server) {
            const guild = client.guilds.get(server);
    
            if (guild) {
                try {
                    let channelId;
                    let result;
                    
                    if (req.query.g) {
                        result = await db.getGame(req.query.g);
                        if (!result) throw new Error('Game not found');
                        channelId = result.c;
                    }
                    else {
                        result = await db.getGuildConfig(guild.id);
                        if (result) channelId = result.channel;
                        else {
                            const firstChannel = guild.channels.array().filter(c => c instanceof discord.TextChannel)[0];
                            if (!firstChannel) throw new Error('Discord server not found');
                            channelId = firstChannel.id;
                        }
                    }
    
                    const channel = guild.channels.get(channelId) || guild.channels.array().find(c => c instanceof discord.TextChannel);
    
                    if (!channel) {
                        throw new Error('Discord channel not found');
                    }
    
                    let data = {
                        title: req.query.g ? 'Edit Game' : 'New Game',
                        guild: guild.name,
                        channel: channel.name,
                        s: server,
                        c: channel.id,
                        date: '',
                        time: '',
                        timezone: '',
                        dm: '',
                        adventure: '',
                        runtime: '',
                        where: '',
                        reserved: '',
                        description: '',
                        players: 7,
                        isgame: req.query.g ? 1 : 0
                    };
    
                    if (req.query.g) {
                        const savedValues = { ...result };
                        delete savedValues.gameId;
                        delete savedValues.messageId;
                        data = Object.assign(data, savedValues);
                    }
    
                    if (req.method === 'POST') {
                        data.date = req.body.date;
                        data.time = req.body.time;
                        data.dm = req.body.dm;
                        data.adventure = req.body.adventure;
                        data.runtime = req.body.runtime;
                        data.where = req.body.where;
                        data.description = req.body.description;
                        data.reserved = req.body.reserved;
                        data.timezone = req.body.timezone;
                        data.players = req.body.players;
                    }
    
                    if (req.method === 'POST') {
                        let gameId = (new Date().getTime()).toString() +
                            (req.body.dm.match(/#\d{4}/) ? req.body.dm.split('#').pop() : Math.round(Math.random() * 9999));
    
                        if (req.query.g) {
                            gameId = req.query.g;
                        }
    
                        const game = { id: gameId, ...req.body };
    
                        db.setGame(channel, game).then(response => {
                            res.redirect(gameUrl+'?s='+req.body.s+'&g='+game.id);
                            
                            if (response.dm) {
                                response.dm.send("You can edit your `"+game.adventure+"` game here:\n"+host+gameUrl+'?s='+req.body.s+'&g='+game.id);
                            }
                        }).catch(err => {
                            data.dmError = err.message.startsWith('DM') ? err.message : false;
                            res.render('game', data);
                        });
                    } else {
                        res.render('game', data);
                    }
                } catch(err) {
                    res.send(displayError(err));
                }
            } else {
                next();
            }
        } else {
            next();
        }
    });
    
    return router;
};

const displayError = (err) => {
    return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 2rem; font-family: sans-serif; position: fixed; top: 0; left: 0; right: 0; bottom: 0;">
        <h3>Error:</h3>
        <pre>${err.message}</pre>
    </div>
    `;
};