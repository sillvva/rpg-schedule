"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const config_1 = __importDefault(require("../models/config"));
exports.default = () => {
    const router = express_1.default.Router();
    router.use(config_1.default.urls.invite.url, (req, res, next) => {
        res.redirect(process.env.INVITE);
    });
    return router;
};
