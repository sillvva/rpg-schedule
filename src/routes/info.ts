import express, { request } from "express";

import config from "../models/config";
import aux from "../appaux";

export default () => {
  const router = express.Router();

  router.use(config.urls.about.path, async (req: any, res: any, next) => {
    const pledges = await aux.patreonPledges();
    const data: any = {
      title: 'About RPG Schedule',
      pledges: pledges.status === "success" ? pledges.data.filter(p => p.reward.id === config.patreon.creditPledge ) : []
    };

    res.render("about", data);
  });

  return router;
};
