function distance(location1, location2) {
    return Math.hypot(location1.x - location2.x, location1.y - location2.y);
}

function setSink(element, sinkId) {
    if (typeof element.sinkId !== 'undefined') {
        element.setSinkId(sinkId)
            .then(() => {
                // console.log(`Success, audio output device attached: ${sinkId}`);
            })
            .catch(error => {
                let errorMessage = error;
                if (error.name === 'SecurityError') {
                    errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
                }
                console.error(errorMessage);
                // Jump back to first output device in the list as it's the default.
                media.audioOutputSelect.selectedIndex = 0;
            });
    } else {
        console.warn('Browser does not support output device selection.');
    }
}


class Observable {
    constructor(value) {
        this.value = value;
        this.id = 0;
        this.subscriptions = {};
    }

    subscribe(fun) {
        const id = this.id++;
        this.subscriptions[id] = fun;
        fun(this.value);
        return () => {
            this.unsubscribe(id);
        };
    }

    unsubscribe(id) {
        delete this.subscriptions[id];
    }

    setValue(newValue) {
        this.value = newValue;
        Object.values(this.subscriptions).forEach(f => f(newValue));
    }

    getValue() {
        return this.value;
    }
}