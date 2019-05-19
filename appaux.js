const parseConfigURLs = (paths) => {
    let urls = [];
    Object.entries(paths).forEach(entry => {
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

module.exports = {
    parseConfigURLs: parseConfigURLs
};