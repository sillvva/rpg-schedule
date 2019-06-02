"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var request_1 = __importDefault(require("request"));
var config_1 = __importDefault(require("../models/config"));
exports.default = (function () {
    var router = express_1.default.Router();
    router.use(config_1.default.urls.login.url, function (req, res, next) {
        if (req.query.code) {
            var headers = {
                "Content-Type": "application/x-www-form-urlencoded"
            };
            request_1.default({
                url: "https://discordapp.com/api/v6/oauth2/token",
                method: "POST",
                headers: headers,
                form: {
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code: req.query.code,
                    redirect_uri: process.env.HOST + config_1.default.urls.login.url,
                    scope: "identify guilds"
                }
            }, function (error, response, body) {
                if (error || response.statusCode !== 200) {
                    console.log(error);
                    res.render("error", { message: "Response: " + response.statusCode + "<br />" + error });
                }
                var token = JSON.parse(body);
                req.session.status = __assign({}, config_1.default.defaults.sessionStatus, req.session.status);
                req.session.status.access = token;
                res.redirect(req.session.redirect || config_1.default.urls.game.games.url);
                delete req.session.redirect;
            });
        }
        else if (req.query.error) {
            res.redirect("/");
        }
        else {
            delete req.session.redirect;
            if (req.query.redirect) {
                req.session.redirect = req.query.redirect;
            }
            res.redirect(process.env.AUTH_URL);
        }
    });
    router.use(config_1.default.urls.logout.url, function (req, res, next) {
        req.session.status = config_1.default.defaults.sessionStatus;
        res.redirect("/");
    });
    return router;
});
