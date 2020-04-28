import _ from "lodash";
import moment from "moment";
import "moment-recur-ts";
import axios from "axios";
import { GameModel } from "./models/game";

interface Path {
  path: string;
  session: boolean;
  redirect: string;
  guildPermission: boolean;
  loadGames: boolean;
  hidden: boolean;
}

const patreonPledges = async () => {
  const accessToken = process.env.PATREON_API_ACCESS_TOKEN;
  const campaignId = process.env.PATREON_CAMPAIGN_ID;
  try {
    const url = `https://www.patreon.com/api/oauth2/api/campaigns/${campaignId}/pledges`;
    const response = await axios.get(url, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const data = response.data;
    const rewards = data.included.filter((i) => i.type === "reward" && i.id > 0);
    const pledges = data.data.filter((i) => i.type === "pledge" && i.id > 0);
    const users = data.included.filter((i) => i.type === "user" && i.id > 0);
    const result = [];
    pledges.forEach((pledge) => {
      const rewardId = pledge.relationships.reward.data.id;
      const reward = rewards.find((r) => r.id === rewardId);
      const patronId = pledge.relationships.patron.data.id;
      const user = users.find((u) => u.id === patronId);
      result.push({
        patron: user,
        reward: reward,
      });
    });
    return {
      status: "success",
      data: result,
    };
  } catch (err) {
    return {
      status: "error",
      error: err,
    };
  }
};

const log = (...content: any) => {
  console.log(moment().format("lll") + ":", ...content);
};

const parseConfigURLs = (paths: Object) => {
  let urls: Path[] = [];
  _.toPairs(paths).forEach((entry: any) => {
    const [id, path] = entry;
    if (path.hasOwnProperty("path")) {
      urls.push(path);
    } else if (path instanceof Object) {
      urls = [...urls, ...parseConfigURLs(path)];
    }
    return [id, path];
  });
  return urls;
};

const parseConfigParam = (paths: Object, param: String, value: String): any => {
  const parsedPaths = _.cloneDeep(paths);
  return _.fromPairs(
    _.toPairs(parsedPaths).map((entry: any) => {
      let [id, path] = entry;
      if (path.hasOwnProperty("path")) {
        path.url = path.url.replace(`:${param}`, value);
      } else if (path instanceof Object) {
        path = parseConfigParam(path, param, value);
      }
      return [id, path];
    })
  );
};

const objectChanges = (before: Object | Array<any>, after: Object | Array<any>) => {
  return _.toPairs(after).reduce((result, [key, value]) => {
    if (before[key] !== value) {
      result[key] = value instanceof Object && before[key] instanceof Object ? objectChanges(value, before[key]) : value;
      if (Array.isArray(before[key])) {
        let arr = [];
        for (let i in after[key]) {
          arr.push(after[key][i]);
        }
        result[key] = arr;
      }
    }
    return result;
  }, {});
};

const backslash = (text: string) => {
  let output = "";
  for (var i = 0; i < text.length; i++) {
    output += `${text.charAt(i).match(/[A-Z0-9]/gi) ? "" : "\\"}${text.charAt(i)}`;
  }
  return output;
};

const parseTimeZoneISO = (timezone: number) => {
  const tz = Math.abs(timezone);
  const hours = Math.floor(tz);
  const minutes = (tz - hours) * 60;
  const zeroPad = (n: any, width: number, z = "0"): string => {
    n = n + "";
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  };
  return zeroPad(hours, 2) + zeroPad(minutes, 2);
};

interface Event {
  name: string;
  location?: string;
  description?: string;
}

interface EventTimeOptions {
  isField?: boolean;
}

const parseEventTimes = (event: GameModel, options: EventTimeOptions = {}) => {
  if (!event.date || !event.time || event.timezone == null) {
    return {};
  }
  const raw = `${event.date} ${event.time} UTC${event.timezone < 0 ? "-" : "+"}${Math.abs(event.timezone)}`;
  const isoutcStart = `${new Date(raw)
    .toISOString()
    .replace(/[^0-9T]/gi, "")
    .slice(0, 13)}00Z`;
  const endTime = new Date(raw);
  endTime.setHours(endTime.getHours() + parseFloat(event.runtime.replace(/[^\d-.]/g, "").trim() || '0'));
  const isoutcEnd = `${endTime
    .toISOString()
    .replace(/[^0-9T]/gi, "")
    .slice(0, 13)}00Z`;
  const rawDate = `${event.date} ${event.time} UTC${event.timezone < 0 ? "-" : "+"}${parseTimeZoneISO(event.timezone)}`;
  const d = new Date(rawDate)
    .toISOString()
    .replace(/[^0-9T]/gi, "")
    .slice(0, 13);

  const convertExtras = [];
  if (event.adventure) convertExtras.push(`&l=${escape(event.adventure)}`);

  const convert2Extras = [];
  if (event.adventure) convert2Extras.push(`&msg=${escape(event.adventure)}`);

  const googleCalExtras = [];

  const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const weekdays = event.weekdays.map((w, i) => w && days[i]).filter((w) => w);
  if (weekdays.length === 0) weekdays.push(days[moment(event.date).weekday()]);

  if (event.frequency === 1) {
    googleCalExtras.push(`&recur=RRULE:FREQ=DAILY`);
  }
  if (event.frequency === 2) {
    googleCalExtras.push(`&recur=RRULE:FREQ=WEEKLY;BYDAY=${weekdays.join(",")}`);
  }
  if (event.frequency === 3) {
    googleCalExtras.push(`&recur=RRULE:FREQ=WEEKLY;INTERVAL=${event.xWeeks};BYDAY=${weekdays.join(",")}`);
  }
  if (event.frequency === 4) {
    if (event.monthlyType === "date") {
      googleCalExtras.push(`&recur=RRULE:FREQ=MONTHLY`);
    } else if (event.monthlyType === "weekday") {
      googleCalExtras.push(`&recur=RRULE:FREQ=MONTHLY;BYDAY=${moment(event.date).monthWeekByDay() + 1}${days[new Date(raw).getDay()]}`);
    }
  }

  if (event.adventure) googleCalExtras.push(`&text=${escape(event.adventure)}`);
  if (event.where) googleCalExtras.push(`&location=${escape(`${event.where}`)}`);
  if (event.description && !options.isField) googleCalExtras.push(`&details=${escape(event.description)}`);

  return {
    raw: raw,
    rawDate: rawDate,
    isoutc: isoutcStart,
    isoutcStart: isoutcStart,
    isoutcEnd: isoutcEnd,
    convert: {
      timee: `https://timee.io/${d}?${convertExtras.join("")}`,
      timeAndDate: `https://www.timeanddate.com/worldclock/converter.html?iso=${d}&p1=1440`,
    },
    countdown: `https://www.timeanddate.com/countdown/generic?iso=${d}&p0=1440${convert2Extras.join("")}`,
    googleCal: `http://www.google.com/calendar/render?action=TEMPLATE&dates=${isoutcStart}/${isoutcEnd}&trp=true${googleCalExtras.join("")}`,
  };
};

let curTimer = new Date().getTime();
const timer = (n: number) => {
  const newT = new Date().getTime();
  console.log(`Timer${n ? ` ${n}` : ""}: `, newT - curTimer);
  curTimer = newT;
  return curTimer;
};

const isEmoji = (emoji: string) => {
  return emoji.match(
    /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g
  );
};

var colors = {
  aliceblue: "#f0f8ff",
  antiquewhite: "#faebd7",
  aqua: "#00ffff",
  aquamarine: "#7fffd4",
  azure: "#f0ffff",
  beige: "#f5f5dc",
  bisque: "#ffe4c4",
  black: "#000000",
  blanchedalmond: "#ffebcd",
  blue: "#0000ff",
  blueviolet: "#8a2be2",
  brown: "#a52a2a",
  burlywood: "#deb887",
  cadetblue: "#5f9ea0",
  chartreuse: "#7fff00",
  chocolate: "#d2691e",
  coral: "#ff7f50",
  cornflowerblue: "#6495ed",
  cornsilk: "#fff8dc",
  crimson: "#dc143c",
  cyan: "#00ffff",
  darkblue: "#00008b",
  darkcyan: "#008b8b",
  darkgoldenrod: "#b8860b",
  darkgray: "#a9a9a9",
  darkgreen: "#006400",
  darkkhaki: "#bdb76b",
  darkmagenta: "#8b008b",
  darkolivegreen: "#556b2f",
  darkorange: "#ff8c00",
  darkorchid: "#9932cc",
  darkred: "#8b0000",
  darksalmon: "#e9967a",
  darkseagreen: "#8fbc8f",
  darkslateblue: "#483d8b",
  darkslategray: "#2f4f4f",
  darkturquoise: "#00ced1",
  darkviolet: "#9400d3",
  deeppink: "#ff1493",
  deepskyblue: "#00bfff",
  dimgray: "#696969",
  dodgerblue: "#1e90ff",
  firebrick: "#b22222",
  floralwhite: "#fffaf0",
  forestgreen: "#228b22",
  fuchsia: "#ff00ff",
  gainsboro: "#dcdcdc",
  ghostwhite: "#f8f8ff",
  gold: "#ffd700",
  goldenrod: "#daa520",
  gray: "#808080",
  green: "#008000",
  greenyellow: "#adff2f",
  honeydew: "#f0fff0",
  hotpink: "#ff69b4",
  indianred: "#cd5c5c",
  indigo: "#4b0082",
  ivory: "#fffff0",
  khaki: "#f0e68c",
  lightyellow: "#ffffe0",
  lime: "#00ff00",
  limegreen: "#32cd32",
  linen: "#faf0e6",
  lavender: "#e6e6fa",
  lavenderblush: "#fff0f5",
  lawngreen: "#7cfc00",
  lemonchiffon: "#fffacd",
  lightblue: "#add8e6",
  lightcoral: "#f08080",
  lightcyan: "#e0ffff",
  lightgoldenrodyellow: "#fafad2",
  lightgrey: "#d3d3d3",
  lightgreen: "#90ee90",
  lightpink: "#ffb6c1",
  lightsalmon: "#ffa07a",
  lightseagreen: "#20b2aa",
  lightskyblue: "#87cefa",
  lightslategray: "#778899",
  lightsteelblue: "#b0c4de",
  magenta: "#ff00ff",
  maroon: "#800000",
  mediumaquamarine: "#66cdaa",
  mediumblue: "#0000cd",
  mediumorchid: "#ba55d3",
  mediumpurple: "#9370d8",
  mediumseagreen: "#3cb371",
  mediumslateblue: "#7b68ee",
  mediumspringgreen: "#00fa9a",
  mediumturquoise: "#48d1cc",
  mediumvioletred: "#c71585",
  midnightblue: "#191970",
  mintcream: "#f5fffa",
  mistyrose: "#ffe4e1",
  moccasin: "#ffe4b5",
  navajowhite: "#ffdead",
  navy: "#000080",
  oldlace: "#fdf5e6",
  olive: "#808000",
  olivedrab: "#6b8e23",
  orange: "#ffa500",
  orangered: "#ff4500",
  orchid: "#da70d6",
  palegoldenrod: "#eee8aa",
  palegreen: "#98fb98",
  paleturquoise: "#afeeee",
  palevioletred: "#d87093",
  papayawhip: "#ffefd5",
  peachpuff: "#ffdab9",
  peru: "#cd853f",
  pink: "#ffc0cb",
  plum: "#dda0dd",
  powderblue: "#b0e0e6",
  purple: "#800080",
  rebeccapurple: "#663399",
  red: "#ff0000",
  rosybrown: "#bc8f8f",
  royalblue: "#4169e1",
  tan: "#d2b48c",
  teal: "#008080",
  thistle: "#d8bfd8",
  tomato: "#ff6347",
  turquoise: "#40e0d0",
  saddlebrown: "#8b4513",
  salmon: "#fa8072",
  sandybrown: "#f4a460",
  seagreen: "#2e8b57",
  seashell: "#fff5ee",
  sienna: "#a0522d",
  silver: "#c0c0c0",
  skyblue: "#87ceeb",
  slateblue: "#6a5acd",
  slategray: "#708090",
  snow: "#fffafa",
  springgreen: "#00ff7f",
  steelblue: "#4682b4",
  violet: "#ee82ee",
  wheat: "#f5deb3",
  white: "#ffffff",
  whitesmoke: "#f5f5f5",
  yellow: "#ffff00",
  yellowgreen: "#9acd32",
};

export default {
  parseConfigURLs: parseConfigURLs,
  parseConfigParam: parseConfigParam,
  parseTimeZoneISO: parseTimeZoneISO,
  parseEventTimes: parseEventTimes,
  objectChanges: objectChanges,
  fromEntries: _.fromPairs,
  backslash: backslash,
  timer: timer,
  isEmoji: isEmoji,
  log: log,
  patreonPledges: patreonPledges,
  colors: colors,
};
