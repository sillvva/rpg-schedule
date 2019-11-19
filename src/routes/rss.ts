import { Client } from "discord.js";
import express from "express";
import moment from "moment";

import config from "../models/config";
import { Game } from "../models/game";

export default (options: any) => {
  const router = express.Router();
  const client: Client = options.client;

  router.use(config.urls.rss.path, async (req, res, next) => {
    const uid = req.params.uid;
    const guilds = [];

    let tag = "";

    client.guilds.forEach(guild => {
      guild.members.forEach(member => {
        if (member.id === uid) {
          tag = member.user.tag;
          guilds.push({
            id: guild.id,
            name: guild.name
          });
        }
      });
    });

    const gameOptions: any = {
      s: {
        $in: guilds.reduce((i, g) => {
          i.push(g.id);
          return i;
        }, [])
      },
      timestamp: {
        $gt: new Date().getTime()
      },
      dm: {
        $ne: tag
      }
    };

    const games: any[] = await Game.fetchAllBy(gameOptions);

    res.type('application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>RPG Schedule</title>
    <link>https://rpg-schedule.herokuapp.com</link>
    <description>Game scheduling bot for Discord</description>
    <image>
      <url>https://rpg-schedule.herokuapp.com/images/logo2.png</url>
      <title>RPG Schedule</title>
      <link>https://rpg-schedule.herokuapp.com</link>
    </image>
    ${games.map(game => {
      if (!game.discordGuild) return "";

      const date = Game.ISOGameDate(game);
      game.moment = {
        raw: `${game.date} ${game.time} UTC${game.timezone < 0 ? "-" : "+"}${Math.abs(game.timezone)}`,
        iso: date,
        date: moment(date)
          .utcOffset(parseInt(game.timezone))
          .format(config.formats.dateLong),
        calendar: moment(date)
          .utcOffset(parseInt(game.timezone))
          .calendar(),
        from: moment(date)
          .utcOffset(parseInt(game.timezone))
          .fromNow()
      };

      game.slot = game.reserved.split(/\r?\n/).findIndex(t => t.trim().replace("@", "") === tag) + 1;
      game.signedup = game.slot > 0 && game.slot <= parseInt(game.players);
      game.waitlisted = game.slot > parseInt(game.players);

      return `
      <item>
        <title>${game.adventure}</title>
        <link>https://rpg-schedule.herokuapp.com/games/upcoming</link>
        <guid>https://rpg-schedule.herokuapp.com/games/view?g=${game._id.toString().slice(-12)}</guid>
        <description>
          <![CDATA[<p>Discord Server: ${(guilds.find(g => g.id === game.s) || {}).name}</p><p>GM: ${game.dm}</p><p>Where: ${game.where.replace(/\&/g, "&amp;")}</p><p>When: ${game.moment.date}</p><p>${game.description.trim().replace(/\&/g, "&amp;").replace(/\r?\n/g, "<br>")}</p>]]>
        </description>
      </item>`;
    }).join("\n")}
  </channel>
</rss>`);
  });

  return router;
};
