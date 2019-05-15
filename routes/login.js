const express = require('express');
const request = require('request');

const config = require('../models/config');

module.exports = () => {
    const router = express.Router();

    router.use(config.urls.login, (req, res, next) => {
        if (req.query.code) {
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded'
            };

            request({
                url: 'https://discordapp.com/api/v6/oauth2/token',
                method: 'POST',
                headers: headers,
                form: {
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code: req.query.code,
                    redirect_uri: process.env.HOST + config.urls.login,
                    scope: 'identify guilds',
                }
            }, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    const token = JSON.parse(body);
                    req.session.status = {
                        ...config.defaults.sessionStatus,
                        ...req.session.status
                    };
                    req.session.status.access = token;
                    res.redirect(config.urls.game.dashboard);
                    return;
                }
                res.render('error', {message: error});
            })
        } else if (req.query.error) {
            res.redirect('/');
        } else {
            res.redirect(process.env.AUTH_URL);
        }
    });

    router.use(config.urls.logout, (req, res, next) => {
        req.session.status = config.defaults.sessionStatus;
        res.redirect('/');
    });

    return router;
};