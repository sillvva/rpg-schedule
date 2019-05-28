"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var object_fromEntries_1 = __importDefault(require("object.fromEntries"));
var parseConfigURLs = function (paths) {
    var urls = [];
    Object.entries(paths).forEach(function (entry) {
        var id = entry[0], path = entry[1];
        if (path.hasOwnProperty('url')) {
            urls.push(path);
        }
        else if (path instanceof Object) {
            urls = urls.concat(parseConfigURLs(path));
        }
        return [id, path];
    });
    return urls;
};
var objectChanges = function (before, after) {
    return Object.entries(after).reduce(function (result, _a) {
        var key = _a[0], value = _a[1];
        if (before[key] !== value) {
            result[key] = (value instanceof Object && before[key] instanceof Object) ? objectChanges(value, before[key]) : value;
        }
        return result;
    }, {});
};
exports.default = {
    parseConfigURLs: parseConfigURLs,
    objectChanges: objectChanges,
    fromEntries: object_fromEntries_1.default
};
