import _ from "lodash";

interface Path {
  path: string;
  session: boolean;
  redirect: string;
  guildPermission: boolean;
  hidden: boolean;
}

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

const objectChanges = (before: {}, after: {}) => {
  return _.toPairs(after).reduce((result, [key, value]) => {
    if (before[key] !== value) {
      result[key] = value instanceof Object && before[key] instanceof Object ? objectChanges(value, before[key]) : value;
    }
    return result;
  }, {});
};

const backslash = (text: string) => {
  let output = '';
  for(var i = 0; i < text.length; i++) {
    output += `${text.charAt(i).match(/[A-Z0-9]/gi) ? '' : '\\'}${text.charAt(i)}`;
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
};

const parseEventTimes = (date: string, time: string, timezone: number, event?: Event) => {
  const isoutc = `${new Date(`${date} ${time} UTC${timezone < 0 ? "-" : "+"}${Math.abs(timezone)}`).toISOString().replace(/[^0-9T]/gi,"").slice(0,13)}00Z`;
  const rawDate = `${date} ${time} UTC${timezone < 0 ? "-" : "+"}${parseTimeZoneISO(timezone)}`;
  const d = new Date(rawDate).toISOString().replace(/[^0-9T]/gi,"").slice(0,13);

  const convertExtras = [];
  if (event && event.name) convertExtras.push(`&l=${escape(event.name)}`);

  const convert2Extras = [];
  if (event && event.name) convert2Extras.push(`&msg=${escape(event.name)}`);

  const googleCalExtras = [];
  if (event && event.name) googleCalExtras.push(`&text=${escape(event.name)}`);
  if (event && event.location) googleCalExtras.push(`&location=${escape(`${event.location}`)}`);
  if (event && event.description) googleCalExtras.push(``);

  return {
    rawDate: rawDate,
    isoutc: isoutc,
    convert: {
      timee: `https://timee.io/${d}?${convertExtras.join("")}`,
      timeAndDate: `https://www.timeanddate.com/worldclock/converter.html?iso=${d}&p1=1440`
    },
    countdown: `https://www.timeanddate.com/countdown/generic?iso=${d}&p0=1440${convert2Extras.join("")}`,
    googleCal: `http://www.google.com/calendar/render?action=TEMPLATE&dates=${isoutc}/${isoutc}&trp=false${googleCalExtras.join("")}`
  };
};

let curTimer = new Date().getTime();
const timer = (n: number) => {
  const newT = new Date().getTime();
  console.log(`Timer${n ? ` ${n}` : ''}: `, newT - curTimer);
  curTimer = newT;
  return curTimer;
};

const isEmoji = (emoji: string) => {
  return emoji.match(/(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g);
}

export default {
  parseConfigURLs: parseConfigURLs,
  parseConfigParam: parseConfigParam,
  parseTimeZoneISO: parseTimeZoneISO,
  parseEventTimes: parseEventTimes,
  objectChanges: objectChanges,
  fromEntries: _.fromPairs,
  backslash: backslash,
  timer: timer,
  isEmoji: isEmoji
};
