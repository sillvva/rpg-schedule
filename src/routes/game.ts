import express from "express";
import moment from "moment";
import discord, { Guild, TextChannel } from "discord.js";

import { Game } from "../models/game";
import { GuildConfig } from "../models/guild-config";
import config from "../models/config";

interface GameRouteOptions {
  client: discord.Client;
}

export default (options: GameRouteOptions) => {
  const router = express.Router();
  const { client } = options;

  router.use(config.urls.game.games.path, async (req: any, res, next) => {
    res.render("games");
  });

  router.use(config.urls.game.dashboard.path, async (req: any, res, next) => {
    res.render("games");
  });

  router.use(config.urls.game.server.path, async (req: any, res, next) => {
    res.render("games");
  });

  router.use(config.urls.game.calendar.path, async (req: any, res, next) => {
    res.render("calendar", {
      qm: req.query.m,
      qy: req.query.y,
      qd: req.query.d,
      moment: moment
    });
  });

  router.use(config.urls.game.create.path, async (req: any, res, next) => {
    try {
      let game: Game;
      let server: string = req.query.s;
      if (req.query.g && !(req.body && req.body.copy)) {
        game = await Game.fetch(req.query.g);
        if (game) {
          server = game.s;
        } else {
          throw new Error("Game not found");
        }
      }

      if (req.method === "POST") {
        req.body.reserved = req.body.reserved.replace(/@/g, "");
        if (req.body.copy) {
          delete req.query.g;
          req.query.s = req.body.s;
          server = req.body.s;
        }
        if (req.query.s) {
          game = new Game(req.body);
        }
      }

      if (server) {
        const guild: Guild = client.guilds.cache.get(server);

        if (guild) {
          let password: string;

          const guildConfig = await GuildConfig.fetch(guild.id);
          const guildMembers = await guild.members.fetch();
          const member = guildMembers.array().find(m => m.id === req.account.user.id);
          if (guildConfig && !(member && req.account.user.tag === config.author)) {
            password = guildConfig.password;
            if (guildConfig.role) {
              if (!req.account) {
                res.redirect(config.urls.login.path);
                return;
              } else {
                if (member) {
                  if (!member.roles.cache.find(r => r.name.toLowerCase().trim() === guildConfig.role.toLowerCase().trim())) {
                    res.redirect(config.urls.game.dashboard.path);
                    return;
                  }
                } else {
                  res.redirect(config.urls.game.dashboard.path);
                  return;
                }
              }
            }
          }

          const textChannels = <TextChannel[]>guild.channels.cache.array().filter(c => c instanceof TextChannel);
          const channels = guildConfig.channels.filter(c => guild.channels.cache.array().find(gc => gc.id == c)).map(c => guild.channels.cache.get(c));
          if (channels.length === 0 && textChannels.length > 0) channels.push(textChannels[0]);

          if (channels.length === 0) {
            throw new Error("Discord channel not found. Make sure your server has a text channel.");
          }

          let data: any = {
            title: req.query.g ? req.lang.buttons.EDIT_GAME : req.lang.buttons.NEW_GAME,
            guild: guild.name,
            channels: channels,
            s: server,
            c: channels[0].id,
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
            date: req.query.date || "",
            time: req.query.time || "",
            timezone: "",
            reminder: "0",
            gameImage: "",
            frequency: "",
            weekdays: [false,false,false,false,false,false,false],
            is: {
              newgame: !req.query.g ? true : false,
              editgame: req.query.g ? true : false,
              locked: password ? true : false
            },
            password: password ? password : false,
            // host: process.env.HOST,
            // account: req.account,
            // lang: req.lang.selected,
            // langs: req.lang.list,
            guildConfig: guildConfig,
            errors: {
              other: null,
              dm: game && !guildMembers.array().find(mem => {
                return !mem.user.bot && mem.user.tag === game.dm.trim().replace("@", "");
              }),
              reserved: game ? game.reserved
                .replace(/@/g, "")
                .split(/\r?\n/)
                .filter(res => {
                  if (res.trim().length === 0) return false;
                  return !guildMembers.array().find(mem => !mem.user.bot && mem.user.tag === res.trim());
                }) : []
            }
          };

          if (req.query.g) {
            data = { ...data, ...game };
          }

          if (req.method === "POST") {
            data = Object.assign(data, req.body);
          }

          if (req.method === "POST") {
            Object.entries(req.body).forEach(([key, value]) => {
              game[key] = value;
            });

            for (let i = 0; i < 7; i++) {
              game.weekdays[i] = req.body['weekday'+i] ? true : false; // have to manually re-set falses b/c form data isn't sent if the checkbox is not checked
            }
            data.weekdays = game.weekdays;

            game
              .save()
              .then(response => {
                if (response.modified) res.redirect(config.urls.game.create.path + "?g=" + response._id);
                else res.render("game", data);
              })
              .catch(err => {
                if (err.message.startsWith("DM")) {
                  data.errors.dm = err.message;
                }
                else {
                  data.errors.other = err.message;
                }
                res.render("game", data);
              });
          } else {
            res.render("game", data);
          }
        } else {
          throw new Error("Discord server not found");
        }
      } else {
        throw new Error("Discord server not specified");
      }
    } catch (err) {
      res.render("error", { message: "routes/game.ts:1:<br />" + err });
    }
  });

  router.use(config.urls.game.rsvp.path, async (req: any, res, next) => {
    try {
      if (req.query.g) {
        const game = await Game.fetch(req.query.g);
        if (game) {
          const reserved = game.reserved.split(/\r?\n/);
          if (reserved.find(t => t === req.account.user.tag)) {
            reserved.splice(reserved.indexOf(req.account.user.tag), 1);
          } else {
            reserved.push(req.account.user.tag);
          }

          game.reserved = reserved.join("\n");

          const result = await game.save();
        }
      }
    } catch (err) {
      console.log(err);
    }

    res.redirect(req.query.return ? req.query.return : req.headers.referer ? req.headers.referer : config.urls.game.games.path);
  });

  router.get(config.urls.game.delete.path, async (req: any, res, next) => {
    try {
      if (req.query.g) {
        const game = await Game.fetch(req.query.g);
        if (!game) throw new Error("Game not found");
        game.delete({ sendWS: false }).then(response => {
          if (req.account) {
            res.redirect(config.urls.game.dashboard.path);
          } else {
            res.redirect(config.urls.game.create.path + "?s=" + game.s);
          }
        });
      } else {
        throw new Error("Game not found");
      }
    } catch (err) {
      res.render("error", { message: "routes/game.ts:2:<br />" + err });
    }
  });

  router.get(config.urls.game.password.path, async (req, res, next) => {
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
          req.session.status.loggedInTo = req.session.status.loggedInTo.filter(s => s !== req.query.s);
        }
        res.status(200).json({ result: result });
      } else {
        throw new Error("Server not found");
      }
    } catch (err) {
      res.render("error", { message: "routes/game.ts:3:<br />" + err });
    }
  });

  router.get(config.urls.game.auth.path, (req, res, next) => {
    if (!req.session.status) {
      req.session.status = config.defaults.sessionStatus;
    } else {
      req.session.status = { ...config.defaults.sessionStatus, ...req.session.status };
    }
    res.status(200).json({ status: req.session.status });
  });

  return router;
};
