class Application extends Subscriber {
    constructor(media) {
        super();
        this.myId = null;
        this.peers = {};
        this.room = document.getElementById("room");
        this.room.style.marginTop = `100px`;
        this.media = media;

        this.myLocation = new Observable({x: 0, y: 0});
        this.mySharingScreen = new Observable(false);

        this.roomDimensions = new Observable({width: 0, height: 0});
        this.subscribe(this.roomDimensions, this.updateRoomDimensions.bind(this));

        this.maxPeerSize = new Observable(200);

        this.room.onclick = (event) => {
            const rect = this.room.getBoundingClientRect();
            socket.emit('clientTeleport', {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            });
        };

        document.getElementById("peerSize").onchange = (event) => {
            this.maxPeerSize.setValue(Number.parseInt(event.target.value) || 200);
        };
    }

    init({id, width, height, clients}) {
        console.log(`Init ${id}`);
        this.myId = id;
        this.roomDimensions.setValue({width: width, height: height});
        const knownIds = clients.map(c => c.id);
        Object.keys(this.peers).forEach(key => {
            if (!knownIds.includes(key)) this.removePeer(this.peers[key]);
        });
        this.updatePeer(clients.find(peerDto => peerDto.id === id));
        clients.forEach(peerDto => {
            if (peerDto.id !== id) this.updatePeer(peerDto);
        });
    }

    updateRoomDimensions({width, height}) {
        this.room.style.width = `${width}px`;
        this.room.style.height = `${height}px`;
    }

    updatePeer({id, location, sharingScreen}) {
        let peer = this.peers[id];
        if (!peer) {
            peer = this.createPeer(id, location);
        }
        peer.sharingScreen.setValue(sharingScreen);
        peer.location.setValue(location);
    }

    createPeer(id, location) {
        const peer = new Peer(this, id, location);
        this.peers[id] = peer;

        if (peer.isMyself()) {
            peer.synchronize(peer.location, this.myLocation);
            peer.synchronize(peer.sharingScreen, this.mySharingScreen);
        }

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
}