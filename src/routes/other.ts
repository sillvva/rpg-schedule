import express from "express";

import config from "../models/config";

export default () => {
  const router = express.Router();

  router.use(config.urls.invite.path, (req, res, next) => {
    res.redirect(`https://discordapp.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&&scope=bot&permissions=92224`);
  });

  router.use(config.urls.donate.path, (req, res, next) => {
    res.redirect(process.env.DONATE);
  })

  router.use(config.urls.github.path, (req, res, next) => {
    res.redirect(process.env.GITHUB);
  })

  return router;
};
