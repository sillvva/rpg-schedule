import express from "express";
import request from "request";

import config from "../models/config";

export default () => {
  const router = express.Router();

  router.use(config.urls.login.path, (req, res, next) => {
    if (req.query.code) {
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded"
      };

      request(
        {
          url: "https://discordapp.com/api/v6/oauth2/token",
          method: "POST",
          headers: headers,
          form: {
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: "authorization_code",
            code: req.query.code,
            redirect_uri: process.env.HOST + config.urls.login.path,
            scope: "identify guilds"
          }
        },
        function(error, response, body) {
          if (error || response.statusCode !== 200) {
            console.log(error);
            res.render("error", { message: `Response: ${response.statusCode}<br />${error}` });
          }

          const token = JSON.parse(body);
          req.session.status = {
            ...config.defaults.sessionStatus,
            ...req.session.status
          };
          req.session.status.access = token;
          res.redirect(req.session.redirect || config.urls.game.games.path);
          delete req.session.redirect;
        }
      );
    } else if (req.query.error) {
      res.redirect("/");
    } else {
      delete req.session.redirect;
      if (req.query.redirect) {
        req.session.redirect = req.query.redirect;
      }
      res.redirect(process.env.AUTH_URL);
    }
  });

  router.use(config.urls.logout.path, (req, res, next) => {
    req.session.status = config.defaults.sessionStatus;
    res.redirect("/");
  });

  return router;
};
