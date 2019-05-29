"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var request_1 = __importDefault(require("request"));
var moment_1 = __importDefault(require("moment"));
var game_1 = require("../models/game");
var guild_config_1 = require("../models/guild-config");
var config_1 = __importDefault(require("../models/config"));
var appaux_1 = __importDefault(require("../appaux"));
var db_1 = __importDefault(require("../db"));
var parsedURLs = appaux_1.default.parseConfigURLs(config_1.default.urls);
var connection = db_1.default.connection;
exports.default = (function (options) {
    var router = express_1.default.Router();
    var client = options.client;
    router.use("/", function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
        var guildPermission, storedSession, access, e_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(req.originalUrl);
                    if (!parsedURLs.find(function (path) { return path.session && req._parsedOriginalUrl.pathname === path.url; })) {
                        next();
                        return [2];
                    }
                    guildPermission = parsedURLs.find(function (path) { return path.guildPermission && req._parsedOriginalUrl.pathname === path.url; }) ? true : false;
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
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4, connection()
                            .collection("sessions")
                            .findOne({ _id: req.session.id })];
                case 2:
                    storedSession = _a.sent();
                    if (storedSession) {
                        req.session.status = storedSession.session.status;
                    }
                    if (req.session.status) {
                        access = req.session.status.access;
                        if (access.token_type) {
                            request_1.default({
                                url: "https://discordapp.com/api/users/@me",
                                method: "GET",
                                headers: {
                                    authorization: access.token_type + " " + access.access_token
                                }
                            }, function (error, response, body) { return __awaiter(_this, void 0, void 0, function () {
                                var response_1, username, discriminator, id_1, avatar, tag_1, guildConfigs_1, gameOptions, games, err_1;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 4, , 5]);
                                            if (!(!error && response.statusCode === 200)) return [3, 3];
                                            response_1 = JSON.parse(body);
                                            username = response_1.username, discriminator = response_1.discriminator, id_1 = response_1.id, avatar = response_1.avatar;
                                            tag_1 = username + "#" + discriminator;
                                            return [4, guild_config_1.GuildConfig.fetchAll()];
                                        case 1:
                                            guildConfigs_1 = _a.sent();
                                            req.account.user = __assign({}, response_1, {
                                                tag: tag_1,
                                                avatarURL: "https://cdn.discordapp.com/avatars/" + id_1 + "/" + avatar + ".png?size=128"
                                            });
                                            client.guilds.forEach(function (guild) {
                                                var guildConfig = guildConfigs_1.find(function (gc) { return gc.guild === guild.id; }) || new guild_config_1.GuildConfig({ guild: guild.id });
                                                guild.members.forEach(function (member) {
                                                    if (member.id === id_1) {
                                                        req.account.guilds.push({
                                                            id: guild.id,
                                                            name: guild.name,
                                                            icon: guild.iconURL,
                                                            permission: guildConfig.role
                                                                ? member.roles.find(function (r) { return r.name.toLowerCase().trim() === guildConfig.role.toLowerCase().trim(); })
                                                                : true,
                                                            channels: guild.channels,
                                                            config: guildConfig,
                                                            games: []
                                                        });
                                                    }
                                                });
                                            });
                                            if (guildPermission) {
                                                req.account.guilds = req.account.guilds.filter(function (guild) { return !guild.config.hidden; });
                                            }
                                            gameOptions = {
                                                s: {
                                                    $in: req.account.guilds.reduce(function (i, g) {
                                                        i.push(g.id);
                                                        return i;
                                                    }, [])
                                                }
                                            };
                                            if (req.account.viewing.dashboard && tag_1 !== config_1.default.author) {
                                                gameOptions.$or = [
                                                    {
                                                        dm: tag_1
                                                    },
                                                    {
                                                        reserved: {
                                                            $regex: tag_1.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")
                                                        }
                                                    }
                                                ];
                                            }
                                            if (req.account.viewing.games) {
                                                gameOptions.timestamp = {
                                                    $gt: new Date().getTime()
                                                };
                                                gameOptions.dm = {
                                                    $ne: tag_1
                                                };
                                            }
                                            return [4, game_1.Game.fetchAllBy(gameOptions)];
                                        case 2:
                                            games = _a.sent();
                                            games.forEach(function (game) {
                                                if (!game.discordGuild)
                                                    return;
                                                var date = game_1.Game.ISOGameDate(game);
                                                game.moment = {
                                                    raw: game.date + " " + game.time + " GMT" + (game.timezone < 0 ? "-" : "+") + Math.abs(game.timezone),
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
                                                game.slot = game.reserved.split(/\r?\n/).findIndex(function (t) { return t.trim().replace("@", "") === tag_1; }) + 1;
                                                game.signedup = game.slot > 0 && game.slot <= parseInt(game.players);
                                                game.waitlisted = game.slot > parseInt(game.players);
                                                var gi = req.account.guilds.findIndex(function (g) { return g.id === game.s; });
                                                req.account.guilds[gi].games.push(game);
                                            });
                                            if (req.account.viewing.games) {
                                                req.account.guilds = req.account.guilds.filter(function (guild) { return guild.games.length > 0; });
                                            }
                                            req.account.guilds = req.account.guilds.map(function (guild) {
                                                guild.games.sort(function (a, b) {
                                                    return a.timestamp < b.timestamp ? -1 : 1;
                                                });
                                                return guild;
                                            });
                                            req.account.guilds.sort(function (a, b) {
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
                                                return [2];
                                            }
                                            next();
                                            return [2];
                                        case 3: throw new Error(error);
                                        case 4:
                                            err_1 = _a.sent();
                                            if (req.account.viewing.dashboard) {
                                                res.render("error", { message: err_1 });
                                            }
                                            else {
                                                next();
                                            }
                                            return [3, 5];
                                        case 5: return [2];
                                    }
                                });
                            }); });
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
                    return [3, 4];
                case 3:
                    e_1 = _a.sent();
                    res.render("error", { message: e_1.message });
                    return [3, 4];
                case 4: return [2];
            }
        });
    }); });
    return router;
});
