import SocketIO from "socket.io";
import http from "http";

let _io: SocketIO.Server;

export function socket(httpServer: http.Server) {
  _io = SocketIO(httpServer);

  _io.on("connection", (socket) => {
    // console.log("Client connected!");
  });

  return _io;
}

export function io() {
  if (!_io) throw new Error("Socket.io not initialized!");
  return _io;
}
