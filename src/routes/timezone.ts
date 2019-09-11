import express from "express";

import config from "../models/config";

export default () => {
  const router = express.Router();

  router.use(config.urls.timezone.convert.url, (req, res, next) => {
    const url = `https://www.timeanddate.com/worldclock/converter.html?iso=${req.params.time}&p1=${req.params.tz}`;
    res.redirect(url);
  });

  router.use(config.urls.timezone.countdown.url, (req, res, next) => {
    const url = `https://www.timeanddate.com/countdown/generic?iso=${req.params.time}&p0=${req.params.tz}`;
    res.redirect(url);
  });

  return router;
};
