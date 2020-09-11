import SocketIO from "socket.io";
import http from "http";

let _io: SocketIO.Server;

export function socket(httpServer: http.Server) {
  _io = SocketIO.listen(httpServer);

  _io.on("connection", (socket) => {
    if (socket.handshake.query && socket.handshake.query.rooms) {
      socket.join(socket.handshake.query.rooms.split(','));
      socket.emit("connected", `Connected to rooms: ${socket.handshake.query.rooms.split(',').join(', ')}`);
    }
  });

  return _io;
}

export function io() {
  if (!_io) throw new Error("Socket.io not initialized!");
  return _io;
}