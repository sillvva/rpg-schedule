import ShardManager from "../processes/shard-manager";
const ics = require("ics");
import express from "express";
import moment from "moment";

import config from "../models/config";
import { Game } from "../models/game";

export default () => {
  const router = express.Router();

  router.use(config.urls.rss.path, async (req, res, next) => {
    try {
      const uid = req.params.uid;
      const guilds = [];

      let tag = "";

      const shardGuilds = await ShardManager.shardGuilds({
        memberIds: [uid],
      });

      shardGuilds.forEach((guild) => {
        guild.members.forEach((member) => {
          if (member.id === uid) {
            tag = member.user.tag;
            guilds.push({
              id: guild.id,
              name: guild.name,
            });
          }
        });
      });

      const gameOptions: any = {
        s: {
          $in: guilds.reduce((i, g) => {
            i.push(g.id);
            return i;
          }, []),
        },
        timestamp: {
          $gt: new Date().getTime(),
        },
        dm: {
          $ne: tag,
        },
      };

      const games: any[] = await Game.fetchAllBy(gameOptions, null, shardGuilds);

      res.type("application/xml");
      res.status(200);
      res.send(`<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>RPG Schedule</title>
    <link>https://www.rpg-schedule.com</link>
    <description>Game scheduling bot for Discord</description>
    <image>
      <url>https://www.rpg-schedule.com/images/logo2.png</url>
      <title>RPG Schedule</title>
      <link>https://www.rpg-schedule.com</link>
    </image>
    ${games
      .map((game) => {
        if (!game.discordGuild) return "";

        const date = Game.ISOGameDate(game);
        game.moment = {
          raw: `${game.date} ${game.time} UTC${game.timezone < 0 ? "-" : "+"}${Math.abs(game.timezone)}`,
          iso: date,
          date: moment(date).utcOffset(parseInt(game.timezone)).format(config.formats.dateLong),
          calendar: moment(date).utcOffset(parseInt(game.timezone)).calendar(),
          from: moment(date).utcOffset(parseInt(game.timezone)).fromNow(),
        };

        game.slot = game.reserved.findIndex((t) => t.id === uid || t.tag.trim().replace("@", "") === tag) + 1;
        game.signedup = game.slot > 0 && game.slot <= parseInt(game.players);
        game.waitlisted = game.slot > parseInt(game.players);

        return `
      <item>
        <title>${game.adventure}</title>
        <link>https://www.rpg-schedule.com/games/upcoming</link>
        <guid>https://www.rpg-schedule.com/games/${game._id.toString().slice(-12)}</guid>
        <description>
          <![CDATA[<p>Discord Server: ${(guilds.find((g) => g.id === game.s) || {}).name}</p><p>GM: ${game.dm.tag}</p><p>Where: ${game.where.replace(/\&/g, "&amp;")}</p><p>When: ${
          game.moment.date
        }</p><p>${game.description.trim().replace(/\&/g, "&amp;").replace(/\r?\n/g, "<br>")}</p>]]>
        </description>
      </item>`;
      })
      .join("\n")}
    <atom:link href="${req.protocol}s://${req.hostname}${req.originalUrl}" rel="self" type="application/rss+xml" />
  </channel>
</rss>`);
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  router.use(config.urls.ics.path, async (req, res, next) => {
    const uid = req.params.uid;
    const signedup = req.query.signedup == "true";
    const guilds = [];

    let tag = "";

    const shardGuilds = await ShardManager.shardGuilds({
      memberIds: [uid],
    });

    shardGuilds.forEach((guild) => {
      guild.members.forEach((member) => {
        if (member.id === uid) {
          tag = member.user.tag;
          guilds.push({
            id: guild.id,
            name: guild.name,
          });
        }
      });
    });

    const gameOptions: any = {
      s: {
        $in: guilds.reduce((i, g) => {
          i.push(g.id);
          return i;
        }, []),
      },
      timestamp: {
        $gt: new Date().getTime(),
      },
    };

    // if (signedup) {
    //   gameOptions.$or = [{ dm: tag }, { reserved: { $regex: tag } }];
    // }

    const games = await Game.fetchAllBy(gameOptions, null, shardGuilds);

    try {
      var { error, value } = ics.createEvents(
        games
          .filter((game) => {
            return signedup ? game.dm.id === uid || game.dm.tag === tag || game.reserved.find((r) => r.id === uid || r.tag === tag) : true;
          })
          .map((game) => {
            const d = new Date(game.timestamp);
            return {
              uid: `${game._id}@rpg-schedule.com`,
              title: game.adventure,
              start: [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()],
              duration: { hours: game.runtime },
              description: game.description,
              categories: ["RPG Schedule", game.discordGuild.name],
              location: game.where,
              organizer: { name: game.dm.tag, email: `${(game.dm.tag || "").replace(/[^a-z0-9_.]/gi, "")}@rpg-schedule.com` },
              attendees: game.reserved
                .filter((r) => r.tag.trim().length > 0)
                .map((r, i) => ({
                  name: r,
                  rsvp: parseInt(game.players) - i > 0,
                  email: `${(r.id || "").replace(/[^a-z0-9_.]/gi, "")}@rpg-schedule.com`,
                })),
              sequence: game.sequence,
            };
          })
      );
    } catch (err) {
      console.log(err.message);
    }

    if (error) {
      return res.send(error);
    }

    if (req.query.print) res.setHeader("Content-Type", "text/plain");
    else res.setHeader("Content-Type", "text/calendar");
    res.send(value);
  });

  return router;
};
