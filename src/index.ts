import http from "http";
import bodyParser from "body-parser";
import express from "express";
import path from "path";
import session from "express-session";
import connect from "connect-mongodb-session";

import db from "./db";
import discord from "./processes/discord";
import { socket } from "./processes/socket";

import initRoutes from "./routes/init";
import gameRoutes from "./routes/game";
import inviteRoute from "./routes/invite";
import timezoneRoutes from "./routes/timezone";
import loginRoutes from "./routes/login";
import redirectRoutes from "./routes/redirects";

const app = express();

app.use(bodyParser.urlencoded());
app.use(express.static(path.join(__dirname, '..', "public")));

/**
 * EJS
 */
app.set("view engine", "ejs");
app.set("views", "views");

/**
 * Session
 */
const MongoDBStore = connect(session);
const store = new MongoDBStore({
    uri: process.env.MONGODB_URL,
    collection: "sessions",
    expires: 1000 * 60 * 60 * 6 // 6 hours
});
app.use(
    session({
        secret: process.env.TOKEN,
        resave: false,
        saveUninitialized: false,
        store: store
    })
);

// Initialize the Discord event handlers and then call a
// callback function when the bot has logged in.
// Return the client to pass to the app routing logic.
const client = discord.processes(async () => {
    // Create the database connection
    let connected = await db.database.connect();
    if (connected) {
        console.log("Database connected!");

        // Start the http server
        const server = http.createServer(app).listen(process.env.PORT || 5000);
        const io = socket(server);

        if (!process.env.DO_NOT_REFRESH) {
            discord.refreshMessages();

            // Once per day, prune games from the database that are more than 24 hours old
            discord.pruneOldGames();
            setInterval(() => {
                discord.pruneOldGames();
            }, 24 * 3600 * 1000); // 24 hours

            // Post Game Reminders
            setInterval(() => {
                discord.postReminders();
            }, 60 * 1000); // 1 minute
        }

        // Stay awake...
        if (!process.env.SLEEP) {
            setInterval(() => {
                http.get(process.env.HOST.replace("https", "http"));
            }, 5 * 60 * 1000); // 5 minutes
        }
    } else {
        console.log("Database not connected!");
    }
});

/**
 * Routes
 */
app.use(loginRoutes());
app.use(initRoutes({ client: client }));
app.use(gameRoutes({ client: client }));
app.use(inviteRoute());
app.use(timezoneRoutes());
app.use(redirectRoutes());
app.use("/", (req, res, next) => {
    res.render("home");
});

// Login the Discord bot
discord.login(client);
