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
Object.defineProperty(exports, "__esModule", { value: true });
var db_1 = __importDefault(require("../db"));
var mongodb_1 = require("mongodb");
var connection = db_1.default.connection;
var collection = "guildConfig";
var GuildConfig = (function () {
    function GuildConfig(guildConfig) {
        var _this = this;
        if (guildConfig === void 0) { guildConfig = {}; }
        this.guild = null;
        this.channel = [];
        this.pruning = false;
        this.embeds = true;
        this.password = "";
        this.role = null;
        this.hidden = false;
        if (!guildConfig._id)
            this._id = new mongodb_1.ObjectId();
        Object.entries(guildConfig).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            _this[key] = value;
        });
    }
    GuildConfig.prototype.save = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var config, col;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!connection())
                            throw new Error("No database connection");
                        if (!data.guild && !this.guild)
                            throw new Error("Guild ID not specified");
                        config = this.data;
                        col = connection().collection(collection);
                        return [4, col.updateOne({ _id: this._id }, { $set: __assign({}, config, data) }, { upsert: true })];
                    case 1: return [2, _a.sent()];
                }
            });
        });
    };
    Object.defineProperty(GuildConfig.prototype, "data", {
        get: function () {
            return {
                _id: this._id,
                guild: this.guild,
                channel: this.channel,
                pruning: this.pruning,
                embeds: this.embeds,
                password: this.password,
                role: this.role,
                hidden: this.hidden
            };
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GuildConfig.prototype, "channels", {
        get: function () {
            if (this.channel instanceof Array) {
                return this.channel;
            }
            else {
                return [this.channel];
            }
        },
        enumerable: true,
        configurable: true
    });
    GuildConfig.fetch = function (guildId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!connection())
                            throw new Error("No database connection");
                        return [4, connection().collection(collection).findOne({ guild: guildId })];
                    case 1:
                        data = _a.sent();
                        return [2, new GuildConfig(data || { guild: guildId })];
                }
            });
        });
    };
    GuildConfig.fetchAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var guildConfigs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!connection())
                            throw new Error("No database connection");
                        return [4, connection().collection(collection).find().toArray()];
                    case 1:
                        guildConfigs = _a.sent();
                        return [2, guildConfigs.map(function (gc) {
                                return new GuildConfig(gc);
                            })];
                }
            });
        });
    };
    return GuildConfig;
}());
exports.GuildConfig = GuildConfig;
;
