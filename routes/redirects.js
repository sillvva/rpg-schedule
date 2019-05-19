const express = require("express");

const config = require("../models/config");

module.exports = options => {
    const router = express.Router();
    const { client } = options;

    Object.values(config.urls.redirects).forEach(path => {
        router.use(path.url, async (req, res, next) => {
            const params = Object.entries(req.query).reduce((i, [key, value]) => {
                i.push(key+'='+escape(value));
                return i;
            }, []).join('&');
            res.redirect(path.redirect+(params.length > 0 ? '?'+params : ''));
        });
    });
};