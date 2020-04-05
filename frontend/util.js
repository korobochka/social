function distance(location1, location2) {
    return Math.hypot(location1.x - location2.x, location1.y - location2.y);
}

function boundedCloseness(dist, minDistance, maxDistance) {
    if (dist > maxDistance) {
        return 0;
    } else if (dist < minDistance) {
        return 1;
    } else {
        return 1.0 - (dist - minDistance) / (maxDistance - minDistance);
    }
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

// https://github.com/epoberezkin/fast-deep-equal MIT license
function deepEqual(a, b) {
    if (a === b) return true;

    if (a && b && typeof a == 'object' && typeof b == 'object') {
        if (a.constructor !== b.constructor) return false;

        var length, i, keys;
        if (Array.isArray(a)) {
            length = a.length;
            if (length != b.length) return false;
            for (i = length; i-- !== 0;)
                if (!equal(a[i], b[i])) return false;
            return true;
        }


        if ((a instanceof Map) && (b instanceof Map)) {
            if (a.size !== b.size) return false;
            for (i of a.entries())
                if (!b.has(i[0])) return false;
            for (i of a.entries())
                if (!equal(i[1], b.get(i[0]))) return false;
            return true;
        }

        if ((a instanceof Set) && (b instanceof Set)) {
            if (a.size !== b.size) return false;
            for (i of a.entries())
                if (!b.has(i[0])) return false;
            return true;
        }

        if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
            length = a.length;
            if (length != b.length) return false;
            for (i = length; i-- !== 0;)
                if (a[i] !== b[i]) return false;
            return true;
        }


        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;

        for (i = length; i-- !== 0;)
            if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

        for (i = length; i-- !== 0;) {
            var key = keys[i];

            if (!deepEqual(a[key], b[key])) return false;
        }

        return true;
    }

    // true if both NaN, false otherwise
    return a !== a && b !== b;
}


class Observable {
    constructor(value) {
        this.value = value;
        this.id = 0;
        this.subscriptions = {};
    }

    subscribe(fun, noImmediate) {
        const id = this.id++;
        this.subscriptions[id] = fun;
        if (!noImmediate) fun(this.value);
        return () => {
            delete this.subscriptions[id];
        };
    }

    setValue(newValue) {
        const oldValue = this.value;
        this.value = newValue;
        if (!deepEqual(oldValue, newValue)) Object.values(this.subscriptions).forEach(f => f(newValue));
    }

    getValue() {
        return this.value;
    }
}

class Subscriber {
    subscribe(observable, handler, noImmediate) {
        if (this._subscriptions === undefined) this._subscriptions = [];
        this._subscriptions.push(observable.subscribe(handler, noImmediate));
    }

    destroy() {
        if (this._subscriptions !== undefined) this._subscriptions.forEach(unsub => unsub());
    }

    autorun(observables, handler) {
        const onUpdate = () => {
            const values = observables.map(o => {
                if (o instanceof Observable) return o.getValue();
                else return o;
            });
            return handler(...values);
        };
        observables.forEach(o => {
            if (o instanceof Observable) this.subscribe(o, onUpdate, true);
        });
        onUpdate();
    }

    synchronize(observable, withAnother) {
        this.subscribe(observable, value => withAnother.setValue(value));
    }
}