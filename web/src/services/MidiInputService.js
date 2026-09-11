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

import { normalizedMidiTimestamp } from '../utils/midiTiming.js';

// Tauri APIs loaded dynamically to avoid crashes on Android WebView startup
let invoke = null;
let listen = null;

async function loadTauriAPIs() {
    try {
        if (!invoke) {
            const core = await import('@tauri-apps/api/core');
            invoke = core.invoke;
        }
        if (!listen) {
            const event = await import('@tauri-apps/api/event');
            listen = event.listen;
        }
    } catch (err) {
        console.warn('Failed to load Tauri APIs (non-fatal):', err.message);
        throw err; // Re-throw so initTauriMidi's catch block handles fallback
    }
}

// Detect if running in Tauri environment
// In Tauri v2, check for TAURI_PLATFORM env variable instead of window.__TAURI__
const isTauri = () => {
    if (typeof window === 'undefined') return false;
    // Check for Tauri v2 environment variables or internal object
    return import.meta.env?.TAURI_PLATFORM !== undefined ||
           import.meta.env?.TAURI_FAMILY !== undefined ||
           window.__TAURI_INTERNALS__ !== undefined;
};

export class MidiInputService {
    constructor({ nativeInvoke = (...args) => invoke(...args), requestAccess = () => globalThis.navigator?.requestMIDIAccess?.({ sysex: false }), storage, autoInit = true, now = () => performance.now() } = {}) {
        this._invoke = nativeInvoke;
        this._requestAccess = requestAccess;
        this._storage = () => storage ?? globalThis.localStorage;
        this._now = now;
        this._initPromise = null;
        this._connectionGeneration = 0;
        this._refreshGeneration = 0;
        this._nativeQueue = Promise.resolve();
        this._nativePending = 0;
        this.midiAccess = null;
        this.activeDevice = null;
        this.listeners = new Map(); // Event listeners
        this.monitorListeners = new Set(); // For real-time visualization
        this.devices = [];
        this.isSupported = false;
        this.useTauriMidi = false; // Flag to use native MIDI in Tauri
        this.tauriEventUnlisten = null; // Cleanup function for Tauri event listener
        this.initialized = false; // Track initialization state

        // Settings (stored in localStorage) — wrapped in try/catch for Android WebView safety
        this.settings = this._loadSettings();

        // Defer initialization to avoid crashing Android WebView on startup.
        // Use setTimeout(0) so the event loop processes Tauri's internals first.
        if (autoInit && typeof window !== 'undefined') {
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

    _readStored(key) {
        try { return this._storage()?.getItem(key) ?? null; }
        catch { return null; }
    }

    _persistSetting(setting) {
        const keys = {
            selectedDeviceId: 'midi-selected-device', velocitySensitivity: 'midi-velocity-sensitivity',
            latencyCompensation: 'midi-latency', noteOnThreshold: 'midi-note-on-threshold',
            midiVolume: 'midi-volume', enabledChannels: 'midi-enabled-channels',
        };
        const key = Object.hasOwn(keys, setting) ? keys[setting] : null;
        if (!key) return;
        const value = this.settings[setting];
        try {
            if (value === null) this._storage()?.removeItem(key);
            else this._storage()?.setItem(key, setting === 'enabledChannels' ? JSON.stringify(value) : String(value));
        } catch { /* Persistence is optional; the running connection must remain usable. */ }
    }

    _normalizeSettings(values) {
        const number = (value, fallback, min, max, integer = false) => {
            const parsed = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')
                ? Number(value) : NaN;
            const bounded = Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
            return integer ? Math.round(bounded) : bounded;
        };
        let channels = Array.isArray(values.enabledChannels)
            ? [...new Set(values.enabledChannels.filter(channel => Number.isInteger(channel) && channel >= 0 && channel < 16))]
            : Array.from({ length: 16 }, (_, index) => index);
        if (Array.isArray(values.enabledChannels) && values.enabledChannels.length > 0 && channels.length === 0) {
            channels = Array.from({ length: 16 }, (_, index) => index);
        }
        return {
            selectedDeviceId: typeof values.selectedDeviceId === 'string' && values.selectedDeviceId.trim() &&
                !['null', 'undefined'].includes(values.selectedDeviceId) ? values.selectedDeviceId : null,
            velocitySensitivity: number(values.velocitySensitivity, 1, 0.5, 2),
            latencyCompensation: number(values.latencyCompensation, 0, -100, 100, true),
            noteOnThreshold: number(values.noteOnThreshold, 10, 0, 127, true),
            midiVolume: number(values.midiVolume, 70, 0, 100, true),
            enabledChannels: channels,
        };
    }

    _loadSettings() {
        let enabledChannels;
        try { enabledChannels = JSON.parse(this._readStored('midi-enabled-channels')); }
        catch { /* A malformed field must not discard the other saved settings. */ }
        return this._normalizeSettings({
            selectedDeviceId: this._readStored('midi-selected-device'),
            velocitySensitivity: this._readStored('midi-velocity-sensitivity'),
            latencyCompensation: this._readStored('midi-latency'),
            noteOnThreshold: this._readStored('midi-note-on-threshold'),
            midiVolume: this._readStored('midi-volume'),
            enabledChannels,
        });
    }

    init() {
        if (this._initPromise) return this._initPromise;
        if (this.initialized) return Promise.resolve(this.isSupported);
        this._initPromise = this._initialize().finally(() => {
            this._initPromise = null;
            this.notifyListeners('statusChanged', { isSupported: this.isSupported, initialized: this.initialized });
        });
        return this._initPromise;
    }

    async _initialize() {
        try {
            if (isTauri()) return await this.initTauriMidi();
            return await this._initWebMidi();
        } catch (error) {
            this.initialized = false;
            console.warn('MIDI initialization failed:', error);
            return false;
        }
    }

    async _initWebMidi() {
        try {
            const access = this._requestAccess();
            if (!access) {
                this.isSupported = false;
                this.initialized = true;
                return false;
            }
            // API availability and permission are different states. A denied
            // request remains explicitly retryable; no timer retries it.
            this.isSupported = true;
            this.midiAccess = await access;
            this.midiAccess.onstatechange = event => this.handleStateChange(event);
            this.initialized = true;
            this.refreshDevices();
            return true;
        } catch (error) {
            this.initialized = false;
            console.warn('Failed to get MIDI access:', error);
            return false;
        }
    }

    async initTauriMidi() {
        try {
            await loadTauriAPIs();
            this.useTauriMidi = true;
            this.isSupported = true;
            if (!this.tauriEventUnlisten) {
                this.tauriEventUnlisten = await listen('midi-message', event => this.handleTauriMidiMessage(event.payload));
            }
            await this.refreshDevicesTauri();
            this.initialized = true;
            return true;
        } catch (error) {
            console.warn('Native MIDI initialization failed:', error);
            this.tauriEventUnlisten?.();
            this.tauriEventUnlisten = null;
            this.useTauriMidi = false;
            return this._initWebMidi();
        }
    }

    _clearActiveDevice() {
        if (!this.activeDevice) return;
        if (!this.useTauriMidi) this.activeDevice.onmidimessage = null;
        this.activeDevice = null;
        this.notifyListeners('deviceDisconnected', null);
    }

    _rememberDevice(deviceId) {
        this.settings.selectedDeviceId = deviceId;
        this._persistSetting('selectedDeviceId');
    }

    _queueNative(operation) {
        this._nativePending++;
        const result = this._nativeQueue.then(operation).catch(error => {
            console.warn('Native MIDI operation failed:', error);
            return false;
        }).finally(() => { this._nativePending--; });
        this._nativeQueue = result;
        return result;
    }

    async refreshDevicesTauri() {
        const generation = ++this._refreshGeneration;
        try {
            const devices = await this._invoke('get_midi_devices');
            if (generation !== this._refreshGeneration) return;
            this.devices = devices.map(device => ({
                ...device, state: 'connected', connection: 'closed', type: 'input',
            }));
            this.notifyListeners('devicesChanged', this.getDevices());
            if (this.activeDevice && !this.devices.some(device => device.id === this.activeDevice.id)) {
                await this.disconnect({ preservePreference: true });
            }
            if (generation === this._refreshGeneration && !this.activeDevice && !this._nativePending &&
                this.devices.some(device => device.id === this.settings.selectedDeviceId)) {
                await this.selectDeviceTauri(this.settings.selectedDeviceId);
            }
        } catch (error) {
            console.warn('Failed to refresh native MIDI devices:', error);
        }
    }

    selectDeviceTauri(deviceId) {
        const device = this.devices.find(item => item.id === deviceId);
        if (!device) return Promise.resolve(false);
        const generation = ++this._connectionGeneration;
        this._clearActiveDevice();
        return this._queueNative(async () => {
            if (generation !== this._connectionGeneration) return false;
            // Serialize hardware operations as well as state commits. Ignoring a
            // stale result alone would leave the backend connected to that port.
            await this._invoke('disconnect_midi_device');
            if (generation !== this._connectionGeneration) return false;
            await this._invoke('connect_midi_device', { deviceId });
            if (generation !== this._connectionGeneration) return false;
            this.activeDevice = { ...device, state: 'connected', connection: 'open' };
            this._rememberDevice(deviceId);
            this.notifyListeners('deviceConnected', this.getActiveDevice());
            return true;
        });
    }

    handleTauriMidiMessage({ status, note, velocity }) {
        if (this.useTauriMidi && !this.activeDevice) return;
        // Rust sends wall-clock epoch milliseconds, not the browser time origin.
        // Receipt time avoids clock jumps and guesses about native/browser drift;
        // IPC delivery latency is included in the user's MIDI calibration.
        const receivedAt = this._now();
        this.handleMidiMessage({ data: [status, note, velocity], timeStamp: receivedAt }, receivedAt);
    }

    refreshDevices() {
        if (this.useTauriMidi) return this.refreshDevicesTauri();
        if (!this.midiAccess) return this.init();
        this.devices = [...this.midiAccess.inputs.values()]
            .filter(input => input.state !== 'disconnected')
            .map(input => ({
                id: input.id, name: input.name || 'Unknown Device', manufacturer: input.manufacturer || 'Unknown',
                state: input.state, connection: input.connection, type: input.type,
            }));
        if (this.activeDevice && !this.devices.some(device => device.id === this.activeDevice.id)) {
            this.disconnect({ preservePreference: true });
        }
        this.notifyListeners('devicesChanged', this.getDevices());
        if (!this.activeDevice && this.devices.some(device => device.id === this.settings.selectedDeviceId)) {
            this.selectDevice(this.settings.selectedDeviceId);
        }
    }

    selectDevice(deviceId) {
        if (this.useTauriMidi) return this.selectDeviceTauri(deviceId);
        const input = this.midiAccess?.inputs.get(deviceId);
        if (!input || input.state === 'disconnected') return false;
        ++this._connectionGeneration;
        this._clearActiveDevice();
        this.activeDevice = input;
        this.activeDevice.onmidimessage = event => this.handleMidiMessage(event);
        this._rememberDevice(deviceId);
        this.notifyListeners('deviceConnected', this.getActiveDevice());
        return true;
    }

    disconnect({ preservePreference = false } = {}) {
        const generation = ++this._connectionGeneration;
        if (!preservePreference) this._rememberDevice(null);
        this._clearActiveDevice();
        if (!this.useTauriMidi) return Promise.resolve(true);
        return this._queueNative(async () => {
            if (generation !== this._connectionGeneration) return false;
            await this._invoke('disconnect_midi_device');
            return generation === this._connectionGeneration;
        });
    }

    handleStateChange(event) {
        if (this.activeDevice && event.port.id === this.activeDevice.id && event.port.state === 'disconnected') {
            this.disconnect({ preservePreference: true });
        }
        return this.refreshDevices();
    }

    handleMidiMessage(event, receivedAt = this._now()) {
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

        const timestamp = normalizedMidiTimestamp(event.timeStamp, receivedAt, this.settings.latencyCompensation);

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
            // CC64 (damper/sustain pedal) gets its own event so useMidiAudio
            // can suppress noteOffs while the pedal is held.
            eventType = note === 64 ? 'sustainPedal' : 'controlChange';
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
        this.settings = this._normalizeSettings({ ...this.settings, ...newSettings });
        Object.keys(newSettings).forEach(setting => this._persistSetting(setting));
        this.notifyListeners('settingsChanged', this.getSettings());
    }

    getSettings() {
        return { ...this.settings, enabledChannels: [...this.settings.enabledChannels] };
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
        return import.meta.env?.TAURI_PLATFORM === 'android' ||
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
