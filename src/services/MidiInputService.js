/**
 * MidiInputService - Centralized MIDI input management
 *
 * Features:
 * - Automatic detection of MIDI devices
 * - Device selection and connection state
 * - Event handling with velocity sensitivity
 * - Latency compensation
 * - Real-time monitoring
 * - Native MIDI support for Tauri desktop app
 */

// Tauri APIs loaded dynamically to avoid crashes on Android WebView startup
let invoke = null;
let listen = null;

async function loadTauriAPIs() {
    if (!invoke) {
        const core = await import('@tauri-apps/api/core');
        invoke = core.invoke;
    }
    if (!listen) {
        const event = await import('@tauri-apps/api/event');
        listen = event.listen;
    }
}

// Detect if running in Tauri environment
// In Tauri v2, check for TAURI_PLATFORM env variable instead of window.__TAURI__
const isTauri = () => {
    if (typeof window === 'undefined') return false;
    // Check for Tauri v2 environment variables or internal object
    return import.meta.env.TAURI_PLATFORM !== undefined ||
           import.meta.env.TAURI_FAMILY !== undefined ||
           window.__TAURI_INTERNALS__ !== undefined;
};

class MidiInputService {
    constructor() {
        this.midiAccess = null;
        this.activeDevice = null;
        this.listeners = new Map(); // Event listeners
        this.monitorListeners = new Set(); // For real-time visualization
        this.devices = [];
        this.isSupported = false;
        this.useTauriMidi = false; // Flag to use native MIDI in Tauri
        this.tauriEventUnlisten = null; // Cleanup function for Tauri event listener
        this.initialized = false; // Track initialization state

        // Settings (stored in localStorage)
        this.settings = {
            selectedDeviceId: localStorage.getItem('midi-selected-device') || null,
            velocitySensitivity: parseFloat(localStorage.getItem('midi-velocity-sensitivity')) || 1.0,
            latencyCompensation: parseInt(localStorage.getItem('midi-latency')) || 0,
            noteOnThreshold: parseInt(localStorage.getItem('midi-note-on-threshold')) || 10,
            midiVolume: parseInt(localStorage.getItem('midi-volume')) || 70, // Default 70%
            enabledChannels: JSON.parse(localStorage.getItem('midi-enabled-channels') || '[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]')
        };

        // Defer initialization to avoid crashing Android WebView on startup.
        // Use setTimeout(0) so the event loop processes Tauri's internals first.
        if (typeof window !== 'undefined') {
            const doInit = () => {
                setTimeout(() => {
                    this.init().catch(err => {
                        console.warn('MIDI init failed (non-fatal):', err.message);
                    });
                }, 0);
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', doInit);
            } else {
                doInit();
            }
        }
    }

