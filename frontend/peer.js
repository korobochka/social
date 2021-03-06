const VIDEO = 'video';
const SCREEN = 'screen';

const connectionDistance = 2000;
const maxDistance = 1000;
const minDistance = 400;
const minSize = 50;

class Peer extends Subscriber {
    constructor(application, id, location) {
        super();
        this.animate = animate.bind(this);
        this.application = application;
        this.id = id;

        this.element = document.createElement("div");

        this.videoWrapper = document.createElement("div");
        this.videoWrapper.classList.add("video-wrapper");

        this.video = this.createVideo();
        this.videoWrapper.appendChild(this.video);
        this.element.appendChild(this.videoWrapper);

        this.subscribe(this.application.media.soundOutput, sinkId => {
            setSink(this.video, sinkId);
        });

        this.containerUnder = document.createElement("div");
        this.containerUnder.classList.add("under-wrapper");

        this.resetScreenVideo();
        this.element.appendChild(this.containerUnder);

        this.application.room.appendChild(this.element);


        this.location = new Observable(location);

        this.sharingScreen = new Observable(false);

        this.peerConnections = {};

        if (this.isMyself()) {
            this.element.classList.add('peer-myself');
            this.autorun([this.application.maxPeerSize], (maxSize) => {
                this.setSize(maxSize, 1.0);
            });
            this.subscribe(this.application.media.selfStream, stream => {
                this.video.srcObject = stream;
            });
            this.subscribe(this.application.media.screenStream, stream => {
                socket.emit("clientScreenshare", {sharingScreen: stream !== null});
                if (stream !== null) {
                    this.screenVideo.srcObject = stream;
                    this.screenVideo.style.maxWidth = null;
                } else {
                    this.resetScreenVideo();
                    this.screenVideo.style.maxWidth = `0px`;
                }
            });
        } else {
            this.element.classList.add('peer-other');
            this.peerConnections[VIDEO] = new PeerConnection(this.application.myId, this.id, VIDEO, this.application.media.selfStream, this.video);
            this.peerConnections[SCREEN] = new PeerConnection(this.application.myId, this.id, SCREEN, this.application.media.screenStream, this.screenVideo, this.resetScreenVideo.bind(this));
            this.autorun([this.application.myself, this.location, this.sharingScreen, this.application.maxPeerSize],
                (myself, location, sharing, maxSize) => {
                    this.move(location);
                    const dist = distance(myself.location, location);
                    this.updateDistance(dist, maxSize);
                    const shouldConnect = dist < connectionDistance;
                    this.updateMainConnection(shouldConnect);
                    this.updateScreenSharingConnection(shouldConnect && (myself.sharingScreen || sharing));
                });
        }
    }

    resetScreenVideo() {
        if (this.screenVideo) this.screenVideo.remove();
        this.screenVideo = this.createVideo();
        this.containerUnder.appendChild(this.screenVideo);
    }

    createVideo() {
        const video = document.createElement("video");
        video.setAttribute("autoplay", "autoplay");
        video.volume = 0.0;
        video.removeAttribute("controls");
        return video;
    }

    destroy() {
        super.destroy();
        Object.values(this.peerConnections).forEach(pc => pc.destroy());
        this.element.remove();
    }

    setSize(size, closeness) {
        this.animate('size', this.element, [
            ['width', '0px', `${size}px`],
            ['height', '0px', `${size}px`],
            ['marginLeft', '0px', `-${size / 2}px`],
            ['marginTop', '0px', `-${size / 2}px`]
        ]);

        this.animate('video', this.videoWrapper, [
            ['width', '0px', `${size}px`],
            ['height', '0px', `${size}px`],
        ]);

        this.animate('under', this.containerUnder, [
            ['marginLeft', '0px', `${size / 2}px`]
        ]);

        this.animate('screen', this.screenVideo, [
            ['width', '0px', `${90.0 * closeness}vw`]
        ]);
    }

    updateDistance(dist, maxSize) {
        const closeness = boundedCloseness(dist, minDistance, maxDistance);
        this.setSize(minSize + (maxSize - minSize) * closeness, closeness);
        this.setVolume(closeness);
    }

    setVolume(volume) {
        this.video.volume = volume;
        this.screenVideo.volume = volume;
    }

    isMyself() {
        return this.id === this.application.myId;
    }

    move(toLocation) {
        this.animate('move', this.element, [
            ['left', '0px', `${toLocation.x}px`],
            ['top', '0px', `${toLocation.y}px`]
        ]);
    }

    updateMainConnection(shouldConnect) {
        if (shouldConnect) return this.peerConnections[VIDEO].startConnection();
        else return this.peerConnections[VIDEO].closeConnection();
    }

    updateScreenSharingConnection(shouldConnect) {
        if (shouldConnect) return this.peerConnections[SCREEN].startConnection();
        else return this.peerConnections[SCREEN].closeConnection();
    }

    answerVideoCall(connectionId, description) {
        if (this.isMyself()) {
            console.error(`Got call from self?`);
            return;
        }
        return this.peerConnections[connectionId].answerConnection(description);
    }

    async processAnswer(connectionId, description) {
        await this.peerConnections[connectionId].processAnswer(description);
    }

    relayCandidate(connectionId, candidate) {
        this.peerConnections[connectionId].relayCandidate(candidate);
    }
}
