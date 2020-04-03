class Application {
    constructor(media) {
        this.myId = null;
        this.roomWidth = 0;
        this.roomHeight = 0;
        this.peers = {};
        this.room = document.getElementById("room");
        this.room.style.marginTop = `${maxSize / 2}px`;
        this.media = media;

        document.onkeydown = function (event) {
            const key = event.key;
            let offsetX = 0;
            let offsetY = 0;
            const offset = 10;
            if (/*key === 'ArrowUp' ||*/ key === 'w') offsetY = -offset;
            if (/*key === 'ArrowDown' ||*/ key === 's') offsetY = offset;
            if (/*key === 'ArrowLeft' || */ key === 'a') offsetX = -offset;
            if (/*key === 'ArrowRight' || */ key === 'd') offsetX = offset;
            socket.emit('clientMove', {
                offsetX,
                offsetY
            });
        };

        this.room.onclick = (event) => {
            const rect = this.room.getBoundingClientRect();
            socket.emit('clientTeleport', {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            });
        };
    }

    init({id, width, height, clients}) {
        console.log(`Init ${id}`);
        this.myId = id;
        this.roomWidth = width;
        this.roomHeight = height;
        this.updateRoomDimensions();
        const knownIds = clients.map(c => c.id);
        Object.keys(this.peers).forEach(key => {
            if (!knownIds.includes(key)) this.removePeer(this.peers[key]);
        });
        this.updatePeer(clients.find(peerDto => peerDto.id === id));
        clients.forEach(peerDto => {
            if (peerDto.id !== id) this.updatePeer(peerDto);
        });
    }

    updateRoomDimensions() {
        this.room.style.width = `${this.roomWidth}px`;
        this.room.style.height = `${this.roomHeight}px`;
    }

    updatePeer({id, location, sharingScreen}) {
        let peer = this.peers[id];
        if (!peer) {
            peer = this.createPeer(id, location);
        }
        peer.sharingScreen = sharingScreen;
        peer.move(location);

        function updateOther(myself, other) {
            const dist = distance(myself.location, other.location);
            other.updateDistance(dist);
            const shouldConnect = dist < connectionDistance;
            other.updateMainConnection(shouldConnect);
            other.updateScreenSharingConnection(shouldConnect && (myself.sharingScreen || other.sharingScreen));
        }

        if (peer.isMyself()) {
            peer.setSize(maxSize, 1.0);
            this.getOthers().forEach(other => updateOther(peer, other));
        } else {
            const myself = this.getMyself();
            if (myself) {
                updateOther(myself, peer);
            }
        }
    }

    createPeer(id, location) {
        const peer = new Peer(this, id, location);
        this.peers[id] = peer;

        console.log(`New peer connected ${id} ${peer.isMyself() ? 'self' : ''}`);
        this.updateTitle();
        return peer;
    }

    removePeer(peer) {
        peer.destroy();
        delete this.peers[peer.id];
        console.log(`Peer disconnected: ${peer.id}`);
        this.updateTitle();
    }

    updateTitle() {
        document.title = `Virtual room (${Object.keys(this.peers).length - 1})`;
    }

    getPeerById(id) {
        return this.peers[id];
    }

    removePeerById(peerId) {
        const peer = this.peers[peerId];
        if (peer) this.removePeer(peer);
    }

    getMyself() {
        return this.peers[this.myId];
    }

    getOthers() {
        return Object.values(this.peers).filter(peer => peer.id !== this.myId);
    }
}