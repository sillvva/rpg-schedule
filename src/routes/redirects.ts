import express from "express";

import config from "../models/config";

export default () => {
    const router = express.Router();

    Object.values(config.urls.redirects).forEach(path => {
        router.use(path.url, async (req, res, next) => {
            const params = Object.entries(req.query).reduce((i, [key, value]: [string, string]) => {
                i.push(key+'='+escape(value));
                return i;
            }, []).join('&');
            res.redirect(path.redirect+(params.length > 0 ? '?'+params : ''));
        });
    });

    return router;
};