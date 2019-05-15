const express = require('express');
const request = require('request');
const discord = require('discord.js');
const moment = require('moment');

const Game = require('../models/game');
const GuildConfig = require('../models/guild-config');
const config = require('../models/config');

module.exports = (options) => {
    const router = express.Router();
    const { client } = options;

    router.use('/', async (req, res, next) => {
        req.userData = null;
        const isGame = Object.values(config.urls.game).find(url => req.originalUrl.indexOf(url) === 0);
        const isDashboard = req.originalUrl.indexOf(config.urls.game.dashboard) === 0;
        if (!isGame) {
            next();
            return;
        }
        try {
            if (req.session.status) {
                const access = req.session.status.access;
                if (access.token_type) {
                    request({
                        url: 'https://discordapp.com/api/users/@me',
                        method: 'GET',
                        headers: {
                            authorization: `${access.token_type} ${access.access_token}`
                        }
                    }, async (error, response, body) => {
                        try {
                            if (!error && response.statusCode === 200) {
                                const response = JSON.parse(body);
                                const { username, discriminator, id, avatar } = response;
                                const tag = `${username}#${discriminator}`;

                                const data = {
                                    config: config,
                                    user: {
                                        ...response,
                                        ...{
                                            tag: tag,
                                            avatarURL: `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=128`
                                        }
                                    },
                                    guilds: []
                                };

                                client.guilds.forEach(guild => {
                                    guild.members.forEach(member => {
                                        if (member.id === id) {
                                            data.guilds.push({
                                                id: guild.id,
                                                name: guild.name,
                                                icon: guild.iconURL,
                                                games: []
                                            });
                                        }
                                    });
                                });

                                const gameOptions = {
                                    s: {
                                        $in: data.guilds.reduce((i, g) => {
                                            i.push(g.id);
                                            return i;
                                        }, [])
                                    }
                                };

                                if (tag !== 'Sillvva#2532') {
                                    gameOptions.dm = tag;
                                }

                                const games = await Game.fetchAllBy(gameOptions);
                                games.forEach(game => {
                                    const date = `${game.date} ${game.time} GMT${game.timezone >= 0 ? '+' : '-'}${Math.abs(game.timezone)}`;
                                    game.moment = {
                                        date: moment(date).utcOffset(parseInt(game.timezone)).format(config.formats.dateLong),
                                        from: moment(date).utcOffset(parseInt(game.timezone)).fromNow()
                                    };

                                    const gi = data.guilds.findIndex(g => g.id === game.s);
                                    data.guilds[gi].games.push(game);
                                });

                                req.account = data;
                                next();
                                return;
                            }
                            throw new Error(error);
                        } catch(err) {
                            if (isDashboard) {
                                res.render('error', { message: err });
                            } else {
                                next();
                            }
                        }
                    });
                } else {
                    if (isDashboard) {
                        res.redirect(config.urls.login);
                    } else {
                        next();
                    }
                }
            } else {
                if (isDashboard) {
                    res.redirect(config.urls.login);
                } else {
                    next();
                }
            }
        }
        catch(e) {
            res.render('error', { message: e.message });
        }
    });

    router.use(config.urls.game.dashboard, async (req, res, next) => {
        res.render('games', req.account);
    });
    
    router.use(config.urls.game.create, async (req, res, next) => {
        try {
            let game;
            let server = req.query.s;

            if (req.query.g) {
                game = await Game.fetch(req.query.g);
                if (game) {
                    server = game.s;
                } else {
                    throw new Error('Game not found');
                }
            }

            if (server) {
                const guild = client.guilds.get(server);
        
                if (guild) {
                    let channelId;
                    let password;

                    const guildConfig = await GuildConfig.fetch(guild.id);
                    if (guildConfig) password = guildConfig.password;

                    if (req.query.g) {
                        channelId = game.c;
                    }
                    else {
                        if (guildConfig) channelId = guildConfig.channel;
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
                        dm: req.account ? req.account.user.tag : '',
                        adventure: '',
                        runtime: '',
                        where: '',
                        reserved: '',
                        description: '',
                        players: 7,
                        method: 'automated',
                        customSignup: '',
                        when: 'datetime',
                        date: '',
                        time: '',
                        timezone: '',
                        reminder: '0',
                        is: {
                            newgame: !req.query.g ? true : false,
                            editgame: req.query.g ? true : false,
                            locked: password ? true : false
                        },
                        password: password ? password : false,
                        config: config,
                        host: process.env.HOST,
                        account: req.account,
                        errors: {
                            dm: false
                        }
                    };
    
                    if (req.query.g) {
                        data = { ...data, ...game };
                    }
    
                    if (req.method === 'POST') {
                        data.dm = req.body.dm;
                        data.adventure = req.body.adventure;
                        data.runtime = req.body.runtime;
                        data.where = req.body.where;
                        data.description = req.body.description;
                        data.reserved = req.body.reserved;
                        data.method = req.body.method;
                        data.customSignup = req.body.customSignup;
                        data.when = req.body.when;
                        data.date = req.body.date;
                        data.time = req.body.time;
                        data.timezone = req.body.timezone;
                        data.reminder = req.body.reminder;
                        data.players = req.body.players;
                    }
                    
                    if (req.method === 'POST') {
                        Game.save(channel, { ...game, ...req.body }).then(response => {
                            if (response.modified) res.redirect(config.urls.game.create+'?g='+response._id);
                            else res.render('game', data);
                        }).catch(err => {
                            data.errors.dm = err.message.startsWith('DM') ? err.message : false;
                            res.render('game', data);
                        });
                    } else {
                        res.render('game', data);
                    }
                } else {
                    throw new Error('Discord server not found');
                }
            } else {
                throw new Error('Discord server not specified');
            }
        } catch(err) {
            res.render('error', { message: err });
        }
    });

    router.get(config.urls.game.delete, async (req, res, next) => {
        try {
            if (req.query.g) {
                const game = await Game.fetch(req.query.g);
                if (!game) throw new Error('Game not found');
                const serverId = game.s;
                const channelId = game.c;

                const guild = client.guilds.get(serverId);
                if (guild) {
                    const channel = guild.channels.get(channelId);

                    Game.delete(game, channel, { sendWS: false }).then(response => {
                        console.log(req.account);
                        if (req.account) {
                            res.redirect(config.urls.game.dashboard);
                        } else {
                            res.redirect(config.urls.game.create+'?s='+serverId);
                        }
                    });
                } else {
                    throw new Error('Server not found');
                }
            } else {
                throw new Error('Game not found');
            }
        } catch(err) {
            res.render('error', { message: err });
        }
    });

    router.get(config.urls.game.password, async (req, res, next) => {
        try {
            const guildConfig = await GuildConfig.fetch(req.query.s);
            if (guildConfig) {
                const result = guildConfig.password === req.query.p;
                req.session.status = {
                    ...config.defaults.sessionStatus,
                    ...req.session.status
                };
                if (result) {
                    req.session.status.loggedInTo.push(req.query.s);
                } else {
                    req.session.status.loggedInTo =
                        req.session.status.loggedInTo.filter(s => s !== req.query.s);
                }
                res.status(200).json({ result: result });
            } else {
                throw new Error('Server not found');
            }
        } catch(err) {
            res.render('error', { message: err });
        }
    });

    router.get(config.urls.game.auth, (req, res, next) => {
        if (!req.session.status) {
            req.session.status = config.defaults.sessionStatus;
        } else {
            req.session.status = { ...config.defaults.sessionStatus, ...req.session.status };
        }
        res.status(200).json({ status: req.session.status });
    });
    
    return router;
};