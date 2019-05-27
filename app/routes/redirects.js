"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const config_1 = __importDefault(require("../models/config"));
exports.default = () => {
    const router = express_1.default.Router();
    Object.values(config_1.default.urls.redirects).forEach(path => {
        router.use(path.url, async (req, res, next) => {
            const params = Object.entries(req.query).reduce((i, [key, value]) => {
                i.push(key + '=' + escape(value));
                return i;
            }, []).join('&');
            res.redirect(path.redirect + (params.length > 0 ? '?' + params : ''));
        });
    });
    return router;
};
