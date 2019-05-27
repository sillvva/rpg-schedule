"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const request_1 = __importDefault(require("request"));
const moment_1 = __importDefault(require("moment"));
const game_1 = require("../models/game");
const guild_config_1 = require("../models/guild-config");
const config_1 = __importDefault(require("../models/config"));
const appaux_1 = __importDefault(require("../appaux"));
const db_1 = __importDefault(require("../db"));
const parsedURLs = appaux_1.default.parseConfigURLs(config_1.default.urls);
const connection = db_1.default.connection;
exports.default = (options) => {
    const router = express_1.default.Router();
    const client = options.client;
    router.use("/", async (req, res, next) => {
        console.log(req.originalUrl);
        if (!parsedURLs.find(path => path.session && req._parsedOriginalUrl.pathname === path.url)) {
            next();
            return;
        }
        const guildPermission = parsedURLs.find(path => path.guildPermission && req._parsedOriginalUrl.pathname === path.url) ? true : false;
        req.account = {
            config: config_1.default,
            viewing: {
                home: req._parsedOriginalUrl.pathname === config_1.default.urls.base.url,
                games: req._parsedOriginalUrl.pathname === config_1.default.urls.game.games.url,
                dashboard: req._parsedOriginalUrl.pathname === config_1.default.urls.game.dashboard.url,
                game: req._parsedOriginalUrl.pathname === config_1.default.urls.game.create.url
            },
            guilds: [],
            user: null
        };
        try {
            const storedSession = await connection()
                .collection("sessions")
                .findOne({ _id: req.session.id });
            if (storedSession) {
                req.session.status = storedSession.session.status;
            }
            if (req.session.status) {
                const access = req.session.status.access;
                if (access.token_type) {
                    request_1.default({
                        url: "https://discordapp.com/api/users/@me",
                        method: "GET",
                        headers: {
                            authorization: `${access.token_type} ${access.access_token}`
                        }
                    }, async (error, response, body) => {
                        try {
                            if (!error && response.statusCode === 200) {
                                const response = JSON.parse(body);
                                const { username, discriminator, id, avatar } = response;
                                const tag = `${username}#${discriminator}`;
                                const guildConfigs = await guild_config_1.GuildConfig.fetchAll();
                                req.account.user = {
                                    ...response,
                                    ...{
                                        tag: tag,
                                        avatarURL: `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=128`
                                    }
                                };
                                client.guilds.forEach(guild => {
                                    const guildConfig = guildConfigs.find(gc => gc.guild === guild.id) || guild_config_1.GuildConfig.defaultConfig(guild.id);
                                    guild.members.forEach(member => {
                                        if (member.id === id) {
                                            req.account.guilds.push({
                                                id: guild.id,
                                                name: guild.name,
                                                icon: guild.iconURL,
                                                permission: guildConfig.role
                                                    ? member.roles.find(r => r.name.toLowerCase().trim() === guildConfig.role.toLowerCase().trim())
                                                    : true,
                                                channels: guild.channels,
                                                config: guildConfig,
                                                games: []
                                            });
                                        }
                                    });
                                });
                                if (guildPermission) {
                                    req.account.guilds = req.account.guilds.filter(guild => !guild.config.hidden // && (req.account.viewing.games || req.account.viewing.dashboard))
                                    );
                                }
                                const gameOptions = {
                                    s: {
                                        $in: req.account.guilds.reduce((i, g) => {
                                            i.push(g.id);
                                            return i;
                                        }, [])
                                    }
                                };
                                if (req.account.viewing.dashboard && tag !== config_1.default.author) {
                                    gameOptions.$or = [
                                        {
                                            dm: tag
                                        },
                                        {
                                            reserved: {
                                                $regex: tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")
                                            }
                                        }
                                    ];
                                }
                                if (req.account.viewing.games) {
                                    gameOptions.timestamp = {
                                        $gt: new Date().getTime()
                                    };
                                    gameOptions.dm = {
                                        $ne: tag
                                    };
                                }
                                const games = await game_1.Game.fetchAllBy(gameOptions);
                                games.forEach(game => {
                                    const date = game_1.Game.ISOGameDate(game);
                                    game.moment = {
                                        raw: `${game.date} ${game.time} GMT${game.timezone < 0 ? "-" : "+"}${Math.abs(game.timezone)}`,
                                        iso: date,
                                        date: moment_1.default(date)
                                            .utcOffset(parseInt(game.timezone))
                                            .format(config_1.default.formats.dateLong),
                                        calendar: moment_1.default(date)
                                            .utcOffset(parseInt(game.timezone))
                                            .calendar(),
                                        from: moment_1.default(date)
                                            .utcOffset(parseInt(game.timezone))
                                            .fromNow()
                                    };
                                    game.slot = game.reserved.split(/\r?\n/).findIndex(t => t.trim().replace("@", "") === tag) + 1;
                                    game.signedup = game.slot > 0 && game.slot <= parseInt(game.players);
                                    game.waitlisted = game.slot > parseInt(game.players);
                                    const gi = req.account.guilds.findIndex(g => g.id === game.s);
                                    req.account.guilds[gi].games.push(game);
                                });
                                if (req.account.viewing.games) {
                                    req.account.guilds = req.account.guilds.filter(guild => guild.games.length > 0);
                                }
                                req.account.guilds = req.account.guilds.map(guild => {
                                    guild.games.sort((a, b) => {
                                        return a.timestamp < b.timestamp ? -1 : 1;
                                    });
                                    return guild;
                                });
                                req.account.guilds.sort((a, b) => {
                                    if (a.games.length === 0 && b.games.length === 0)
                                        return a.name < b.name ? -1 : 1;
                                    if (a.games.length === 0)
                                        return 1;
                                    if (b.games.length === 0)
                                        return -1;
                                    return a.games[0].timestamp < b.games[0].timestamp ? -1 : 1;
                                });
                                if (req.account.viewing.home) {
                                    res.redirect(config_1.default.urls.game.dashboard.url);
                                    return;
                                }
                                next();
                                return;
                            }
                            throw new Error(error);
                        }
                        catch (err) {
                            if (req.account.viewing.dashboard) {
                                res.render("error", { message: err });
                            }
                            else {
                                next();
                            }
                        }
                    });
                }
                else {
                    if (req.account.viewing.home)
                        next();
                    else
                        res.redirect(config_1.default.urls.login.url);
                }
            }
            else {
                if (req.account.viewing.home)
                    next();
                else
                    res.redirect(config_1.default.urls.login.url);
            }
        }
        catch (e) {
            res.render("error", { message: e.message });
        }
    });
    return router;
};
