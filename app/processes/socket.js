"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const socket_io_1 = __importDefault(require("socket.io"));
let _io;
const init = (httpServer) => {
    _io = socket_io_1.default(httpServer);
    _io.on("connection", (socket) => {
        console.log("Client connected!");
    });
    return _io;
};
const io = () => {
    if (!_io)
        throw new Error("Socket.io not initialized!");
    return _io;
};
module.exports = {
    init: init,
    io: io
};
