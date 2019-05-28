"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var socket_io_1 = __importDefault(require("socket.io"));
var _io;
function socket(httpServer) {
    _io = socket_io_1.default(httpServer);
    _io.on("connection", function (socket) {
        console.log("Client connected!");
    });
    return _io;
}
exports.socket = socket;
;
function io() {
    if (!_io)
        throw new Error("Socket.io not initialized!");
    return _io;
}
exports.io = io;
;
