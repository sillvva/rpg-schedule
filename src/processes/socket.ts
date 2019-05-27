import SocketIO from "socket.io";
import http from "http";

let _io: SocketIO.Server;

const init = (httpServer: http.Server) => {
    _io = SocketIO(httpServer);

    _io.on("connection", (socket: any) => {
        console.log("Client connected!");
    });

    return _io;
};

const io = () => {
    if (!_io) throw new Error("Socket.io not initialized!");
    return _io;
};

export = {
    init: init,
    io: io
};
