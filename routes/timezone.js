const express = require("express");

const config = require("../models/config");

module.exports = () => {
    const router = express.Router();

    router.use(config.urls.timezone.convert, (req, res, next) => {
        const url = `https://www.timeanddate.com/worldclock/converter.html?iso=${req.params.time}&p1=${req.params.tz}`;
        res.redirect(url);
    });

    router.use(config.urls.timezone.countdown, (req, res, next) => {
        const url = `https://www.timeanddate.com/countdown/generic?iso=${req.params.time}&p0=${req.params.tz}`;
        res.redirect(url);
    });

    return router;
};
