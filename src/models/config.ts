export default {
  title: "RPG Schedule",
  urls: {
    base: { url: "/", session: true },
    redirects: {
      game: { url: "/game", redirect: "/games/edit" },
      upcoming: { url: "/games", redirect: "/games/upcoming" },
      mygames: { url: "/my-games", redirect: "/games/my-games" }
    },
    game: {
      games: { url: "/games/upcoming", session: true, guildPermission: true },
      dashboard: { url: "/games/my-games", session: true, guildPermission: true },
      create: { url: "/games/edit", session: true },
      delete: { url: "/games/delete", session: true },
      password: { url: "/games/password", session: true },
      auth: { url: "/games/authenticate", session: true },
      rsvp: { url: "/games/rsvp", session: true }
    },
    changeLang: { url: "/lang/:newLang" },
    invite: { url: "/invite" },
    login: { url: "/login" },
    logout: { url: "/logout" },
    timezone: {
      convert: { url: "/tz/:time/:tz" },
      countdown: { url: "/cd/:time/:tz" }
    }
  },
  formats: {
    dateLong: "llll"
  },
  author: "Sillvva#2532",
  defaults: {
    sessionStatus: {
      access: {},
      loggedInTo: []
    }
  }
};
