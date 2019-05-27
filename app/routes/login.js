"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const request_1 = __importDefault(require("request"));
const config_1 = __importDefault(require("../models/config"));
exports.default = () => {
    const router = express_1.default.Router();
    router.use(config_1.default.urls.login.url, (req, res, next) => {
        if (req.query.code) {
            const headers = {
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
                if (!error && response.statusCode === 200) {
                    const token = JSON.parse(body);
                    req.session.status = {
                        ...config_1.default.defaults.sessionStatus,
                        ...req.session.status
                    };
                    req.session.status.access = token;
                    res.redirect(config_1.default.urls.game.dashboard.url);
                    return;
                }
                console.log(error);
                res.render("error", { message: error });
            });
        }
        else if (req.query.error) {
            res.redirect("/");
        }
        else {
            res.redirect(process.env.AUTH_URL);
        }
    });
    router.use(config_1.default.urls.logout.url, (req, res, next) => {
        req.session.status = config_1.default.defaults.sessionStatus;
        res.redirect("/");
    });
    return router;
};
