"use strict";
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var discord_js_1 = __importStar(require("discord.js"));
var guild_config_1 = require("../models/guild-config");
var game_1 = require("../models/game");
var config_1 = __importDefault(require("../models/config"));
var client;
var discordProcesses = function (readyCallback) {
    client = new discord_js_1.default.Client();
    client.on("ready", function () {
        console.log("Logged in as " + client.user.username + "!");
        readyCallback();
    });
    client.on("message", function (message) { return __awaiter(_this, void 0, void 0, function () {
        var parts_1, cmd, guild_1, guildId, guildConfig, member, canConfigure, embed, channel, embed, channel, channels, channel, channels, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    if (!(message.content.startsWith(process.env.BOTCOMMAND_SCHEDULE) && message.channel instanceof discord_js_1.TextChannel)) return [3, 2];
                    parts_1 = message.content
                        .trim()
                        .split(" ")
                        .filter(function (part) { return part.length > 0; })
                        .slice(1);
                    cmd = parts_1.reverse().pop();
                    parts_1.reverse();
                    if (!message.channel.guild) {
                        message.reply("This command will only work in a server");
                        return [2];
                    }
                    guild_1 = message.channel.guild;
                    guildId = guild_1.id;
                    return [4, guild_config_1.GuildConfig.fetch(guildId)];
                case 1:
                    guildConfig = _a.sent();
                    member = message.channel.guild.members.array().find(function (m) { return m.user.id === message.author.id; });
                    canConfigure = member ? member.hasPermission(discord_js_1.default.Permissions.FLAGS.MANAGE_GUILD) : false;
                    if (cmd === "help" || message.content.trim().split(" ").length === 1) {
                        embed = new discord_js_1.default.RichEmbed()
                            .setTitle("RPG Schedule Help")
                            .setColor(0x2196f3)
                            .setDescription("__**Command List**__\n" +
                            ("`" + process.env.BOTCOMMAND_SCHEDULE + "` - Display this help window\n") +
                            ("`" + process.env.BOTCOMMAND_SCHEDULE + " help` - Display this help window\n") +
                            (canConfigure ? "\nConfiguration\n" +
                                (canConfigure ? "`" + process.env.BOTCOMMAND_SCHEDULE + " configuration` - Get the bot configuration\n" : "") +
                                (canConfigure ? "`" + process.env.BOTCOMMAND_SCHEDULE + " add-channel #channel-name` - Add a channel where games are posted\n" : "") +
                                (canConfigure ? "`" + process.env.BOTCOMMAND_SCHEDULE + " remove-channel #channel-name` - Remove a channel where games are posted\n" : "") +
                                (canConfigure ? "`" + process.env.BOTCOMMAND_SCHEDULE + " pruning " + (guildConfig.pruning ? 'on' : 'off') + "` - `on/off` - Automatically delete old announcements\n" : "") +
                                (canConfigure ? "`" + process.env.BOTCOMMAND_SCHEDULE + " embeds " + (guildConfig.embeds || guildConfig.embeds == null ? 'on' : 'off') + "` - `on/off` - Use discord embeds for announcements\n" : "") +
                                (canConfigure ? "`" + process.env.BOTCOMMAND_SCHEDULE + " role role name` - Assign a role as a prerequisite for posting games\n" : "") +
                                (canConfigure ? "`" + process.env.BOTCOMMAND_SCHEDULE + " password password` - Configure a password for posting games\n" : "") +
                                (canConfigure ? "`" + process.env.BOTCOMMAND_SCHEDULE + " password` - Remove the password\n" : "") : "") +
                            "\nUsage\n" +
                            ("`" + process.env.BOTCOMMAND_SCHEDULE + " link` - Retrieve link for posting games"));
                        message.channel.send(embed);
                    }
                    else if (cmd === "link") {
                        message.channel.send(process.env.HOST + config_1.default.urls.game.create.url + "?s=" + guildId);
                    }
                    else if (cmd === "configuration") {
                        if (canConfigure) {
                            channel = guildConfig.channels.map(function (c) {
                                return guild_1.channels.get(c);
                            }) || ([guild_1.channels.array().find(function (c) { return c instanceof discord_js_1.TextChannel; })]);
                            embed = new discord_js_1.default.RichEmbed()
                                .setTitle("RPG Schedule Configuration")
                                .setColor(0x2196f3)
                                .setDescription("Guild: `" + guild_1.name + "`\n" +
                                ("Channels: `" + channel.filter(function (c) { return c; }).map(function (c) { return c.name; }).join(' | ') + "`\n") +
                                ("Pruning: `" + (guildConfig.pruning ? "on" : "off") + "`\n") +
                                ("Embeds: `" + (!(guildConfig.embeds === false) ? "on" : "off") + "`\n") +
                                ("Password: " + (guildConfig.password ? "`" + guildConfig.password + "`" : "Disabled") + "\n") +
                                ("Role: " + (guildConfig.role ? "`" + guildConfig.role + "`" : "All Roles")));
                            message.author.send(embed);
                        }
                    }
                    else if (cmd === "add-channel") {
                        if (canConfigure) {
                            channel = parts_1[0].replace(/\<\#|\>/g, "");
                            channels = guildConfig.channels;
                            channels.push(channel);
                            guildConfig.save({
                                channel: channels
                            }).then(function (result) {
                                message.channel.send("Channel added! Make sure the bot has permissions in the designated channel.");
                            }).catch(function (err) {
                                console.log(err);
                            });
                        }
                    }
                    else if (cmd === "remove-channel") {
                        if (canConfigure) {
                            channel = parts_1[0].replace(/\<\#|\>/g, "");
                            channels = guildConfig.channels;
                            if (channels.indexOf(channel) >= 0) {
                                channels.splice(channels.indexOf(channel), 1);
                            }
                            guildConfig.save({
                                channel: channels
                            }).then(function (result) {
                                message.channel.send("Channel removed!");
                            }).catch(function (err) {
                                console.log(err);
                            });
                        }
                    }
                    else if (cmd === "pruning") {
                        if (canConfigure) {
                            guildConfig.save({
                                pruning: parts_1[0] === "on"
                            }).then(function (result) {
                                message.channel.send("Configuration updated! Pruning was turned " + (parts_1[0] === "on" ? "on" : "off"));
                            }).catch(function (err) {
                                console.log(err);
                            });
                        }
                    }
                    else if (cmd === "embeds") {
                        if (canConfigure) {
                            guildConfig.save({
                                embeds: !(parts_1[0] === "off")
                            }).then(function (result) {
                                message.channel.send("Configuration updated! Embeds were turned " + (!(parts_1[0] === "off") ? "on" : "off"));
                            }).catch(function (err) {
                                console.log(err);
                            });
                        }
                    }
                    else if (cmd === "password") {
                        if (canConfigure) {
                            guildConfig.save({
                                password: parts_1.join(" ")
                            }).then(function (result) {
                                message.channel.send("Password updated!");
                            }).catch(function (err) {
                                console.log(err);
                            });
                        }
                    }
                    else if (cmd === "role") {
                        if (canConfigure) {
                            guildConfig.save({
                                role: parts_1.join(" ")
                            }).then(function (result) {
                                message.channel.send("Role set to `" + parts_1.join(" ") + "`!");
                            }).catch(function (err) {
                                console.log(err);
                            });
                        }
                    }
                    _a.label = 2;
                case 2: return [3, 4];
                case 3:
                    err_1 = _a.sent();
                    console.log(err_1);
                    return [3, 4];
                case 4: return [2];
            }
        });
    }); });
    client.on("messageReactionAdd", function (reaction, user) { return __awaiter(_this, void 0, void 0, function () {
        var message, game;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    message = reaction.message;
                    return [4, game_1.Game.fetchBy("messageId", message.id)];
                case 1:
                    game = _a.sent();
                    if (game && user.id !== message.author.id) {
                        if (reaction.emoji.name === "➕") {
                            if (game.reserved.indexOf(user.tag) < 0) {
                                game.reserved = game.reserved.trim().split(/\r?\n/).concat([user.tag]).join("\n");
                                if (game.reserved.startsWith("\n"))
                                    game.reserved = game.reserved.substr(1);
                                game.save();
                            }
                        }
                        else if (reaction.emoji.name === "➖") {
                            if (game.reserved.indexOf(user.tag) >= 0) {
                                game.reserved = game.reserved
                                    .split(/\r?\n/)
                                    .filter(function (tag) { return tag !== user.tag; })
                                    .join("\n");
                                game.save();
                            }
                        }
                        reaction.remove(user);
                    }
                    return [2];
            }
        });
    }); });
    client.on("messageDelete", function (message) { return __awaiter(_this, void 0, void 0, function () {
        var game;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4, game_1.Game.fetchBy("messageId", message.id)];
                case 1:
                    game = _a.sent();
                    if (game && message.channel instanceof discord_js_1.TextChannel) {
                        game.delete().then(function (result) {
                            console.log("Game deleted");
                        });
                    }
                    return [2];
            }
        });
    }); });
    var events = {
        MESSAGE_REACTION_ADD: "messageReactionAdd",
        MESSAGE_REACTION_REMOVE: "messageReactionRemove"
    };
    client.on("raw", function (event) { return __awaiter(_this, void 0, void 0, function () {
        var data, user, channel, _a, message, emojiKey, reaction, emoji;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!events.hasOwnProperty(event.t))
                        return [2];
                    data = event.d;
                    user = client.users.get(data.user_id);
                    _a = client.channels.get(data.channel_id);
                    if (_a) return [3, 2];
                    return [4, user.createDM()];
                case 1:
                    _a = (_b.sent());
                    _b.label = 2;
                case 2:
                    channel = _a;
                    if (channel.messages.has(data.message_id))
                        return [2];
                    return [4, channel.fetchMessage(data.message_id)];
                case 3:
                    message = _b.sent();
                    emojiKey = data.emoji.id ? data.emoji.name + ":" + data.emoji.id : data.emoji.name;
                    reaction = message.reactions.get(emojiKey);
                    if (!reaction) {
                        emoji = new discord_js_1.default.Emoji(client.guilds.get(data.guild_id), data.emoji);
                        reaction = new discord_js_1.default.MessageReaction(message, emoji, 1, data.user_id === client.user.id);
                    }
                    client.emit(events[event.t], reaction, user);
                    return [2];
            }
        });
    }); });
    return client;
};
var discordLogin = function (client) {
    client.login(process.env.TOKEN);
};
var refreshMessages = function () { return __awaiter(_this, void 0, void 0, function () {
    var games;
    var _this = this;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4, game_1.Game.fetchAllBy({ when: "datetime", method: "automated", timestamp: { $gte: new Date().getTime() } })];
            case 1:
                games = _a.sent();
                games.forEach(function (game) { return __awaiter(_this, void 0, void 0, function () {
                    var message, err_2;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!game.discordGuild)
                                    return [2];
                                _a.label = 1;
                            case 1:
                                _a.trys.push([1, 3, , 4]);
                                return [4, game.discordChannel.fetchMessage(game.messageId)];
                            case 2:
                                message = _a.sent();
                                return [3, 4];
                            case 3:
                                err_2 = _a.sent();
                                return [3, 4];
                            case 4: return [2];
                        }
                    });
                }); });
                return [2];
        }
    });
}); };
var pruneOldGames = function () { return __awaiter(_this, void 0, void 0, function () {
    var result, query, games, guildConfigs, err_3;
    var _this = this;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Pruning old games");
                query = {
                    timestamp: {
                        $lt: new Date().getTime() - 48 * 3600 * 1000
                    }
                };
                return [4, game_1.Game.fetchAllBy(query)];
            case 1:
                games = _a.sent();
                return [4, guild_config_1.GuildConfig.fetchAll()];
            case 2:
                guildConfigs = _a.sent();
                games.forEach(function (game) { return __awaiter(_this, void 0, void 0, function () {
                    var guildConfig, message, reminder, err_4;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!game.discordGuild)
                                    return [2];
                                _a.label = 1;
                            case 1:
                                _a.trys.push([1, 5, , 6]);
                                guildConfig = guildConfigs.find(function (gc) { return gc.guild === game.s; });
                                if (!((guildConfig ? guildConfig.pruning : new guild_config_1.GuildConfig().pruning) && game.discordChannel)) return [3, 4];
                                return [4, game.discordChannel.fetchMessage(game.messageId)];
                            case 2:
                                message = _a.sent();
                                if (message)
                                    message.delete();
                                return [4, game.discordChannel.fetchMessage(game.reminderMessageId)];
                            case 3:
                                reminder = _a.sent();
                                if (reminder)
                                    reminder.delete();
                                _a.label = 4;
                            case 4: return [3, 6];
                            case 5:
                                err_4 = _a.sent();
                                return [3, 6];
                            case 6: return [2];
                        }
                    });
                }); });
                _a.label = 3;
            case 3:
                _a.trys.push([3, 5, , 6]);
                return [4, game_1.Game.deleteAllBy(query)];
            case 4:
                result = _a.sent();
                console.log(result.deletedCount + " old games successfully pruned");
                return [3, 6];
            case 5:
                err_3 = _a.sent();
                console.log(err_3);
                return [3, 6];
            case 6: return [2, result];
        }
    });
}); };
var postReminders = function () { return __awaiter(_this, void 0, void 0, function () {
    var games;
    var _this = this;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4, game_1.Game.fetchAllBy({ when: "datetime", reminder: { $in: ["15", "30", "60"] } })];
            case 1:
                games = _a.sent();
                games.forEach(function (game) { return __awaiter(_this, void 0, void 0, function () {
                    var reserved_1, member, dm, channels, message, sent;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (game.timestamp - parseInt(game.reminder) * 60 * 1000 > new Date().getTime())
                                    return [2];
                                if (!game.discordGuild)
                                    return [2];
                                if (!game.discordChannel) return [3, 2];
                                reserved_1 = [];
                                game.reserved.split(/\r?\n/).forEach(function (res) {
                                    if (res.trim().length === 0)
                                        return;
                                    var member = game.discordGuild.members.array().find(function (mem) { return mem.user.tag === res.trim().replace("@", ""); });
                                    var name = res.trim().replace("@", "");
                                    if (member)
                                        name = member.user.toString();
                                    if (reserved_1.length < parseInt(game.players)) {
                                        reserved_1.push(name);
                                    }
                                });
                                member = game.discordGuild.members.array().find(function (mem) { return mem.user.tag === game.dm.trim().replace("@", ""); });
                                dm = game.dm.trim().replace("@", "");
                                if (member)
                                    dm = member.user.toString();
                                if (!(reserved_1.length > 0)) return [3, 2];
                                channels = game.where.match(/#[a-z0-9\-_]+/gi);
                                if (channels) {
                                    channels.forEach(function (chan) {
                                        var guildChannel = game.discordGuild.channels.find(function (c) { return c.name === chan.replace(/#/, ""); });
                                        if (guildChannel) {
                                            game.where = game.where.replace(chan, guildChannel.toString());
                                        }
                                    });
                                }
                                message = "Reminder for **" + game.adventure + "**\n";
                                message += "**When:** Starting in " + game.reminder + " minutes\n";
                                message += "**Where:** " + game.where + "\n\n";
                                message += "**DM:** " + dm + "\n";
                                message += "**Players:**\n";
                                message += "" + reserved_1.join("\n");
                                return [4, game.discordChannel.send(message)];
                            case 1:
                                sent = (_a.sent());
                                game.reminder = "0";
                                game.reminderMessageId = sent.id;
                                game.save();
                                _a.label = 2;
                            case 2: return [2];
                        }
                    });
                }); });
                return [2];
        }
    });
}); };
exports.default = {
    processes: discordProcesses,
    login: discordLogin,
    refreshMessages: refreshMessages,
    pruneOldGames: pruneOldGames,
    postReminders: postReminders,
};
function discordClient() {
    return client;
}
exports.discordClient = discordClient;
