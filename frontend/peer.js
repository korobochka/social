const VIDEO = 'video';
const SCREEN = 'screen';

class Peer {
    constructor(application, id, location) {
        this.application = application;
        this.id = id;
        this.location = location;
        this.sharingScreen = false;
        this.subscriptions = [];

        this.element = document.createElement("div");
        this.element.classList.add('peer');

        this.videoWrapper = document.createElement("div");
        this.videoWrapper.classList.add("video-wrapper");

        this.video = this.createVideo();
        this.videoWrapper.appendChild(this.video);
        this.element.appendChild(this.videoWrapper);

        this.subscriptions.push(this.application.media.soundOutput.subscribe(sinkId => {
            setSink(this.video, sinkId);
        }));

        this.containerUnder = document.createElement("div");
        this.containerUnder.classList.add("under-wrapper");

        this.resetScreenVideo();
        this.element.appendChild(this.containerUnder);

        this.application.room.appendChild(this.element);


        this.peerConnections = {};

        if (this.isMyself()) {
            this.subscriptions.push(this.application.media.selfStream.subscribe(stream => {
                this.video.srcObject = stream;
            }));
            this.subscriptions.push(this.application.media.screenStream.subscribe(stream => {
                socket.emit("clientScreenshare", {sharingScreen: stream !== null});
                if (stream !== null) {
                    this.screenVideo.srcObject = stream;
                    this.screenVideo.style.maxWidth = null;
                } else {
                    this.resetScreenVideo();
                    this.screenVideo.style.maxWidth = `0px`;
                }
            }));
        } else {
            this.peerConnections[VIDEO] = new PeerConnection(this.application.myId, this.id, VIDEO, this.application.media.selfStream, this.video);
            this.peerConnections[SCREEN] = new PeerConnection(this.application.myId, this.id, SCREEN, this.application.media.screenStream, this.screenVideo, this.resetScreenVideo.bind(this));
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
        this.subscriptions.forEach(unsub => unsub());
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

    updateDistance(dist) {
        if (dist > maxDistance) {
            this.setSize(minSize, 0);
            this.setVolume(0);
        } else if (dist < minDistance) {
            this.setSize(maxSize, 1);
            this.setVolume(1);
        } else {
            const closeness = 1.0 - (dist - minDistance) / (maxDistance - minDistance);
            this.setSize(minSize + (maxSize - minSize) * closeness, closeness);
            this.setVolume(closeness);
        }
    }

    setVolume(volume) {
        this.video.volume = volume;
        this.screenVideo.volume = volume;
    }

    isMyself() {
        return this.id === this.application.myId;
    }

    animate(animationName, element, definition) {
        this.animations = this.animations || {};
        const run = () => {
            const def = {};
            for (const d of definition) {
                const name = d[0];
                def[name] = [element.style[name] || d[1], d[2]];
            }
            const animation = element.animate(def, 500);
            animation.onfinish = () => {
                for (const d of definition) {
                    const name = d[0];
                    element.style[name] = d[2];
                }
                this.animations[animationName] = null;
            };
            return animation;
        };
        const existing = this.animations[animationName];
        if (existing) {
            const orig = existing.onfinish;
            existing.onfinish = () => {
                orig();
                this.animations[animationName] = run();
            };
        } else {
            this.animations[animationName] = run();
        }
    }

    move(toLocation) {
        this.location = toLocation;

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
