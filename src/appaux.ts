import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash/isEqual";
import fromPairs from "lodash/fromPairs";
import toPairs from "lodash/toPairs";
import moment from "moment";
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
  toPairs(paths).forEach((entry: any) => {
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
  const parsedPaths = cloneDeep(paths);
  return fromPairs(
    toPairs(parsedPaths).map((entry: any) => {
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
  return toPairs(after).reduce((result, [key, value]) => {
    if (!isEqual(before[key], value)) {
      result[key] = value;
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

const colorFixer = (color: string, defaultColor: string = "#2196f3") => {
  if (/^#?([0-9abcdef]{4})$/i.test((color || "").trim())) color = color.slice(0, 4);
  if (/^#?([0-9abcdef]{8})$/i.test((color || "").trim())) color = color.slice(0, 7);
  if (!/^#?([0-9abcdef]{3}|[0-9abcdef]{6})$/i.test(color || "")) return defaultColor;
  if (!color.startsWith("#")) color = "#" + color;
  return color;
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
  const raw = `${event.date} ${event.time} UTC${event.timezone < 0 ? "-" : "+"}${Math.abs(event.timezone)}`;
  const isoutcStart = `${new Date(raw)
    .toISOString()
    .replace(/[^0-9T]/gi, "")
    .slice(0, 13)}00Z`;
  const endTime = new Date(raw);
  endTime.setHours(endTime.getHours() + parseFloat(event.runtime.replace(/[^\d\.-]/g, "").trim() || "0"));
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

  if (event.frequency == 1) {
    googleCalExtras.push(`&recur=RRULE:FREQ=DAILY`);
  }
  if (event.frequency == 2) {
    googleCalExtras.push(`&recur=RRULE:FREQ=WEEKLY;BYDAY=${weekdays.join(",")}`);
  }
  if (event.frequency == 3) {
    googleCalExtras.push(`&recur=RRULE:FREQ=WEEKLY;INTERVAL=${event.xWeeks};BYDAY=${weekdays.join(",")}`);
  }
  if (event.frequency == 4) {
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

export default {
  parseConfigURLs: parseConfigURLs,
  parseConfigParam: parseConfigParam,
  parseTimeZoneISO: parseTimeZoneISO,
  parseEventTimes: parseEventTimes,
  objectChanges: objectChanges,
  fromEntries: fromPairs,
  backslash: backslash,
  timer: timer,
  isEmoji: isEmoji,
  log: log,
  patreonPledges: patreonPledges,
  colorFixer: colorFixer,
};
