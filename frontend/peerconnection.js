const config = {
    iceServers: [
        {urls: "stun:stun.l.google.com:19302"}
    ]
};

class PeerConnection {
    constructor(fromId, toId, connectionId, inputStreamObservable, outputElement, resetOutputElement) {
        this.fromId = fromId;
        this.toId = toId;
        this.connectionId = connectionId;
        this.pc = null;
        this.inputStream = null;
        this.outputElement = outputElement;
        this.resetOutputElement = resetOutputElement;

        this.subscriptions = [];
        if (inputStreamObservable !== null) {
            this.subscriptions.push(inputStreamObservable.subscribe((stream) => {
                this.inputStream = stream;
                this.addTracks();
            }));
        }
    }

    destroy() {
        this.subscriptions.forEach(unsub => unsub());
        this.closeConnection();
    }

    addTracks() {
        if (!this.pc) return;
        this.pc.getSenders().forEach(sender => this.pc.removeTrack(sender));
        if (!this.inputStream) return;
        for (const track of this.inputStream.getTracks()) {
            this.pc.addTrack(track, this.inputStream);
        }
    }

    createPeerConnection() {
        this.pc = new RTCPeerConnection(config);

        this.pc.ontrack = (event) => {
            this.outputElement.srcObject = event.streams[0];
            this.outputElement.play().catch(e => { /* ignore */
            });

            // todo handle event.track.onended
        };

        this.pc.onicecandidate = (event) => {
            if (!event.candidate) return;
            socket.emit('relayCandidate', {
                to: this.toId,
                connectionId: this.connectionId,
                candidate: event.candidate
            });
        };

        this.pc.oniceconnectionstatechange = () => {
            switch (this.pc.iceConnectionState) {
                case "closed":
                case "failed":
                case "disconnected":
                    console.error(`${this.toId} ${this.pc.iceConnectionState}`);
                    this.restartConnection();
                    break;
            }
        };
        this.pc.onsignalingstatechange = () => {
            switch (this.pc.signalingState) {
                case "closed":
                    console.error(`${this.toId} ${this.pc.signalingState}`);
                    this.restartConnection();
                    break;
            }
        };
    }

    async startConnection() {
        if (this.fromId < this.toId) return;
        if (this.pc !== null) return;

        this.createPeerConnection();
        this.pc.onnegotiationneeded = async () => {
            const offer = await this.pc.createOffer({offerToReceiveAudio: true, offerToReceiveVideo: true});
            await this.pc.setLocalDescription(offer);
            console.log(`Making video offer from ${this.fromId} to ${this.toId}`);
            socket.emit('video-offer', {
                from: this.fromId,
                to: this.toId,
                connectionId: this.connectionId,
                description: this.pc.localDescription
            });
        };
        this.addTracks();
        // onnegotiationneeded is only called if there are tracks in our stream
        if (!this.inputStream) await this.pc.onnegotiationneeded();
    }

    async answerConnection(description) {
        try {
            this.closeConnection();
            this.createPeerConnection(this.fromId, this.toId);

            await this.pc.setRemoteDescription(new RTCSessionDescription(description));
            this.addTracks();
            const answer = await this.pc.createAnswer({offerToReceiveAudio: true, offerToReceiveVideo: true});
            await this.pc.setLocalDescription(answer);
            console.log(`Sending video answer from ${this.fromId} to ${this.toId}`);
            socket.emit('video-answer', {
                from: this.fromId,
                to: this.toId,
                connectionId: this.connectionId,
                description: this.pc.localDescription
            });
        } catch (e) {
            console.error(e);
            this.closeConnection();
        }
    }

    async processAnswer(description) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(description));
    }

    closeConnection() {
        const pc = this.pc;
        if (pc === null) return;

        pc.ontrack = null;
        pc.onremovetrack = null;
        pc.onremovestream = null;
        pc.onicecandidate = null;
        pc.oniceconnectionstatechange = null;
        pc.onsignalingstatechange = null;
        pc.onicegatheringstatechange = null;
        pc.onnegotiationneeded = null;
        pc.close();
        this.pc = null;

        if (this.outputElement.srcObject) {
            this.outputElement.srcObject.getTracks().forEach(track => track.stop());
        }

        if (this.resetOutputElement) this.resetOutputElement();
    }

    async restartConnection() {
        await this.closeConnection();
        await this.startConnection();
    }

    relayCandidate(candidate) {
        return this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
}
