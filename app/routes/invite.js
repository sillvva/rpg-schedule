"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var config_1 = __importDefault(require("../models/config"));
exports.default = (function () {
    var router = express_1.default.Router();
    router.use(config_1.default.urls.invite.url, function (req, res, next) {
        res.redirect(process.env.INVITE);
    });
    return router;
});
