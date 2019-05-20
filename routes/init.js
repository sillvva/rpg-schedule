const express = require("express");
const request = require("request");
const moment = require("moment");

const Game = require("../models/game");
const GuildConfig = require("../models/guild-config");
const config = require("../models/config");
const aux = require("../appaux");

const parsedURLs = aux.parseConfigURLs(config.urls);
const { connection } = require("../db");

module.exports = options => {
    const router = express.Router();
    const { client } = options;

    router.use("/", async (req, res, next) => {
        console.log(req.originalUrl);

        if (!parsedURLs.find(path => path.session && req._parsedOriginalUrl.pathname === path.url)) {
            next();
            return;
        }

        const guildPermission = parsedURLs.find(path => path.guildPermission && req._parsedOriginalUrl.pathname === path.url) ? true : false;

        req.account = {
            config: config,
            viewing: {
                home: req._parsedOriginalUrl.pathname === config.urls.base.url,
                games: req._parsedOriginalUrl.pathname === config.urls.game.games.url,
                dashboard: req._parsedOriginalUrl.pathname === config.urls.game.dashboard.url,
                game: req._parsedOriginalUrl.pathname === config.urls.game.create.url
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
                    request(
                        {
                            url: "https://discordapp.com/api/users/@me",
                            method: "GET",
                            headers: {
                                authorization: `${access.token_type} ${access.access_token}`
                            }
                        },
                        async (error, response, body) => {
                            try {
                                if (!error && response.statusCode === 200) {
                                    const response = JSON.parse(body);
                                    const { username, discriminator, id, avatar } = response;
                                    const tag = `${username}#${discriminator}`;
                                    const guildConfigs = await GuildConfig.fetchAll();

                                    req.account.user = {
                                        ...response,
                                        ...{
                                            tag: tag,
                                            avatarURL: `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=128`
                                        }
                                    };

                                    client.guilds.forEach(guild => {
                                        const guildConfig = guildConfigs.find(gc => gc.guild === guild.id) || {};
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
                                        req.account.guilds = req.account.guilds.filter(
                                            guild => !guild.config.hidden // && (req.account.viewing.games || req.account.viewing.dashboard))
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

                                    if (req.account.viewing.dashboard && tag !== config.author) {
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

                                    const games = await Game.fetchAllBy(gameOptions);
                                    games.forEach(game => {
                                        const date = Game.ISOGameDate(game);
                                        game.moment = {
                                            raw: `${game.date} ${game.time} GMT${game.timezone < 0 ? "-" : "+"}${Math.abs(game.timezone)}`,
                                            iso: date,
                                            date: moment(date)
                                                .utcOffset(parseInt(game.timezone))
                                                .format(config.formats.dateLong),
                                            calendar: moment(date)
                                                .utcOffset(parseInt(game.timezone))
                                                .calendar(),
                                            from: moment(date)
                                                .utcOffset(parseInt(game.timezone))
                                                .fromNow()
                                        };

                                        game.slot = game.reserved.split(/\r?\n/).findIndex(t => t.trim().replace("@", "") === tag) + 1;
                                        game.signedup = game.slot > 0 && game.slot <= parseInt(game.players);
                                        game.waitlisted = game.slot > parseInt(game.players);

                                        const gi = req.account.guilds.findIndex(g => g.id === game.s);
                                        req.account.guilds[gi].games.push(game);
                                    });

                                    guilds = guilds.map(guild => {
                                        guild.games.sort((a, b) => {
                                            return a.timestamp > b.timestamp ? -1 : 1;
                                        });
                                        return guild;
                                    });

                                    guilds.sort((a, b) => {
                                        const atime = a.games.reduce((i, game) => {
                                            if (i < game.timestamp) return game.timestamp;
                                            else return i;
                                        }, 0);

                                        const btime = b.games.reduce((i, game) => {
                                            if (i < game.timestamp) return game.timestamp;
                                            else return i;
                                        }, 0);

                                        return atime > btime ? -1 : 1;
                                    });

                                    if (req.account.viewing.home) {
                                        res.redirect(config.urls.game.dashboard.url);
                                        return;
                                    }

                                    next();
                                    return;
                                }
                                throw new Error(error);
                            } catch (err) {
                                if (req.account.viewing.dashboard) {
                                    res.render("error", { message: err });
                                } else {
                                    next();
                                }
                            }
                        }
                    );
                } else {
                    if (req.account.viewing.home) next();
                    else res.redirect(config.urls.login.url);
                }
            } else {
                if (req.account.viewing.home) next();
                else res.redirect(config.urls.login.url);
            }
        } catch (e) {
            res.render("error", { message: e.message });
        }
    });

    return router;
};
