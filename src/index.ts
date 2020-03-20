import http from "http";
import bodyParser from "body-parser";
import express from "express";
import path from "path";
import session from "express-session";
import connect from "connect-mongodb-session";
import cookieParser from "cookie-parser";

import db from "./db";
import config from "./models/config";
import discord from "./processes/discord";
import { socket } from "./processes/socket";

import initRoutes from "./routes/init";
import gameRoutes from "./routes/game";
import otherRoutes from "./routes/other";
import timezoneRoutes from "./routes/timezone";
import loginRoutes from "./routes/login";
import redirectRoutes from "./routes/redirects";
import rssRoutes from "./routes/rss";

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(cookieParser());

/**
 * EJS
 */
app.set("view engine", "ejs");
app.set("views", "views");

if (process.env.MAINTENANCE == 'true') {
  const server = http.createServer(app).listen(process.env.PORT || 5000);
  console.log('App started!')

  app.use("/", (req: any, res, next) => {
    res.render("maintenance");
  });
}
else {
  app.locals.config = config;
  app.locals.host = process.env.HOST;
  app.locals.supportedLanguages = require("../lang/langs.json");
  app.locals.langs = app.locals.supportedLanguages.langs
    .map((lang: String) => {
      return {
        code: lang,
        ...require(`../lang/${lang}.json`)
      };
    })
    .sort((a: any, b: any) => (a.name > b.name ? 1 : -1));

  /**
   * Session
   */
  const MongoDBStore = connect(session);
  const store = new MongoDBStore({
    uri: process.env.MONGODB_URL,
    collection: "sessions" //,
    // expires: 12 * 60 * 60 * 1000 // 12 hours
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
  const client = discord.processes({
    app: app
  }, async () => {
    // Create the database connection
    let connected = await db.database.connect();
    if (connected) {
      console.log("Database connected!");

      // Start the http server
      const server = http.createServer(app).listen(process.env.PORT || 5000);
      const io = socket(server);
      console.log('App started!')

      // discord.fixReschedules();
      if (!process.env.LOCALENV) {
        discord.refreshMessages();

        // Once per hour, prune games from the database that are more than 48 hours old
        discord.pruneOldGames();
        setInterval(() => {
          discord.pruneOldGames();
        }, 60 * 60 * 1000); // 1 hour

        // Once per hour, reschedule recurring games from the database that have already occurred
        if (process.env.RESCHEDULING) {
          discord.rescheduleOldGames();
          setInterval(() => {
            discord.rescheduleOldGames();
          }, 60 * 60 * 1000); // 1 hour
        }

        // Post Game Reminders
        if (process.env.REMINDERS) {
          discord.postReminders(app);
          setInterval(() => {
            discord.postReminders(app);
          }, 1 * 60 * 1000); // 1 minute
        }
      }

      // Stay awake...
      // if (!process.env.SLEEP) {
      //   setInterval(() => {
      //     console.log("STAY AWAKE!");
      //     http.get(process.env.HOST.replace("https", "http"));
      //   }, 5 * 60 * 1000); // 5 minutes
      // }
    } else {
      console.log("Database not connected!");
    }
  });

  /**
   * Routes
   */
  app.use(rssRoutes({ client: client }));
  app.use(loginRoutes());
  app.use(initRoutes({ client: client }));
  app.use(gameRoutes({ client: client }));
  app.use(otherRoutes());
  app.use(timezoneRoutes());
  app.use(redirectRoutes());
  app.use("/", (req: any, res, next) => {
    res.render("home");
  });

  // Login the Discord bot
  discord.login(client);
}