"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var config_1 = __importDefault(require("../models/config"));
exports.default = (function () {
    var router = express_1.default.Router();
    router.use(config_1.default.urls.timezone.convert.url, function (req, res, next) {
        var url = "https://www.timeanddate.com/worldclock/converter.html?iso=" + req.params.time + "&p1=" + req.params.tz;
        res.redirect(url);
    });
    router.use(config_1.default.urls.timezone.countdown.url, function (req, res, next) {
        var url = "https://www.timeanddate.com/countdown/generic?iso=" + req.params.time + "&p0=" + req.params.tz;
        res.redirect(url);
    });
    return router;
});
