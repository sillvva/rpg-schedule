const http = require('http');
const bodyParser = require('body-parser');
const express = require('express');

const db = require('./db');
const gameRoutes = require('./routes/game');
const discordProcesses = require('./discord');

const app = express();
const client = discordProcesses(app, db, ()  => {
    const server = http.createServer(app);
    server.listen(process.env.PORT || 5000);

    db.connect().then(connected => {
        if (connected) {
            console.log('Connected!');
        } else {
            console.log('Not connected!');
        }
    });
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
    res.send(`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 2rem; font-family: sans-serif; position: fixed; top: 0; left: 0; right: 0; bottom: 0;">
            <h3>I'm the RPG Schedule Bot!</h3>
            <div><a href="${process.env.INVITE}">Invite Me</a></div>
        </div>
    `);
});

