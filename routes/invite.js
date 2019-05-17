const express = require("express");

const config = require("../models/config");

module.exports = () => {
    const router = express.Router();

    router.use(config.urls.invite, (req, res, next) => {
        res.redirect(process.env.INVITE);
    });

    return router;
};
