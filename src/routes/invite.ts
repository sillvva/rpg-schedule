import express from "express";

import config from "../models/config";

export default () => {
    const router = express.Router();

    router.use(config.urls.invite.url, (req, res, next) => {
        res.redirect(process.env.INVITE);
    });

    return router;
};
