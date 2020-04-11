import { Client, GuildMember, Permissions, TextChannel, Guild } from "discord.js";
import express from "express";
import moment from "moment";
import request from "request";
import merge from "lodash/merge";
import cloneDeep from "lodash/cloneDeep";

import { io } from "../processes/socket";
import { Game, GameMethod, RescheduleMode, GameWhen, MonthlyType } from "../models/game";
import { SiteSettings } from "../models/site-settings";
import { GuildConfig } from "../models/guild-config";
import { Session } from "../models/session";
import { User } from "../models/user";
import config from "../models/config";
import aux from "../appaux";

interface APIRouteOptions {
  client: Client;
}

export default (options: APIRouteOptions) => {
  const router = express.Router();
  const client = options.client;

  router.use("/api", async (req, res, next) => {
    const siteSettings = await SiteSettings.fetch(process.env.SITE);

    req.app.locals.settings = siteSettings.data;

    try {
      const langs = req.app.locals.langs;
      const selectedLang = req.cookies.lang && langs.map((l) => l.code).includes(req.cookies.lang) ? req.cookies.lang : "en";

      req.app.locals.lang = merge(cloneDeep(langs.find((lang: any) => lang && lang.code === "en")), cloneDeep(langs.find((lang: any) => lang && lang.code === selectedLang)));

      res.locals.lang = req.session.lang;
      // res.locals.urlPath = req._parsedOriginalUrl.pathname;
      res.locals.url = req.originalUrl;
      res.locals.env = process.env;

      moment.locale(req.app.locals.lang.code);

      next();
    } catch (err) {
      res.json({
        status: "error",
        code: 1,
        token: req.session.api && req.session.api.access.access_token,
        message: err.message || err,
      });
    }
  });

  router.get("/api/login", async (req, res, next) => {
    if (req.query.code) {
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
      };
      const requestData = {
        url: "https://discordapp.com/api/v6/oauth2/token",
        method: "POST",
        headers: headers,
        form: {
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.CLIENT_SECRET,
          grant_type: "authorization_code",
          code: req.query.code,
          redirect_uri: `${process.env.HOST}/login`,
          scope: "identify guilds",
        },
      };

      request(requestData, async (error, response, body) => {
        if (error || response.statusCode !== 200) {
          return res.json({
            status: "error",
            code: 2,
            message: `Discord OAuth: ${response.statusCode}<br />${error}`,
            redirect: "/",
          });
        }

        const token = JSON.parse(body);
        req.session.api = {
          ...config.defaults.sessionStatus,
          ...req.session.api,
          ...{
            lastRefreshed: moment().unix(),
          },
        };

        req.session.api.access = token;

        fetchAccount(token, {
          client: client,
          guilds: true,
        })
          .then(async (result: any) => {
            const storedSession = await Session.fetch(token);
            if (storedSession) storedSession.delete();

            const d = new Date();
            d.setDate(d.getDate() + 14);
            const session = new Session({
              expires: d,
              token: token.access_token,
              session: {
                api: {
                  lastRefreshed: moment().unix(),
                  access: {
                    access_token: token.access_token,
                    refresh_token: token.refresh_token,
                    expires_in: token.expires_in,
                    scope: token.scope,
                    token_type: token.token_type,
                  },
                },
              },
            });

            await session.save();
            aux.log("success", token.access_token);

            res.json({
              status: "success",
              token: token.access_token,
              account: result.account,
              redirect: config.urls.game.games.path,
            });
          })
          .catch((err) => {
            res.json({
              status: "error",
              code: 3,
              message: err,
              redirect: "/",
            });
          });
      });
    } else if (req.query.error) {
      res.json({
        status: "error",
        code: 4,
        message: req.query.error,
        redirect: "/",
      });
    } else {
      res.json({
        status: "error",
        code: 5,
        message: `OAuth2 code missing`,
        redirect: "/",
      });
    }
  });

  router.use("/auth-api", async (req, res, next) => {
    const langs = req.app.locals.langs;
    const selectedLang = req.cookies.lang && langs.map((l) => l.code).includes(req.cookies.lang) ? req.cookies.lang : "en";

    req.app.locals.lang = merge(cloneDeep(langs.find((lang: any) => lang.code === "en")), cloneDeep(langs.find((lang: any) => lang.code === selectedLang)));

    res.locals.lang = req.app.locals.lang;
    res.locals.url = req.originalUrl;
    res.locals.env = process.env;

    moment.locale(req.app.locals.lang.code);

    const bearer = (req.headers.authorization || "").replace("Bearer ", "").trim();

    if (!bearer || bearer.length == 0) {
      return res.json({
        status: "ignore",
      });
    }

    const storedSession = await Session.fetch(bearer);
    // aux.log(bearer, res.locals.url);
    // aux.log(JSON.stringify(storedSession));
    if (storedSession) {
      req.session.api = storedSession.session.api;
      // console.log((moment().unix() - req.session.api.lastRefreshed) / (60 * 60))
      if ((moment().unix() - req.session.api.lastRefreshed) / (60 * 60) >= 12) {
        refreshToken(req.session.api.access)
          .then((newToken) => {
            // console.log(newToken);
            req.session.api.access = newToken;
            next();
          })
          .catch((err) => {
            res.json({
              status: "error",
              message: err.message || err,
              code: 19,
            });
          });
      } else {
        next();
      }
    } else {
      res.json({
        status: "error",
        message: "Invalid Session",
        code: 18,
      });
    }
  });

  router.get("/auth-api/user", async (req, res, next) => {
    try {
      fetchAccount(req.session.api.access, {
        client: client,
      })
        .then(async (result: any) => {
          const userSettings = await getUserSettings(result.account.user.id, req);
          res.json({
            status: "success",
            token: req.session.api.access.access_token,
            account: result.account,
            user: userSettings.data,
          });
        })
        .catch((err) => {
          res.json({
            status: "error",
            token: req.session.api.access.access_token,
            message: `UserAuthError`,
            code: 9,
          });
        });
    } catch (err) {
      res.json({
        status: "error",
        token: req.session.api.access.access_token,
        code: 10,
        message: `UserAuthError`,
      });
    }
  });

  router.post("/auth-api/user", async (req, res, next) => {
    try {
      fetchAccount(req.session.api.access, {
        client: client,
      })
        .then(async (result: any) => {
          const user = await User.fetch(result.account.user.id);
          let updated = false;

          for (const prop in req.body) {
            if (typeof user[prop] !== "undefined" && user[prop] !== req.body[prop]) {
              user[prop] = req.body[prop];
              updated = true;
            }
          }

          if (updated) await user.save();

          delete user._id;
          delete user.id;

          res.json({
            status: "success",
            token: req.session.api.access.access_token,
            account: result.account,
            user: user.data,
          });
        })
        .catch((err) => {
          res.json({
            status: "error",
            token: req.session.api.access.access_token,
            message: `UserAuthError`,
            code: 9,
          });
        });
    } catch (err) {
      res.json({
        status: "error",
        token: req.session.api.access.access_token,
        code: 10,
        message: `UserAuthError`,
      });
    }
  });

  router.get("/auth-api/guilds", async (req, res, next) => {
    try {
      fetchAccount(req.session.api.access, {
        client: client,
        guilds: true,
        games: req.query.games,
        page: req.query.page,
      })
        .then(async (result: any) => {
          const userSettings = await getUserSettings(result.account.user.id, req);
          res.json({
            status: "success",
            token: req.session.api.access.access_token,
            guilds: result.account.guilds,
            user: userSettings.data,
          });
        })
        .catch((err) => {
          res.json({
            status: "error",
            token: req.session.api.access.access_token,
            message: `GuildsAPI: FetchAccountError: ${err}`,
            code: 11,
          });
        });
    } catch (err) {
      res.json({
        status: "error",
        token: req.session.api.access.access_token,
        message: `GuildsAPI: ${err}`,
        code: 12,
      });
    }
  });

  router.post("/auth-api/guild-config", async (req, res, next) => {
    try {
      fetchAccount(req.session.api.access, {
        client: client,
        guilds: true,
      })
        .then(async (result: any) => {
          if (!req.body.id) throw new Error("Server configuration not found");
          const guildConfig = await GuildConfig.fetch(req.body._id);
          const guild = result.account.guilds.find((g) => g.id == req.body.id);
          if (!guild) throw new Error("Guild not found");
          if (!guild.isAdmin) throw new Error("You don't have permission to do that");
          for (const property in guildConfig) {
            if (property === "_id") continue;
            if (req.body[property]) guildConfig[property] = req.body[property];
          }
          const saveResult = await guildConfig.save();

          const langs = req.app.locals.langs;
          const selectedLang = guildConfig.lang;
          const lang = merge(cloneDeep(langs.find((lang: any) => lang.code === "en")), cloneDeep(langs.find((lang: any) => lang.code === selectedLang)));

          res.json({
            status: saveResult.upsertedCount > 0 ? "success" : "error",
            token: req.session.api.access.access_token,
            guildConfig: guildConfig.data,
            lang: lang,
          });
        })
        .catch((err) => {
          res.json({
            status: "error",
            token: req.session.api.access.access_token,
            message: err.message || err,
            code: 13,
          });
        });
    } catch (err) {
      res.json({
        status: "error",
        token: req.session.api.access.access_token,
        message: `SaveGuildConfigError: ${err.message || err}`,
        code: 14,
      });
    }
  });

  router.get("/api/game", async (req, res, next) => {
    try {
      let game: Game;
      let server: string = req.query.s;
      if (req.query.g) {
        game = await Game.fetch(req.query.g);
        if (game) {
          server = game.s;
          await game.updateReservedList();
        } else {
          throw new Error("Game not found");
        }
      }

      if (server) {
        let guild: Guild = client.guilds.cache.get(server);
        if (!guild) guild = client.guilds.resolve(server);

        if (guild) {
          let password: string;

          const guildConfig = await GuildConfig.fetch(guild.id);
          const guildMembers = await guild.members.fetch();

          const textChannels = <TextChannel[]>guild.channels.cache.array().filter((c) => c instanceof TextChannel);
          const channels = guildConfig.channels.filter((c) => guild.channels.cache.array().find((gc) => gc.id == c)).map((c) => guild.channels.cache.get(c));
          if (channels.length === 0 && textChannels.length > 0) channels.push(textChannels[0]);

          if (channels.length === 0) {
            throw new Error("Discord channel not found. Make sure your server has a text channel.");
          }

          let data: any = {
            title: req.query.g ? req.app.locals.lang.buttons.EDIT_GAME : req.app.locals.lang.buttons.NEW_GAME,
            guild: guild.name,
            channels: channels,
            s: server,
            c: channels[0].id,
            dm: "",
            adventure: "",
            runtime: "",
            where: "",
            reserved: "",
            description: "",
            minPlayers: 1,
            players: 7,
            method: GameMethod.AUTOMATED,
            customSignup: "",
            when: GameWhen.DATETIME,
            date: req.query.date || "",
            time: req.query.time || "",
            timezone: "",
            reminder: "0",
            hideDate: false,
            gameImage: "",
            frequency: "0",
            monthlyType: MonthlyType.WEEKDAY,
            weekdays: [false, false, false, false, false, false, false],
            clearReservedOnRepeat: false,
            env: {
              REMINDERS: process.env.REMINDERS,
              RESCHEDULING: process.env.RESCHEDULING,
            },
            is: {
              newgame: !req.query.g ? true : false,
              editgame: req.query.g ? true : false,
              locked: password ? true : false,
            },
            password: password ? password : false,
            enums: {
              GameMethod: GameMethod,
              GameWhen: GameWhen,
              RescheduleMode: RescheduleMode,
              MonthlyType: MonthlyType,
            },
            guildConfig: guildConfig,
            errors: {
              other: null,
              minPlayers: game && (isNaN(parseInt(game.minPlayers || "1")) || parseInt(game.minPlayers || "1") > parseInt(game.players || "0")),
              maxPlayers: game && (isNaN(parseInt(game.players || "0")) || parseInt(game.minPlayers || "1") > parseInt(game.players || "0")),
              dm:
                game &&
                !guildMembers.array().find((mem) => {
                  return mem.user.tag === game.dm.trim().replace("@", "");
                }),
              reserved:
                game && Array.isArray(game.reserved)
                  ? game.reserved.filter((res) => {
                      if (res.tag.trim().length === 0) return false;
                      return !guildMembers.array().find((mem) => mem.user.tag === res.tag.trim() || mem.user.id === res.id);
                    })
                  : [],
            },
          };

          if (req.query.g) {
            data = { ...data, ...game, _guild: null, _channel: null };
          }

          res.json({
            status: "success",
            token: req.session.api && req.session.api.access.access_token,
            game: data,
          });
        } else {
          throw new Error("Discord server not found");
        }
      } else {
        throw new Error("Discord server not specified");
      }
    } catch (err) {
      res.json({
        status: "error",
        token: req.session.api && req.session.api.access.access_token,
        message: err.message || err,
        redirect: "/",
        code: 15,
      });
    }
  });

  router.post("/api/game", async (req, res, next) => {
    const token = req.session.api && req.session.api.access && req.session.api.access.access_token;

    try {
      const userId = (req.headers.authorization || "0").replace("Bearer ", "").trim();

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
        // req.body.reserved = req.body.reserved.replace(/@/g, "");

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
        let guild: Guild = client.guilds.cache.get(server);
        if (!guild) guild = client.guilds.resolve(server);

        if (guild) {
          let password: string;

          const guildConfig = await GuildConfig.fetch(guild.id);
          const guildMembers = await guild.members.fetch();
          const member = guildMembers.array().find((m) => m.id == userId);
          if (!member && token && req.query.s) throw new Error("You are not a member of this server");
          const isAdmin =
            member &&
            (member.hasPermission(Permissions.FLAGS.MANAGE_GUILD) ||
              member.roles.cache.find((r) => r.name.toLowerCase().trim() === (guildConfig.managerRole || "").toLowerCase().trim()));
          if (guildConfig && member && member.user.tag !== config.author) {
            password = guildConfig.password;
            // A role is required to post on the server
            if (guildConfig.role && !isAdmin) {
              // Ensure user is logged in
              try {
                await fetchAccount(token, { client: client });
              } catch (err) {
                return res.json({
                  status: "error",
                  token: token,
                  message: `You must be logged in to post a game to ${guild.name}.`,
                  code: 16,
                });
              }
              if (member) {
                // User does not have the require role
                if (!member.roles.cache.find((r) => r.name.toLowerCase().trim() === guildConfig.role.toLowerCase().trim())) {
                  throw new Error("You are either not logged in or are missing the role required for posting on this server.");
                }
              }
            }
          }

          const textChannels = <TextChannel[]>guild.channels.cache.array().filter((c) => c instanceof TextChannel);
          const channels = guildConfig.channels.filter((c) => guild.channels.cache.array().find((gc) => gc.id == c)).map((c) => guild.channels.cache.get(c));
          if (channels.length === 0 && textChannels.length > 0) channels.push(textChannels[0]);

          if (channels.length === 0) {
            throw new Error("Discord channel not found. Make sure your server has a text channel.");
          }

          let data: any = {
            title: req.query.g ? req.app.locals.lang.buttons.EDIT_GAME : req.app.locals.lang.buttons.NEW_GAME,
            guild: guild.name,
            channels: channels,
            s: server,
            c: channels[0].id,
            dm: "",
            adventure: "",
            runtime: "",
            where: "",
            reserved: "",
            description: "",
            minPlayers: 1,
            players: 7,
            method: GameMethod.AUTOMATED,
            customSignup: "",
            when: GameWhen.DATETIME,
            date: req.query.date || "",
            time: req.query.time || "",
            timezone: "",
            reminder: "0",
            hideDate: false,
            gameImage: "",
            frequency: "",
            monthlyType: MonthlyType.WEEKDAY,
            weekdays: [false, false, false, false, false, false, false],
            clearReservedOnRepeat: false,
            env: process.env,
            is: {
              newgame: !req.query.g ? true : false,
              editgame: req.query.g ? true : false,
              locked: password ? true : false,
            },
            password: password ? password : false,
            enums: {
              GameMethod: GameMethod,
              GameWhen: GameWhen,
              RescheduleMode: RescheduleMode,
              MonthlyType: MonthlyType,
            },
            guildConfig: guildConfig,
            errors: {
              other: null,
              minPlayers: game && (isNaN(parseInt(game.minPlayers || "1")) || parseInt(game.minPlayers || "1") > parseInt(game.players || "0")),
              maxPlayers: game && (isNaN(parseInt(game.players || "0")) || parseInt(game.minPlayers || "1") > parseInt(game.players || "0")),
              dm:
                game &&
                !guildMembers.array().find((mem) => {
                  return mem.user.tag === game.dm.trim().replace("@", "");
                }),
              reserved:
                game && Array.isArray(game.reserved)
                  ? game.reserved.filter((res) => {
                      if (res.tag.trim().length === 0) return false;
                      return !guildMembers.array().find((mem) => mem.user.tag === res.tag.trim() || mem.user.id === res.id);
                    })
                  : [],
            },
          };

          if (req.query.g) {
            data = { ...data, ...game };
          }

          if (req.method === "POST") {
            req.body.reserved = Game.updateReservedList(req.body.reserved, guildMembers.array());
            data = Object.assign(data, req.body);
          }

          if (req.method === "POST") {
            Object.entries(req.body).forEach(([key, value]) => {
              if (key === "_id") return;
              if (typeof game[key] !== "undefined") game[key] = value;
            });

            for (let i = 0; i < 7; i++) {
              game.weekdays[i] = req.body["weekday" + i] ? true : false; // have to manually re-set falses b/c form data isn't sent if the checkbox is not checked
            }
            data.weekdays = game.weekdays;

            game.hideDate = req.body["hideDate"] ? true : false;
            game.clearReservedOnRepeat = req.body["clearReservedOnRepeat"] ? true : false;

            game
              .save()
              .then((response) => {
                res.json({
                  status: response.modified ? "success" : "error",
                  token: token,
                  game: data,
                  _id: response.modified ? response._id : null,
                });
              })
              .catch((err) => {
                if (err.message.startsWith("DM")) {
                  data.errors.dm = err.message;
                } else {
                  data.errors.other = err.message;
                }
                res.json({
                  status: "error",
                  token: token,
                  game: data,
                  message: err.message,
                  code: 17,
                });
              });
          } else {
            res.json({
              status: "success",
              token: token,
              game: data,
              _id: data._id,
            });
          }
        } else {
          throw new Error("Discord server not found");
        }
      } else {
        throw new Error("Discord server not specified");
      }
    } catch (err) {
      res.json({
        status: "error",
        token: token,
        redirect: "/error",
        message: err.message || err,
      });
    }
  });

  router.get("/api/delete-game", async (req, res, next) => {
    try {
      if (req.query.g) {
        const game = await Game.fetch(req.query.g);
        if (!game) throw new Error("Game not found");
        game.delete({ sendWS: false }).then((response) => {
          res.json({
            status: "success",
          });
        });
      } else {
        throw new Error("Game not found");
      }
    } catch (err) {
      res.json({
        status: "error",
        message: err.message || err,
      });
      res.render("error", { message: "routes/game.ts:2:<br />" + err });
    }
  });

  router.post("/auth-api/rsvp", async (req, res, next) => {
    const token = req.session.api && req.session.api.access.access_token;
    try {
      if (req.body.g) {
        const game = await Game.fetch(req.body.g);
        if (game) await game.updateReservedList();
        if (game) {
          fetchAccount(req.session.api.access, {
            client: client,
          })
            .then(async (result: any) => {
              // const reserved = game.reserved.split(/\r?\n/);
              // if (reserved[0] == "") reserved.splice(0, 1);
              // if (reserved.find((t) => t === result.account.user.tag)) {
              //   reserved.splice(reserved.indexOf(result.account.user.tag), 1);
              // } else {
              //   reserved.push(result.account.user.tag);
              //   await game.dmCustomInstructions(result.account.user.tag);
              // }

              // game.reserved = reserved.join("\n");

              if (Array.isArray(game.reserved)) {
                const index = game.reserved.findIndex((r) => r.id === result.account.user.id || r.tag === result.account.user.tag);
                if (index >= 0) {
                  game.reserved.splice(index, 1);
                } else {
                  game.reserved.push({ id: result.account.user.id, tag: result.account.user.tag });
                }
              }

              await game.save();

              res.json({
                status: "success",
                token: token,
                gameId: game._id,
                reserved: game.reserved,
              });
            })
            .catch((err) => {
              res.json({
                status: "error",
                token: token,
                message: `UserAuthError (1)`,
                redirect: "/",
                code: 19,
              });
            });
        } else {
          throw new Error("Game not found (1)");
        }
      } else {
        throw new Error("Game not found (2)");
      }
    } catch (err) {
      res.json({
        status: "error",
        redirect: "/error",
        token: token,
        message: err.message || err,
        code: 20,
      });
    }
  });

  router.get("/api/site", async (req, res, next) => {
    res.json({
      settings: req.app.locals.settings,
    });
  });

  router.post("/auth-api/site", async (req, res, next) => {
    const token = req.session.api && req.session.api.access.access_token;
    try {
      if (Object.keys(req.body).length > 0) {
        const siteSettings = await SiteSettings.fetch(process.env.SITE);
        for (const setting in siteSettings.data) {
          if (req.body[setting] !== null && typeof req.body[setting] !== "undefined") {
            if (typeof siteSettings[setting] == "number") siteSettings[setting] = parseFloat(req.body[setting]);
            else if (typeof siteSettings[setting] == "boolean") siteSettings[setting] = req.body[setting] == "true";
            else siteSettings[setting] = req.body[setting];
          }
        }
        await siteSettings.save();

        io().emit("site", { action: "settings", ...siteSettings.data });

        res.json({
          status: "success",
          token: token,
        });
      } else {
        throw new Error("No settings specified");
      }
    } catch (err) {
      res.json({
        status: "error",
        token: token,
        message: err.message || err,
        code: 21,
      });
    }
  });

  router.post("/auth-api/guild-config", async (req, res, next) => {
    const token = req.session.api && req.session.api.access.access_token;
    try {
      fetchAccount(req.session.api.access, {
        client: client,
      })
        .then(async (result: any) => {
          if (Object.keys(req.body).length > 0) {
            const guild = result.account.guilds.find((g) => g.id === req.query.s);
            if (guild && guild.isAdmin) {
              const guildConfig = await GuildConfig.fetch(req.query.s);
              for (const item in guildConfig.data) {
                if (req.body[item] !== null && typeof req.body[item] !== "undefined") {
                  if (typeof guildConfig[item] == "number") guildConfig[item] = parseFloat(req.body[item]);
                  else if (typeof guildConfig[item] == "boolean") guildConfig[item] = req.body[item] == "true";
                  else guildConfig[item] = req.body[item];
                }
              }
              await guildConfig.save();

              io().emit("site", { action: "guild-config", config: guildConfig.data });

              res.json({
                status: "success",
                token: token,
              });
            } else {
              res.json({
                status: "error",
                token: token,
                message: "You are either not part of that guild or do not have administrative privileges",
                code: 22,
              });
            }
          } else {
            throw new Error("No settings specified");
          }
        })
        .catch((err) => {
          res.json({
            status: "error",
            token: token,
            message: `UserAuthError`,
            code: 20,
          });
        });
    } catch (err) {
      res.json({
        status: "error",
        token: token,
        message: err.message || err,
        code: 21,
      });
    }
  });

  router.get("/api/pledges", async (req, res, next) => {
    const pledges = await aux.patreonPledges();
    res.json({
      pledges:
        pledges.status === "success"
          ? pledges.data
              .filter((p) => p.reward.id === config.patreon.creditPledge)
              .map((p) => {
                return {
                  full_name: p.patron.attributes.full_name,
                  vanity: p.patron.attributes.vanity,
                  url: p.patron.attributes.url,
                  discord: p.patron.attributes.social_connections.discord,
                };
              })
          : [],
    });
  });

  return router;
};

