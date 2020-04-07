class ButtonToggle {
    constructor(element, iconEnabled, iconDisabled) {
        this.element = element;
        this.icon = this.element.querySelector("i.material-icons");
        this.state = new Observable(false);

        this.element.onclick = () => {
            const state = !this.state.getValue();
            this.icon.innerText = state ? iconDisabled : iconEnabled;
            this.state.setValue(state);
        };
    }
}


class Media extends Subscriber {
    constructor() {
        super();
        this.selfStream = new Observable(null);
        this.soundOutput = new Observable(null);
        this.screenStream = new Observable(null);

        this.buttonMuteSelf = new ButtonToggle(document.getElementById("header-button-mic"), "mic", "mic_off");
        this.buttonDisableCamera = new ButtonToggle(document.getElementById("header-button-camera"), "videocam", "videocam_off");

        this.autorun([this.selfStream, this.buttonMuteSelf.state, this.buttonDisableCamera.state],
            (selfStream, soundMuted, cameraDisabled) => {
                if (selfStream) {
                    selfStream.getAudioTracks().forEach(track => track.enabled = !soundMuted);
                    selfStream.getVideoTracks().forEach(track => track.enabled = !cameraDisabled);
                }
            });

        this.audioInputSelect = document.querySelector('select#audioSource');
        this.audioOutputSelect = document.querySelector('select#audioOutput');
        this.videoSelect = document.querySelector('select#videoSource');
        this.selectors = [this.audioInputSelect, this.audioOutputSelect, this.videoSelect];
        this.audioOutputSelect.disabled = !('sinkId' in HTMLMediaElement.prototype);

        this.audioInputSelect.onchange = this.startVideo.bind(this);
        this.videoSelect.onchange = this.startVideo.bind(this);
        this.audioOutputSelect.onchange = this.changeAudioDestination.bind(this);

        this.shareScreen = document.querySelector('input#shareScreen');
        this.shareScreen.onclick = async () => {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always"
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            this.shareScreen.disabled = true;
            stream.getVideoTracks()[0].onended = () => {
                this.shareScreen.disabled = false;
                this.screenStream.setValue(null);
            };
            this.screenStream.setValue(stream);
        };
    }

    async startVideo() {
        const selfStream = this.selfStream.getValue();
        if (selfStream) {
            selfStream.getTracks().forEach(track => {
                track.stop();
            });
        }

        const audioSource = this.audioInputSelect.value;
        const videoSource = this.videoSelect.value;
        const constraints = {
            audio: {
                deviceId: audioSource ? {exact: audioSource} : undefined,
                echoCancellation: true,
                noiseSuppression: true
            },
            video: {
                deviceId: videoSource ? {exact: videoSource} : undefined,
                /*height: {
                    ideal: maxSize * 2
                },
                width: {
                    ideal: maxSize * 2
                }*/
            }
        };
        this.selfStream.setValue(await navigator.mediaDevices.getUserMedia(constraints));

        await this.getDevices();
    }

    async getDevices() {
        const deviceInfos = await navigator.mediaDevices.enumerateDevices();
        const values = this.selectors.map(select => select.value);
        this.selectors.forEach(select => {
            while (select.firstChild) {
                select.removeChild(select.firstChild);
            }
        });
        for (let i = 0; i !== deviceInfos.length; ++i) {
            const deviceInfo = deviceInfos[i];
            const option = document.createElement('option');
            option.value = deviceInfo.deviceId;
            if (deviceInfo.kind === 'audioinput') {
                option.text = deviceInfo.label || `microphone ${this.audioInputSelect.length + 1}`;
                this.audioInputSelect.appendChild(option);
            } else if (deviceInfo.kind === 'audiooutput') {
                option.text = deviceInfo.label || `speaker ${this.audioOutputSelect.length + 1}`;
                this.audioOutputSelect.appendChild(option);
            } else if (deviceInfo.kind === 'videoinput') {
                option.text = deviceInfo.label || `camera ${this.videoSelect.length + 1}`;
                this.videoSelect.appendChild(option);
            } else {
                console.log('Some other kind of source/device: ', deviceInfo);
            }
        }
        this.selectors.forEach((select, selectorIndex) => {
            if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
                select.value = values[selectorIndex];
            }
        });
        this.changeAudioDestination();
    }

    changeAudioDestination() {
        this.soundOutput.setValue(this.audioOutputSelect.value);
    }
}
