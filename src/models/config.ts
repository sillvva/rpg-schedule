export default {
  title: "RPG Schedule",
  sessionVersion: 3, // Incrementing this number will log users with existing sessions out
  urls: {
    base: { path: "/", session: true },
    redirects: {
      game: { path: "/game", redirect: "/games/edit" },
      upcoming: { path: "/games", redirect: "/games/upcoming" },
      mygames: { path: "/my-games", redirect: "/games/my-games" }
    },
    game: {
      games: { path: "/games/upcoming", session: true, guildPermission: true, loadGames: true },
      dashboard: { path: "/games/my-games", session: true, guildPermission: true, loadGames: true },
      calendar: { path: "/games/calendar", session: true, guildPermission: true, loadGames: true },
      server: { path: "/games/server", session: true, guildPermission: true, loadGames: true },
      create: { path: "/games/edit", session: true },
      delete: { path: "/games/delete", session: true },
      password: { path: "/games/password", session: true },
      auth: { path: "/games/authenticate", session: true },
      rsvp: { path: "/games/rsvp", session: true }
    },
    about: { path: "/info/about", session: true },
    changeLang: { path: "/lang/:newLang" },
    invite: { path: "/invite" },
    donate: { path: "/donate" },
    github: { path: "/github" },
    login: { path: "/login" },
    logout: { path: "/logout" },
    rss: { path: "/rss/:uid" },
    guildUserRss: { path: "/rss/:uid/:guildId" },
    guildRss: { path: "/guild-rss/:guildId" },
    ics: { path: "/ics/:uid.ics" },
    timezone: {
      convert: { path: "/tz/:time/:tz" },
      countdown: { path: "/cd/:time/:tz" }
    }
  },
  formats: {
    dateLong: "llll z"
  },
  author: "Sillvva#2532",
  command: "schedule",
  patreon: {
    creditPledge: '4773971'
  },
  defaults: {
    sessionStatus: {
      access: {},
      loggedInTo: []
    }
  }
};