enum GamesPages {
  upcoming = "upcoming",
  myGames = "my-games",
  calendar = "calendar",
  server = "server",
}

interface AccountOptions {
  client: Client;
  guilds?: Boolean;
  games?: Boolean;
  page?: GamesPages;
}

const fetchAccount = (token: any, options: AccountOptions) => {
  const client = options.client;

  return new Promise((resolve, reject) => {
    const requestData = {
      url: "https://discordapp.com/api/users/@me",
      method: "GET",
      headers: {
        authorization: `${token.token_type} ${token.access_token}`,
      },
    };

    request(requestData, async (error, response, body) => {
      try {
        // console.log(requestData, response.statusCode);
        if (!error && response.statusCode === 200) {
          const response = JSON.parse(body);
          const { username, discriminator, id, avatar } = response;
          const tag = `${username}#${discriminator}`;

          const account = {
            user: {
              ...response,
              ...{
                tag: tag,
                avatarURL: `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=128`,
              },
            },
            guilds: [],
          };

          if (options.guilds) {
            client.guilds.cache.forEach((guild) => {
              guild.members.cache.forEach((member) => {
                if (member.id === id) {
                  account.guilds.push({
                    id: guild.id,
                    name: guild.name,
                    icon: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`,
                    permission: false,
                    isAdmin: false,
                    member: member,
                    channels: guild.channels,
                    announcementChannels: [],
                    config: new GuildConfig({ guild: guild.id }),
                    games: [],
                  });
                }
              });

              account.guilds = account.guilds.filter((guild) => !guild.config.hidden || config.author == tag);
            });

            const guildConfigs = await GuildConfig.fetchAllBy({
              guild: {
                $in: account.guilds.reduce((i, g) => {
                  i.push(g.id);
                  return i;
                }, []),
              },
            });

            account.guilds = account.guilds.map((guild) => {
              const guildConfig = guildConfigs.find((gc) => gc.guild === guild.id) || new GuildConfig({ guild: guild.id });
              const member: GuildMember = guild.member;

              const textChannels = <TextChannel[]>guild.channels.cache.array().filter((c) => c instanceof TextChannel);
              const channels = guildConfig.channels.filter((c) => guild.channels.cache.array().find((gc) => gc.id == c)).map((c) => guild.channels.cache.get(c));
              if (channels.length === 0 && textChannels.length > 0) channels.push(textChannels[0]);
              guild.announcementChannels = channels;

              guild.permission = guildConfig.role ? !!member.roles.cache.find((r) => r.name.toLowerCase().trim() === (guildConfig.role || "").toLowerCase().trim()) : true;
              guild.isAdmin =
                member.hasPermission(Permissions.FLAGS.MANAGE_GUILD) ||
                member.roles.cache.find((r) => r.name.toLowerCase().trim() === (guildConfig.managerRole || "").toLowerCase().trim());
              guild.config = guildConfig;
              return guild;
            });

            if (options.page === GamesPages.server) {
              account.guilds = account.guilds.filter((g) => account.guilds.find((s) => s.id === g.id && (s.isAdmin || config.author == tag)));
            }

            if (options.games) {
              const gameOptions: any = {
                s: {
                  $in: account.guilds.reduce((i, g) => {
                    i.push(g.id);
                    return i;
                  }, []),
                },
              };

              if (options.page === GamesPages.myGames) {
                gameOptions.$or = [
                  {
                    dm: tag,
                  },
                  {
                    reserved: {
                      $regex: tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"),
                    },
                  },
                ];
              }

              if (options.page === GamesPages.upcoming) {
                gameOptions.timestamp = {
                  $gt: new Date().getTime(),
                };
                if (tag !== config.author) {
                  gameOptions.dm = {
                    $ne: tag,
                  };
                }
              }

              const games: any[] = await Game.fetchAllBy(gameOptions);
              games.forEach(async (game) => {
                if (!game.discordGuild) return;
                await game.updateReservedList();

                const date = Game.ISOGameDate(game);
                game.moment = {
                  raw: `${game.date} ${game.time} UTC${game.timezone < 0 ? "-" : "+"}${Math.abs(game.timezone)}`,
                  isoutc: `${new Date(`${game.date} ${game.time} UTC${game.timezone < 0 ? "-" : "+"}${Math.abs(game.timezone)}`)
                    .toISOString()
                    .replace(/[^0-9T]/gi, "")
                    .slice(0, 13)}00Z`,
                  iso: date,
                  date: moment(date).utcOffset(parseInt(game.timezone)).format(config.formats.dateLong),
                  calendar: moment(date).utcOffset(parseInt(game.timezone)).calendar(),
                  from: moment(date).utcOffset(parseInt(game.timezone)).fromNow(),
                };

                game.slot = (Array.isArray(game.reserved) ? game.reserved : game.reserved.split(/\r?\n/g)).findIndex((t) => t.tag.replace("@", "") === tag || t.id === id) + 1;
                game.signedup = game.slot > 0 && game.slot <= parseInt(game.players);
                game.waitlisted = game.slot > parseInt(game.players);

                const gi = account.guilds.findIndex((g) => g.id === game.s);
                account.guilds[gi].games.push(game);
              });
            }

            account.guilds = account.guilds.map((guild) => {
              guild.games.sort((a, b) => {
                return a.timestamp < b.timestamp ? -1 : 1;
              });
              return guild;
            });

            if (options.page === GamesPages.upcoming || options.page === GamesPages.myGames) {
              account.guilds.sort((a, b) => {
                if (a.games.length === 0 && b.games.length === 0) return a.name < b.name ? -1 : 1;
                if (a.games.length === 0) return 1;
                if (b.games.length === 0) return -1;

                return a.games[0].timestamp < b.games[0].timestamp ? -1 : 1;
              });
            }
          }

          return resolve({
            status: "success",
            account: account,
          });
        }
        throw new Error(`OAuth: ${error}`);
      } catch (err) {
        refreshToken(token)
          .then((newToken) => {
            if ((err.message || err).indexOf("OAuth") < 0) reject(err);
            else resolve(fetchAccount(newToken, options));
          })
          .catch((err) => {
            reject(err);
          });
      }
    });
  });
};

const refreshToken = (access: any) => {
  return new Promise(async (resolve, reject) => {
    // const storedSession = await Session.fetch(req.session.bearer);
    const storedSession = await Session.fetch(access.access_token);
    if (access.token_type) {
      // Refresh token
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
      };

      const requestData = {
        url: "https://discordapp.com/api/v6/oauth2/token",
        method: "POST",
        headers: headers,
        form: {
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: access.refresh_token,
          redirect_uri: `${process.env.HOST}/login`,
          scope: "identify guilds",
        },
      };

      request(requestData, async (error, response, body) => {
        if (error || response.statusCode !== 200) {
          reject({
            status: "error",
            code: 6,
            message: `Discord OAuth: ${response.statusCode}<br />${error}`,
            reauthenticate: true,
          });
          return;
        }

        const token = JSON.parse(body);

        aux.log(access.access_token, token.access_token);

        if (storedSession && storedSession.token != token.access_token) {
          await storedSession.delete();

          const d = new Date();
          d.setDate(d.getDate() + 14);
          const session = new Session({
            expires: d,
            token: token.access_token,
            session: {
              api: {
                lastRefreshed: moment().unix(),
                access: {
                  access_token: token.access_token,
                  refresh_token: token.refresh_token,
                  expires_in: token.expires_in,
                  scope: token.scope,
                  token_type: token.token_type,
                },
              },
            },
          });

          await session.save();
        }

        // delete req.session.redirect;
        resolve(token);
      });
    } else {
      reject({
        status: "error",
        token: access.access_token,
        message: "Missing or invalid session token",
        reauthenticate: true,
        code: 7,
      });
    }
  });
};

const getUserSettings = async (id: string, req: any) => {
  const userSettings = await User.fetch(id);
  let updated = false;

  if (req.app.locals.lang) {
    if (userSettings.lang != req.app.locals.lang.code) {
      userSettings.lang = req.app.locals.lang.code;
      updated = true;
    }
  }

  if (updated) await userSettings.save();

  return userSettings;
};