    async init() {
        if (this.initialized) {
            console.log('MIDI service already initialized');
            return;
        }

        console.log('Initializing MIDI service...');
        console.log('Tauri detected:', isTauri());
        console.log('TAURI_PLATFORM:', import.meta.env.TAURI_PLATFORM);
        console.log('TAURI_FAMILY:', import.meta.env.TAURI_FAMILY);

        // Check if running in Tauri
        if (isTauri()) {
            console.log('Detected Tauri environment, using native MIDI');
            await this.initTauriMidi();
            this.initialized = true;
            return;
        }

        // Fallback to Web MIDI API
        if (!navigator.requestMIDIAccess) {
            console.warn('Web MIDI API not supported in this browser');
            this.isSupported = false;
            this.initialized = true;
            return;
        }

        this.isSupported = true;

        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            console.log('MIDI Access granted via Web MIDI API');

            // Listen for device connection/disconnection
            this.midiAccess.onstatechange = (e) => this.handleStateChange(e);

            // Initial scan of devices
            this.refreshDevices();

            // Auto-connect to previously selected device
            if (this.settings.selectedDeviceId) {
                this.selectDevice(this.settings.selectedDeviceId);
            }

            this.initialized = true;

        } catch (error) {
            console.error('Failed to get MIDI access:', error);
            this.isSupported = false;
            this.initialized = true;
        }
    }

    async initTauriMidi() {
        try {
            console.log('Initializing Tauri MIDI...');
            await loadTauriAPIs();

            this.useTauriMidi = true;
            this.isSupported = true;

            // Listen for MIDI messages from Tauri backend
            console.log('Setting up MIDI message listener...');
            this.tauriEventUnlisten = await listen('midi-message', (event) => {
                console.log('Received MIDI message from Tauri:', event.payload);
                this.handleTauriMidiMessage(event.payload);
            });

            console.log('Tauri MIDI initialized successfully');

            // Initial scan of devices
            console.log('Scanning for MIDI devices...');
            await this.refreshDevicesTauri();

            // Auto-connect to previously selected device
            if (this.settings.selectedDeviceId) {
                console.log('Auto-connecting to previously selected device:', this.settings.selectedDeviceId);
                await this.selectDeviceTauri(this.settings.selectedDeviceId);
            }

        } catch (error) {
            console.error('Failed to initialize Tauri MIDI:', error);
            console.error('Error details:', error.message, error.stack);
            this.isSupported = false;

            // Fallback to Web MIDI if Tauri MIDI fails
            console.log('Attempting fallback to Web MIDI API...');
            this.useTauriMidi = false;
            if (navigator.requestMIDIAccess) {
                try {
                    this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
                    this.isSupported = true;
                    this.midiAccess.onstatechange = (e) => this.handleStateChange(e);
                    this.refreshDevices();
                    if (this.settings.selectedDeviceId) {
                        this.selectDevice(this.settings.selectedDeviceId);
                    }
                    console.log('Fallback to Web MIDI API successful');
                } catch (fallbackError) {
                    console.error('Web MIDI API fallback also failed:', fallbackError);
                }
            }
        }
    }

    async refreshDevicesTauri() {
        try {
            const devices = await invoke('get_midi_devices');

            this.devices = devices.map(device => ({
                id: device.id,
                name: device.name,
                manufacturer: device.manufacturer,
                state: 'connected',
                connection: 'closed',
                type: 'input'
            }));

            console.log('MIDI Devices detected (Tauri):', this.devices);
            this.notifyListeners('devicesChanged', this.devices);
        } catch (error) {
            console.error('Failed to get MIDI devices from Tauri:', error);
        }
    }

    async selectDeviceTauri(deviceId) {
        try {
            // Disconnect previous device
            if (this.activeDevice) {
                await invoke('disconnect_midi_device');
            }

            // Connect to new device
            await invoke('connect_midi_device', { deviceId });

            const device = this.devices.find(d => d.id === deviceId);

            this.activeDevice = { id: deviceId, name: device?.name || 'Unknown' };
            this.settings.selectedDeviceId = deviceId;
            localStorage.setItem('midi-selected-device', deviceId);

            console.log('Connected to MIDI device (Tauri):', device?.name);
            this.notifyListeners('deviceConnected', {
                id: deviceId,
                name: device?.name || 'Unknown',
                manufacturer: device?.manufacturer || 'Unknown'
            });

            return true;
        } catch (error) {
            console.error('Failed to connect to MIDI device (Tauri):', error);
            return false;
        }
    }

    handleTauriMidiMessage(message) {
        const { status, note, velocity, timestamp } = message;

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

        const adjustedTimestamp = timestamp + this.settings.latencyCompensation;

        let eventType = null;
        let processedVelocity = velocity;

        // Parse MIDI command
        if (command === 144 && velocity > 0) {
            // Note On
            if (velocity < this.settings.noteOnThreshold) {
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
            timestamp: adjustedTimestamp,
            raw: [status, note, velocity]
        };

        // Notify listeners
        if (eventType) {
            this.notifyListeners(eventType, midiEvent);
        }

        // Notify monitors
        this.notifyMonitors(midiEvent);
    }

    refreshDevices() {
        if (this.useTauriMidi) {
            this.refreshDevicesTauri();
            return;
        }

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
        if (this.useTauriMidi) {
            return this.selectDeviceTauri(deviceId);
        }

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

    async disconnect() {
        if (this.useTauriMidi) {
            try {
                await invoke('disconnect_midi_device');
                this.activeDevice = null;
                this.settings.selectedDeviceId = null;
                localStorage.removeItem('midi-selected-device');
                this.notifyListeners('deviceDisconnected', null);
            } catch (error) {
                console.error('Failed to disconnect MIDI device (Tauri):', error);
            }
            return;
        }

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

    // Check if running on Android
    isAndroid() {
        return import.meta.env.TAURI_PLATFORM === 'android' ||
               (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent));
    }

    // Get a helpful message for Android users with no MIDI devices
    getNoDeviceHint() {
        if (this.isAndroid()) {
            return 'Connecte un clavier MIDI via un adaptateur USB-OTG';
        }
        return 'Connectez un clavier MIDI USB ou configurez un clavier virtuel';
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
