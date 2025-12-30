/**
 * MidiInputService - Centralized MIDI input management
 *
 * Features:
 * - Automatic detection of MIDI devices
 * - Device selection and connection state
 * - Event handling with velocity sensitivity
 * - Latency compensation
 * - Real-time monitoring
 */

class MidiInputService {
    constructor() {
        this.midiAccess = null;
        this.activeDevice = null;
        this.listeners = new Map(); // Event listeners
        this.monitorListeners = new Set(); // For real-time visualization
        this.devices = [];
        this.isSupported = false;

        // Settings (stored in localStorage)
        this.settings = {
            selectedDeviceId: localStorage.getItem('midi-selected-device') || null,
            velocitySensitivity: parseFloat(localStorage.getItem('midi-velocity-sensitivity')) || 1.0,
            latencyCompensation: parseInt(localStorage.getItem('midi-latency')) || 0,
            noteOnThreshold: parseInt(localStorage.getItem('midi-note-on-threshold')) || 10,
            midiVolume: parseInt(localStorage.getItem('midi-volume')) || 70, // Default 70%
            enabledChannels: JSON.parse(localStorage.getItem('midi-enabled-channels') || '[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]')
        };

        this.init();
    }

    async init() {
        if (!navigator.requestMIDIAccess) {
            console.warn('Web MIDI API not supported in this browser');
            this.isSupported = false;
            return;
        }

        this.isSupported = true;

        try {
            this.midiAccess = await navigator.requestMIDIAccess();
            console.log('MIDI Access granted');

            // Listen for device connection/disconnection
            this.midiAccess.onstatechange = (e) => this.handleStateChange(e);

            // Initial scan of devices
            this.refreshDevices();

            // Auto-connect to previously selected device
            if (this.settings.selectedDeviceId) {
                this.selectDevice(this.settings.selectedDeviceId);
            }

        } catch (error) {
            console.error('Failed to get MIDI access:', error);
            this.isSupported = false;
        }
    }

    refreshDevices() {
        if (!this.midiAccess) return;

        this.devices = [];
        const inputs = this.midiAccess.inputs.values();

        for (let input of inputs) {
            this.devices.push({
                id: input.id,
                name: input.name || 'Unknown Device',
                manufacturer: input.manufacturer || 'Unknown',
                state: input.state,
                connection: input.connection,
                type: input.type
            });
        }

        console.log('MIDI Devices detected:', this.devices);
        this.notifyListeners('devicesChanged', this.devices);
    }

    selectDevice(deviceId) {
        if (!this.midiAccess) return false;

        // Disconnect previous device
        if (this.activeDevice) {
            this.activeDevice.onmidimessage = null;
        }

        const input = this.midiAccess.inputs.get(deviceId);

        if (!input) {
            console.warn('Device not found:', deviceId);
            return false;
        }

        this.activeDevice = input;
        this.settings.selectedDeviceId = deviceId;
        localStorage.setItem('midi-selected-device', deviceId);

        // Attach message handler
        this.activeDevice.onmidimessage = (event) => this.handleMidiMessage(event);

        console.log('Connected to MIDI device:', input.name);
        this.notifyListeners('deviceConnected', {
            id: input.id,
            name: input.name,
            manufacturer: input.manufacturer
        });

        return true;
    }

    disconnect() {
        if (this.activeDevice) {
            this.activeDevice.onmidimessage = null;
            this.activeDevice = null;
            this.settings.selectedDeviceId = null;
            localStorage.removeItem('midi-selected-device');
            this.notifyListeners('deviceDisconnected', null);
        }
    }

    handleStateChange(event) {
        console.log('MIDI State changed:', event.port.name, event.port.state);
        this.refreshDevices();

        // If active device was disconnected, clear it
        if (this.activeDevice && event.port.id === this.activeDevice.id && event.port.state === 'disconnected') {
            this.disconnect();
        }
    }

    handleMidiMessage(event) {
        const [status, note, velocity] = event.data;

        // Validate MIDI data
        if (status === undefined || note === undefined || velocity === undefined) {
            return;
        }

        const command = status & 0xf0;
        const channel = status & 0x0f;

        // Filter by enabled channels
        if (!this.settings.enabledChannels.includes(channel)) {
            return;
        }

        const timestamp = event.timeStamp + this.settings.latencyCompensation;

        let eventType = null;
        let processedVelocity = velocity;

        // Parse MIDI command
        if (command === 144 && velocity > 0) {
            // Note On
            if (velocity < this.settings.noteOnThreshold) {
                // Too soft, ignore
                return;
            }
            eventType = 'noteOn';
            processedVelocity = Math.min(127, Math.round(velocity * this.settings.velocitySensitivity));
        } else if (command === 128 || (command === 144 && velocity === 0)) {
            // Note Off
            eventType = 'noteOff';
        } else if (command === 176) {
            // Control Change
            eventType = 'controlChange';
        } else if (command === 224) {
            // Pitch Bend
            eventType = 'pitchBend';
        }

        const midiEvent = {
            type: eventType,
            note,
            velocity: processedVelocity,
            channel,
            timestamp,
            raw: event.data
        };

        // Only notify if we have a valid event type
        if (eventType) {
            // Notify all registered listeners
            this.notifyListeners(eventType, midiEvent);
        }

        // Notify monitor listeners (for visualization)
        this.notifyMonitors(midiEvent);
    }

    // Settings Management
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };

        // Persist to localStorage
        if (newSettings.selectedDeviceId !== undefined) {
            localStorage.setItem('midi-selected-device', newSettings.selectedDeviceId);
        }
        if (newSettings.velocitySensitivity !== undefined) {
            localStorage.setItem('midi-velocity-sensitivity', newSettings.velocitySensitivity.toString());
        }
        if (newSettings.latencyCompensation !== undefined) {
            localStorage.setItem('midi-latency', newSettings.latencyCompensation.toString());
        }
        if (newSettings.noteOnThreshold !== undefined) {
            localStorage.setItem('midi-note-on-threshold', newSettings.noteOnThreshold.toString());
        }
        if (newSettings.midiVolume !== undefined) {
            localStorage.setItem('midi-volume', newSettings.midiVolume.toString());
        }
        if (newSettings.enabledChannels !== undefined) {
            localStorage.setItem('midi-enabled-channels', JSON.stringify(newSettings.enabledChannels));
        }

        this.notifyListeners('settingsChanged', this.settings);
    }

    getSettings() {
        return { ...this.settings };
    }

    // Event Listener Management
    addEventListener(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType).add(callback);
    }

    removeEventListener(eventType, callback) {
        if (this.listeners.has(eventType)) {
            this.listeners.get(eventType).delete(callback);
        }
    }

    notifyListeners(eventType, data) {
        if (this.listeners.has(eventType)) {
            this.listeners.get(eventType).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in MIDI listener:', error);
                }
            });
        }
    }

    // Monitor for real-time visualization
    addMonitor(callback) {
        this.monitorListeners.add(callback);
        return () => this.monitorListeners.delete(callback); // Return cleanup function
    }

    notifyMonitors(event) {
        this.monitorListeners.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in MIDI monitor:', error);
            }
        });
    }

    // Utility methods
    getDevices() {
        return [...this.devices];
    }

    getActiveDevice() {
        if (!this.activeDevice) return null;
        return {
            id: this.activeDevice.id,
            name: this.activeDevice.name,
            manufacturer: this.activeDevice.manufacturer,
            state: this.activeDevice.state
        };
    }

    isDeviceConnected() {
        return this.activeDevice !== null && this.activeDevice.state === 'connected';
    }
}

// Singleton instance
export const midiInputService = new MidiInputService();
