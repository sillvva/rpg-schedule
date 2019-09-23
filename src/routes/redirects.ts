import express from "express";

import config from "../models/config";

export default () => {
  const router = express.Router();

  Object.values(config.urls.redirects).forEach(path => {
    router.use(path.path, async (req, res, next) => {
      path.redirect = path.redirect.replace(":lang", req.cookies.lang || "en");
      Object.keys(req.params).forEach(param => {
        path.redirect = path.redirect.replace(`:${req.params}`, req.params[param]);
      });
      const query = Object.entries(req.query)
        .reduce((i, [key, value]: [string, string]) => {
          i.push(key + "=" + escape(value));
          return i;
        }, [])
        .join("&");
      res.redirect(path.redirect + (query.length > 0 ? "?" + query : ""));
    });
  });

  return router;
};
