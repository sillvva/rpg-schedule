import express, { request } from "express";

import config from "../models/config";

export default () => {
  const router = express.Router();

  router.use(config.urls.about.path, (req: any, res: any, next) => {
    let data: any = {
      title: 'About RPG Schedule'
    };

    res.render("about", data);
  });

  return router;
};
