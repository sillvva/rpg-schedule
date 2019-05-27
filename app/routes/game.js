"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const discord_js_1 = __importDefault(require("discord.js"));
const game_1 = require("../models/game");
const guild_config_1 = require("../models/guild-config");
const config_1 = __importDefault(require("../models/config"));
exports.default = (options) => {
    const router = express_1.default.Router();
    const { client } = options;
    router.use(config_1.default.urls.game.games.url, async (req, res, next) => {
        res.render("games", req.account);
    });
    router.use(config_1.default.urls.game.dashboard.url, async (req, res, next) => {
        res.render("games", req.account);
    });
    router.use(config_1.default.urls.game.create.url, async (req, res, next) => {
        try {
            let game;
            let server = req.query.s;
            if (req.query.g) {
                game = await game_1.Game.fetch(req.query.g);
                if (game) {
                    server = game.s;
                }
                else {
                    throw new Error("Game not found");
                }
            }
            if (server) {
                const guild = client.guilds.get(server);
                if (guild) {
                    let channelId;
                    let password;
                    const guildConfig = await guild_config_1.GuildConfig.fetch(guild.id);
                    if (guildConfig) {
                        password = guildConfig.password;
                        if (guildConfig.role) {
                            if (!req.account) {
                                res.redirect(config_1.default.urls.login.url);
                                return;
                            }
                            else {
                                const member = guild.members.find(m => m.id === req.account.user.id);
                                if (member) {
                                    if (!member.roles.find(r => r.name.toLowerCase().trim() === guildConfig.role.toLowerCase().trim())) {
                                        res.redirect(config_1.default.urls.game.dashboard.url);
                                        return;
                                    }
                                }
                                else {
                                    res.redirect(config_1.default.urls.game.dashboard.url);
                                    return;
                                }
                            }
                        }
                    }
                    if (req.query.g) {
                        channelId = game.c;
                    }
                    else {
                        if (guildConfig)
                            channelId = guildConfig.channel;
                    }
                    const textChannels = guild.channels.array().filter(c => c instanceof discord_js_1.default.TextChannel);
                    const channel = textChannels.find(c => c.id === channelId) || textChannels[0];
                    if (!channel) {
                        throw new Error("Discord channel not found");
                    }
                    let data = {
                        title: req.query.g ? "Edit Game" : "New Game",
                        guild: guild.name,
                        channel: channel.name,
                        s: server,
                        c: channel.id,
                        dm: req.account ? req.account.user.tag : "",
                        adventure: "",
                        runtime: "",
                        where: "",
                        reserved: "",
                        description: "",
                        players: 7,
                        method: "automated",
                        customSignup: "",
                        when: "datetime",
                        date: "",
                        time: "",
                        timezone: "",
                        reminder: "0",
                        is: {
                            newgame: !req.query.g ? true : false,
                            editgame: req.query.g ? true : false,
                            locked: password ? true : false
                        },
                        password: password ? password : false,
                        host: process.env.HOST,
                        account: req.account,
                        errors: {
                            dm: false
                        }
                    };
                    if (req.query.g) {
                        data = { ...data, ...game };
                    }
                    if (req.method === "POST") {
                        data.dm = req.body.dm;
                        data.adventure = req.body.adventure;
                        data.runtime = req.body.runtime;
                        data.where = req.body.where;
                        data.description = req.body.description;
                        data.reserved = req.body.reserved.replace(/@/g, '');
                        data.method = req.body.method;
                        data.customSignup = req.body.customSignup;
                        data.when = req.body.when;
                        data.date = req.body.date;
                        data.time = req.body.time;
                        data.timezone = req.body.timezone;
                        data.reminder = req.body.reminder;
                        data.players = req.body.players;
                    }
                    if (req.method === "POST") {
                        game_1.Game.save(channel, { ...game, ...req.body })
                            .then(response => {
                            if (response.modified)
                                res.redirect(config_1.default.urls.game.create.url + "?g=" + response._id);
                            else
                                res.render("game", data);
                        })
                            .catch(err => {
                            data.errors.dm = err.message.startsWith("DM") ? err.message : false;
                            res.render("game", data);
                        });
                    }
                    else {
                        res.render("game", data);
                    }
                }
                else {
                    throw new Error("Discord server not found");
                }
            }
            else {
                throw new Error("Discord server not specified");
            }
        }
        catch (err) {
            res.render("error", { message: err });
        }
    });
    router.use(config_1.default.urls.game.rsvp.url, async (req, res, next) => {
        try {
            if (req.query.g) {
                const game = await game_1.Game.fetch(req.query.g);
                if (game) {
                    const guild = req.account.guilds.find(s => s.id === game.s);
                    if (guild) {
                        const channel = guild.channels.find(c => c.id === game.c && c instanceof discord_js_1.default.TextChannel);
                        if (channel) {
                            const reserved = game.reserved.split(/\r?\n/);
                            if (reserved.find(t => t === req.account.user.tag)) {
                                reserved.splice(reserved.indexOf(req.account.user.tag), 1);
                            }
                            else {
                                reserved.push(req.account.user.tag);
                            }
                            game.reserved = reserved.join("\n");
                            const result = await game_1.Game.save(channel, game);
                        }
                    }
                }
            }
        }
        catch (err) {
            console.log(err);
        }
        res.redirect(req.headers.referer ? req.headers.referer : config_1.default.urls.game.games.url);
    });
    router.get(config_1.default.urls.game.delete.url, async (req, res, next) => {
        try {
            if (req.query.g) {
                const game = await game_1.Game.fetch(req.query.g);
                if (!game)
                    throw new Error("Game not found");
                const serverId = game.s;
                const channelId = game.c;
                const guild = client.guilds.get(serverId);
                if (guild) {
                    const channel = guild.channels.get(channelId);
                    game_1.Game.delete(game, channel, { sendWS: false }).then(response => {
                        if (req.account) {
                            res.redirect(config_1.default.urls.game.dashboard.url);
                        }
                        else {
                            res.redirect(config_1.default.urls.game.create.url + "?s=" + serverId);
                        }
                    });
                }
                else {
                    throw new Error("Server not found");
                }
            }
            else {
                throw new Error("Game not found");
            }
        }
        catch (err) {
            res.render("error", { message: err });
        }
    });
    router.get(config_1.default.urls.game.password.url, async (req, res, next) => {
        try {
            const guildConfig = await guild_config_1.GuildConfig.fetch(req.query.s);
            if (guildConfig) {
                const result = guildConfig.password === req.query.p;
                req.session.status = {
                    ...config_1.default.defaults.sessionStatus,
                    ...req.session.status
                };
                if (result) {
                    req.session.status.loggedInTo.push(req.query.s);
                }
                else {
                    req.session.status.loggedInTo = req.session.status.loggedInTo.filter(s => s !== req.query.s);
                }
                res.status(200).json({ result: result });
            }
            else {
                throw new Error("Server not found");
            }
        }
        catch (err) {
            res.render("error", { message: err });
        }
    });
    router.get(config_1.default.urls.game.auth.url, (req, res, next) => {
        if (!req.session.status) {
            req.session.status = config_1.default.defaults.sessionStatus;
        }
        else {
            req.session.status = { ...config_1.default.defaults.sessionStatus, ...req.session.status };
        }
        res.status(200).json({ status: req.session.status });
    });
    return router;
};
