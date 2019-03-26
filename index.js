const http = require('http');
const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');

const { db } = require('./db');
const discord = require('./processes/discord');
const ws = require('./processes/socket');

const gameRoutes = require('./routes/game');

const app = express();

// Initialize the Discord event handlers and then call a
// callback function when the bot has logged in.
// Return the client to pass to the app routing logic.
const client = discord.processes(async ()  => {
    // Create the database connection
    let connected = await db.connect();
    if (connected) {
        console.log('DB Connected!');
        
        // Start the http server
        const server = http.createServer(app).listen(process.env.PORT || 5000);
        const io = ws.init(server);
        
        discord.refreshMessages(client.guilds);

        // Once per day, prune games from the database that are more than 24 hours old
        discord.pruneOldGames();
        setInterval(() => {
            discord.pruneOldGames();
        }, 24 * 3600 * 1000);
        setInterval(() => {
            discord.postReminders();
        }, 60 * 1000);
    } else {
        console.log('DB Not connected!');
    }
    
    // Stay awake...
    setInterval(() => {
        http.get(process.env.HOST.replace('https', 'http'));
    }, 5 * 60 * 1000);
});

/**
 * EJS
 */
app.set('view engine', 'ejs');
app.set('views', 'views');

app.use(bodyParser.urlencoded());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Routes
 */
app.use(gameRoutes({ client: client }));

app.use('/', (req, res, next) => {
    res.render('invite', { invite: process.env.INVITE });
});

// Login the Discord bot
discord.login(client);