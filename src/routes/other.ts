import express from "express";

import config from "../models/config";

export default () => {
  const router = express.Router();

  router.use(config.urls.invite.path, (req, res, next) => {
    res.redirect(process.env.INVITE);
  });

  router.use(config.urls.donate.path, (req, res, next) => {
    res.redirect(process.env.DONATE);
  })

  return router;
};
