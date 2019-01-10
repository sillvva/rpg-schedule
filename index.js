const http = require('http');
const bodyParser = require('body-parser');
const express = require('express');

const { db } = require('./db');
const discord = require('./discord');

const gameRoutes = require('./routes/game');

const app = express();

// Create the Discord processes and then call a
// callback function when the bot has logged in.
// Return the client to pass to the app routing logic.
const client = discord.processes(()  => {
    // Start the http server
    const server = http.createServer(app);
    server.listen(process.env.PORT || 5000);
    
    // Create the database connection
    db.connect().then(connected => {
        if (connected) {
            console.log('Connected!');
            
            discord.refreshMessages(client.guilds);
        } else {
            console.log('Not connected!');
        }
    });
    
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

/**
 * POST body parser
 */
app.use(bodyParser.urlencoded());

/**
 * Routes
 */
app.use(gameRoutes({ client: client }));

app.use('/', (req, res, next) => {
    res.render('invite', { invite: process.env.INVITE });
});

// Login the Discord bot
discord.login(client);