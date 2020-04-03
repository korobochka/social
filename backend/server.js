const express = require('express');
const expressServer = express();
const httpServer = require('http').Server(expressServer);
const io = require('socket.io')(httpServer);

httpServer.listen(1191, '0.0.0.0', function () {
    console.log("listening");
});

expressServer.use(express.static('frontend'));

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

class Vector {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }

    add(x, y) {
        return new Vector(this.x + x, this.y + y);
    }
}

class Client {
    constructor(socket) {
        this.id = socket.id;
        this.socket = socket;
        this.location = new Vector(0, 0);
        this.sharingScreen = false;
    }

    send(type, data) {
        this.socket.emit(type, data);
    }

    toDto() {
        return {
            id: this.id,
            location: this.location,
            sharingScreen: this.sharingScreen
        };
    }
}

class Room {
    constructor(id) {
        this.roomId = id;
        this.width = 1500;
        this.height = 5000;
        this.clients = {};
    }

    addClient(id, socket) {
        const client = new Client(socket);
        this.clients[id] = client;
        client.send('init', {
            roomId: this.roomId,
            id: id,
            width: this.width,
            height: this.height,
            clients: this.clientsDto()
        });
        this.moveClient(client, this.randomLocation());
        socket.on('clientMove', data => {
            this.moveClient(client, client.location.add(data.offsetX || 0, data.offsetY || 0));
        });
        socket.on('clientTeleport', data => {
            this.moveClient(client, new Vector(data.x, data.y));
        });
        socket.on('clientScreenshare', ({sharingScreen}) => {
            client.sharingScreen = sharingScreen;
            this.broadcastUpdate(client);
        });
        socket.on('relayCandidate', ({to, connectionId, candidate}) => {
            const toClient = this.clients[to];
            if (toClient) toClient.send('relayCandidate', {
                from: id,
                candidate: candidate,
                connectionId: connectionId
            });
        });
        socket.on('video-offer', (message) => {
            const {from, to, connectionId, description} = message;
            const toClient = this.clients[to];
            if (toClient) toClient.send('video-offer', message);
        });
        socket.on('video-answer', (message) => {
            const {from, to, connectionId, description} = message;
            const toClient = this.clients[to];
            if (toClient) toClient.send('video-answer', message);
        });
    }

    removeClient(id) {
        delete this.clients[id];
        this.broadcast('removeClient', id);
    }

    moveClient(client, location) {
        location.x = clamp(location.x, 0, this.width);
        location.y = clamp(location.y, 0, this.height);
        client.location = location;
        this.broadcastUpdate(client);
    }

    broadcastUpdate(client) {
        this.broadcast('updateClient', client.toDto());
    }

    broadcast(type, data) {
        Object.values(this.clients).forEach(client => client.send(type, data));
    }

    randomLocation() {
        return new Vector(Math.random() * this.width, Math.random() * 700);
    }

    clientsDto() {
        return Object.values(this.clients).map(client => client.toDto());
    }
}

const rooms = {};

function getRoomId(str) {
    const defaultRoomId = 'default';
    try {
        return new URL(str).searchParams.get('roomId') || defaultRoomId;
    } catch (e) {
        console.error(e);
        return defaultRoomId;
    }
}

function getRoom(id) {
    let room = rooms[id];
    if (!room) {
        room = new Room(id);
        rooms[id] = room;
    }
    return room;
}

function cleanupRoom(room) {
    if (Object.keys(room.clients).length === 0) {
        delete rooms[room.roomId];
    }
}

io.on('connection', function (socket) {
    const roomId = getRoomId(socket.handshake.headers.referer);
    const room = getRoom(roomId);
    console.log(`${new Date()} Connection ${socket.id} to room '${roomId}', total in room: ${Object.keys(room.clients).length + 1}`);

    room.addClient(socket.id, socket);
    socket.on('disconnect', function () {
        room.removeClient(socket.id);
        console.log(`${new Date()} Disconnect ${socket.id} from room '${roomId}', total in room: ${Object.keys(room.clients).length}`);
        cleanupRoom(room);
    });
});