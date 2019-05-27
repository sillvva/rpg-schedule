interface Path {
    url: string;
    session: boolean;
    redirect: string;
    guildPermission: boolean;
};

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

export = {
    parseConfigURLs: parseConfigURLs
};