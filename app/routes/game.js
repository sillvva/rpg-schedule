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
var discord_js_1 = __importDefault(require("discord.js"));
var game_1 = require("../models/game");
var guild_config_1 = require("../models/guild-config");
var config_1 = __importDefault(require("../models/config"));
exports.default = (function (options) {
    var router = express_1.default.Router();
    var client = options.client;
    router.use(config_1.default.urls.game.games.url, function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            res.render("games", req.account);
            return [2 /*return*/];
        });
    }); });
    router.use(config_1.default.urls.game.dashboard.url, function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            res.render("games", req.account);
            return [2 /*return*/];
        });
    }); });
    router.use(config_1.default.urls.game.create.url, function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
        var game, server, guild, channelId_1, password, guildConfig_1, member, textChannels, channel, data_1, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    game = void 0;
                    server = req.query.s;
                    if (!req.query.g) return [3 /*break*/, 2];
                    return [4 /*yield*/, game_1.Game.fetch(req.query.g)];
                case 1:
                    game = _a.sent();
                    if (game) {
                        server = game.s;
                    }
                    else {
                        throw new Error("Game not found");
                    }
                    _a.label = 2;
                case 2:
                    if (!server) return [3 /*break*/, 6];
                    guild = client.guilds.get(server);
                    if (!guild) return [3 /*break*/, 4];
                    password = void 0;
                    return [4 /*yield*/, guild_config_1.GuildConfig.fetch(guild.id)];
                case 3:
                    guildConfig_1 = _a.sent();
                    if (guildConfig_1) {
                        password = guildConfig_1.password;
                        if (guildConfig_1.role) {
                            if (!req.account) {
                                res.redirect(config_1.default.urls.login.url);
                                return [2 /*return*/];
                            }
                            else {
                                member = guild.members.find(function (m) { return m.id === req.account.user.id; });
                                if (member) {
                                    if (!member.roles.find(function (r) { return r.name.toLowerCase().trim() === guildConfig_1.role.toLowerCase().trim(); })) {
                                        res.redirect(config_1.default.urls.game.dashboard.url);
                                        return [2 /*return*/];
                                    }
                                }
                                else {
                                    res.redirect(config_1.default.urls.game.dashboard.url);
                                    return [2 /*return*/];
                                }
                            }
                        }
                    }
                    if (req.query.g) {
                        channelId_1 = game.c;
                    }
                    else {
                        if (guildConfig_1)
                            channelId_1 = guildConfig_1.channel;
                    }
                    textChannels = guild.channels.array().filter(function (c) { return c instanceof discord_js_1.default.TextChannel; });
                    channel = textChannels.find(function (c) { return c.id === channelId_1; }) || textChannels[0];
                    if (!channel) {
                        throw new Error("Discord channel not found");
                    }
                    data_1 = {
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
                        data_1 = __assign({}, data_1, game);
                    }
                    if (req.method === "POST") {
                        data_1.dm = req.body.dm;
                        data_1.adventure = req.body.adventure;
                        data_1.runtime = req.body.runtime;
                        data_1.where = req.body.where;
                        data_1.description = req.body.description;
                        data_1.reserved = req.body.reserved.replace(/@/g, '');
                        data_1.method = req.body.method;
                        data_1.customSignup = req.body.customSignup;
                        data_1.when = req.body.when;
                        data_1.date = req.body.date;
                        data_1.time = req.body.time;
                        data_1.timezone = req.body.timezone;
                        data_1.reminder = req.body.reminder;
                        data_1.players = req.body.players;
                    }
                    if (req.method === "POST") {
                        game_1.Game.save(channel, __assign({}, game, req.body))
                            .then(function (response) {
                            if (response.modified)
                                res.redirect(config_1.default.urls.game.create.url + "?g=" + response._id);
                            else
                                res.render("game", data_1);
                        })
                            .catch(function (err) {
                            data_1.errors.dm = err.message.startsWith("DM") ? err.message : false;
                            res.render("game", data_1);
                        });
                    }
                    else {
                        res.render("game", data_1);
                    }
                    return [3 /*break*/, 5];
                case 4: throw new Error("Discord server not found");
                case 5: return [3 /*break*/, 7];
                case 6: throw new Error("Discord server not specified");
                case 7: return [3 /*break*/, 9];
                case 8:
                    err_1 = _a.sent();
                    res.render("error", { message: err_1 });
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    }); });
    router.use(config_1.default.urls.game.rsvp.url, function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
        var game_2, guild, channel, reserved, result, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    if (!req.query.g) return [3 /*break*/, 3];
                    return [4 /*yield*/, game_1.Game.fetch(req.query.g)];
                case 1:
                    game_2 = _a.sent();
                    if (!game_2) return [3 /*break*/, 3];
                    guild = req.account.guilds.find(function (s) { return s.id === game_2.s; });
                    if (!guild) return [3 /*break*/, 3];
                    channel = guild.channels.find(function (c) { return c.id === game_2.c && c instanceof discord_js_1.default.TextChannel; });
                    if (!channel) return [3 /*break*/, 3];
                    reserved = game_2.reserved.split(/\r?\n/);
                    if (reserved.find(function (t) { return t === req.account.user.tag; })) {
                        reserved.splice(reserved.indexOf(req.account.user.tag), 1);
                    }
                    else {
                        reserved.push(req.account.user.tag);
                    }
                    game_2.reserved = reserved.join("\n");
                    return [4 /*yield*/, game_1.Game.save(channel, game_2)];
                case 2:
                    result = _a.sent();
                    _a.label = 3;
                case 3: return [3 /*break*/, 5];
                case 4:
                    err_2 = _a.sent();
                    console.log(err_2);
                    return [3 /*break*/, 5];
                case 5:
                    res.redirect(req.headers.referer ? req.headers.referer : config_1.default.urls.game.games.url);
                    return [2 /*return*/];
            }
        });
    }); });
    router.get(config_1.default.urls.game.delete.url, function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
        var game, serverId_1, channelId, guild, channel, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    if (!req.query.g) return [3 /*break*/, 2];
                    return [4 /*yield*/, game_1.Game.fetch(req.query.g)];
                case 1:
                    game = _a.sent();
                    if (!game)
                        throw new Error("Game not found");
                    serverId_1 = game.s;
                    channelId = game.c;
                    guild = client.guilds.get(serverId_1);
                    if (guild) {
                        channel = guild.channels.get(channelId);
                        game_1.Game.delete(game, channel, { sendWS: false }).then(function (response) {
                            if (req.account) {
                                res.redirect(config_1.default.urls.game.dashboard.url);
                            }
                            else {
                                res.redirect(config_1.default.urls.game.create.url + "?s=" + serverId_1);
                            }
                        });
                    }
                    else {
                        throw new Error("Server not found");
                    }
                    return [3 /*break*/, 3];
                case 2: throw new Error("Game not found");
                case 3: return [3 /*break*/, 5];
                case 4:
                    err_3 = _a.sent();
                    res.render("error", { message: err_3 });
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    router.get(config_1.default.urls.game.password.url, function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
        var guildConfig, result, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, guild_config_1.GuildConfig.fetch(req.query.s)];
                case 1:
                    guildConfig = _a.sent();
                    if (guildConfig) {
                        result = guildConfig.password === req.query.p;
                        req.session.status = __assign({}, config_1.default.defaults.sessionStatus, req.session.status);
                        if (result) {
                            req.session.status.loggedInTo.push(req.query.s);
                        }
                        else {
                            req.session.status.loggedInTo = req.session.status.loggedInTo.filter(function (s) { return s !== req.query.s; });
                        }
                        res.status(200).json({ result: result });
                    }
                    else {
                        throw new Error("Server not found");
                    }
                    return [3 /*break*/, 3];
                case 2:
                    err_4 = _a.sent();
                    res.render("error", { message: err_4 });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    router.get(config_1.default.urls.game.auth.url, function (req, res, next) {
        if (!req.session.status) {
            req.session.status = config_1.default.defaults.sessionStatus;
        }
        else {
            req.session.status = __assign({}, config_1.default.defaults.sessionStatus, req.session.status);
        }
        res.status(200).json({ status: req.session.status });
    });
    return router;
});
