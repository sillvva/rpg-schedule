let _io;

const init = httpServer => {
    _io = require("socket.io")(httpServer);

    _io.on("connection", socket => {
        console.log("Client connected!");
    });

    return _io;
};

const getIo = () => {
    if (!_io) throw new Error("Socket.io not initialized!");
    return _io;
};

module.exports = {
    init: init,
    getIo: getIo
};
