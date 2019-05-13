const http = require('http');
const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);

const { db } = require('./db');
const discord = require('./processes/discord');
const ws = require('./processes/socket');

const gameRoutes = require('./routes/game');
const inviteRoute = require('./routes/invite');

const app = express();
const store = new MongoDBStore({
    uri: process.env.MONGODB_URL,
    collection: 'sessions',
    expires: 1000 * 60 * 60 * 24 // 1 day
});

// Initialize the Discord event handlers and then call a
// callback function when the bot has logged in.
// Return the client to pass to the app routing logic.
const client = discord.processes(async ()  => {
    // Create the database connection
    let connected = await db.connect();
    if (connected) {
        console.log('Database connected!');
        
        // Start the http server
        const server = http.createServer(app).listen(process.env.PORT || 5000);
        const io = ws.init(server);
        
        discord.refreshMessages(client.guilds);

        // Once per day, prune games from the database that are more than 24 hours old
        discord.pruneOldGames(client);
        setInterval(() => {
            discord.pruneOldGames(client);
        }, 24 * 3600 * 1000); // 24 hours

        // Post Game Reminders
        discord.postReminders(client);
        setInterval(() => {
            discord.postReminders(client);
        }, 60 * 1000); // 1 minute

        // Stay awake...
        if (!process.env.SLEEP) {
            setInterval(() => {
                http.get(process.env.HOST.replace('https', 'http'));
            }, 5 * 60 * 1000); // 5 minutes
        }
    } else {
        console.log('Database not connected!');
    }
});

/**
 * EJS
 */
app.set('view engine', 'ejs');
app.set('views', 'views');

app.use(bodyParser.urlencoded());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.TOKEN,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true },
    store: store
}));

/**
 * Routes
 */
app.use(gameRoutes({ client: client }));
app.use(inviteRoute());
app.use('/', (req, res, next) => {
    res.render('invite');
});

// Login the Discord bot
discord.login(client);