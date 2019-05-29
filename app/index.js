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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var http_1 = __importDefault(require("http"));
var body_parser_1 = __importDefault(require("body-parser"));
var express_1 = __importDefault(require("express"));
var path_1 = __importDefault(require("path"));
var express_session_1 = __importDefault(require("express-session"));
var connect_mongodb_session_1 = __importDefault(require("connect-mongodb-session"));
var db_1 = __importDefault(require("./db"));
var discord_1 = __importDefault(require("./processes/discord"));
var socket_1 = require("./processes/socket");
var init_1 = __importDefault(require("./routes/init"));
var game_1 = __importDefault(require("./routes/game"));
var invite_1 = __importDefault(require("./routes/invite"));
var timezone_1 = __importDefault(require("./routes/timezone"));
var login_1 = __importDefault(require("./routes/login"));
var redirects_1 = __importDefault(require("./routes/redirects"));
var app = express_1.default();
app.use(body_parser_1.default.urlencoded());
app.use(express_1.default.static(path_1.default.join(__dirname, '..', "public")));
app.set("view engine", "ejs");
app.set("views", "views");
var MongoDBStore = connect_mongodb_session_1.default(express_session_1.default);
var store = new MongoDBStore({
    uri: process.env.MONGODB_URL,
    collection: "sessions",
    expires: 1000 * 60 * 60 * 6
});
app.use(express_session_1.default({
    secret: process.env.TOKEN,
    resave: false,
    saveUninitialized: false,
    store: store
}));
var client = discord_1.default.processes(function () { return __awaiter(_this, void 0, void 0, function () {
    var connected, server, io;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4, db_1.default.database.connect()];
            case 1:
                connected = _a.sent();
                if (connected) {
                    console.log("Database connected!");
                    server = http_1.default.createServer(app).listen(process.env.PORT || 5000);
                    io = socket_1.socket(server);
                    if (!process.env.DO_NOT_REFRESH) {
                        discord_1.default.refreshMessages();
                        discord_1.default.pruneOldGames();
                        setInterval(function () {
                            discord_1.default.pruneOldGames();
                        }, 24 * 3600 * 1000);
                        setInterval(function () {
                            discord_1.default.postReminders();
                        }, 60 * 1000);
                    }
                    if (!process.env.SLEEP) {
                        setInterval(function () {
                            http_1.default.get(process.env.HOST.replace("https", "http"));
                        }, 5 * 60 * 1000);
                    }
                }
                else {
                    console.log("Database not connected!");
                }
                return [2];
        }
    });
}); });
app.use(login_1.default());
app.use(init_1.default({ client: client }));
app.use(game_1.default({ client: client }));
app.use(invite_1.default());
app.use(timezone_1.default());
app.use(redirects_1.default());
app.use("/", function (req, res, next) {
    res.render("home");
});
discord_1.default.login(client);
