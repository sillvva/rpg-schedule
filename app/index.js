"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const body_parser_1 = __importDefault(require("body-parser"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const express_session_1 = __importDefault(require("express-session"));
const connect_mongodb_session_1 = __importDefault(require("connect-mongodb-session"));
const db_1 = __importDefault(require("./db"));
const discord_1 = __importDefault(require("./processes/discord"));
const socket_1 = __importDefault(require("./processes/socket"));
const init_1 = __importDefault(require("./routes/init"));
const game_1 = __importDefault(require("./routes/game"));
const invite_1 = __importDefault(require("./routes/invite"));
const timezone_1 = __importDefault(require("./routes/timezone"));
const login_1 = __importDefault(require("./routes/login"));
const redirects_1 = __importDefault(require("./routes/redirects"));
const app = express_1.default();
const MongoDBStore = connect_mongodb_session_1.default(express_session_1.default);
const store = new MongoDBStore({
    uri: process.env.MONGODB_URL,
    collection: "sessions",
    expires: 1000 * 60 * 60 * 6 // 6 hours
});
// Initialize the Discord event handlers and then call a
// callback function when the bot has logged in.
// Return the client to pass to the app routing logic.
const client = discord_1.default.processes(async () => {
    // Create the database connection
    let connected = await db_1.default.database.connect();
    if (connected) {
        console.log("Database connected!");
        // Start the http server
        const server = http_1.default.createServer(app).listen(process.env.PORT || 5000);
        const io = socket_1.default.init(server);
        if (!process.env.DO_NOT_REFRESH) {
            discord_1.default.refreshMessages(client.guilds);
            // Once per day, prune games from the database that are more than 24 hours old
            discord_1.default.pruneOldGames(client);
            setInterval(() => {
                discord_1.default.pruneOldGames(client);
            }, 24 * 3600 * 1000); // 24 hours
            // Post Game Reminders
            setInterval(() => {
                discord_1.default.postReminders(client);
            }, 60 * 1000); // 1 minute
        }
        // Stay awake...
        if (!process.env.SLEEP) {
            setInterval(() => {
                http_1.default.get(process.env.HOST.replace("https", "http"));
            }, 5 * 60 * 1000); // 5 minutes
        }
    }
    else {
        console.log("Database not connected!");
    }
});
/**
 * EJS
 */
app.set("view engine", "ejs");
app.set("views", "views");
app.use(body_parser_1.default.urlencoded());
app.use(express_1.default.static(path_1.default.join(__dirname, '..', "public")));
app.use(express_session_1.default({
    secret: process.env.TOKEN,
    resave: false,
    saveUninitialized: false,
    store: store
}));
/**
 * Routes
 */
app.use(login_1.default());
app.use(init_1.default({ client: client }));
app.use(game_1.default({ client: client }));
app.use(invite_1.default());
app.use(timezone_1.default());
app.use(redirects_1.default());
app.use("/", (req, res, next) => {
    res.render("home");
});
// Login the Discord bot
discord_1.default.login(client);
