const http = require('http');
const bodyParser = require('body-parser');
const express = require('express');

const db = require('./db');
const gameRoutes = require('./routes/game');
const discord = require('./discord');

const app = express();
const client = discord.processes(app, db, ()  => {
    const server = http.createServer(app);
    server.listen(process.env.PORT || 5000);

    db.connect().then(connected => {
        if (connected) {
            console.log('Connected!');
        } else {
            console.log('Not connected!');
        }
    });
    
    setTimeout(() => {
        http.get(process.env.HOST.replace('https', 'http'));
    }, 10 * 60 * 1000); 
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

discord.login(client);