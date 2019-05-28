import fromEntries from "object.fromentries";

interface Path {
    url: string;
    session: boolean;
    redirect: string;
    guildPermission: boolean;
}

const parseConfigURLs = (paths: Object) => {
    let urls: Path[] = [];
    Object.entries(paths).forEach((entry: any) => {
        const [ id, path ] = entry;
        if (path.hasOwnProperty('url')) {
            urls.push(path);
        } else if (path instanceof Object) {
            urls = [ ...urls, ...parseConfigURLs(path) ];
        }
        return [id, path];
    });
    return urls;
};

const objectChanges = (before: {}, after: {}) => {
    return Object.entries(after).reduce((result, [key, value]) => {
        if (before[key] !== value) {
            result[key] = (value instanceof Object && before[key] instanceof Object) ? objectChanges(value, before[key]) : value;
        }
        return result;
    }, {});
};

export default {
    parseConfigURLs: parseConfigURLs,
    objectChanges: objectChanges,
    fromEntries: fromEntries
};