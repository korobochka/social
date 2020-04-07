class Application extends Subscriber {
    constructor(media) {
        super();
        this.animate = animate.bind(this);
        this.myId = null;
        this.peers = {};
        this.room = document.getElementById("room");
        this.headerButtonInfo = document.getElementById("header-button-info");
        this.headerButtonSettings = document.getElementById("header-button-settings");
        this.overlayInfo = document.getElementById("overlay-info");
        this.overlaySettings = document.getElementById("overlay-settings");
        this.media = media;

        this.myself = new Observable({
            location: {x: 0, y: 0},
            sharingScreen: false
        });

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

        this.subscribe(this.myself, myself => {
            this.animate('move', this.room, [
                ['left', '0px', `-${myself.location.x}px`],
                ['top', '0px', `-${myself.location.y}px`]
            ]);
        });

        for (const overlay of document.getElementsByClassName("overlay")) {
            overlay.onclick = (event) => {
                if (event.target === overlay) hide(overlay);
            };
        }

        this.headerButtonInfo.onclick = () => {
            show(this.overlayInfo);
        };

        this.headerButtonSettings.onclick = () => {
            show(this.overlaySettings);
        };
    }


    async start() {
        const seenInfo = storageGet('seenInfo', false);
        storageSet('seenInfo', true);

        if (!seenInfo) {
            show(this.overlayInfo);
        }

        await media.startVideo();

        socket.open('/');
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
            peer.synchronizeToObject({
                location: peer.location,
                sharingScreen: peer.sharingScreen
            }, this.myself);
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