/** Subscribe while the settings panel is open, including initialization completion. */
export function observeMidiSettings(service, onChange) {
    let active = true;
    let refreshing = false;
    let pending = null;
    const publish = () => {
        if (active) onChange({
            devices: service.getDevices(),
            device: service.getActiveDevice(),
            settings: service.getSettings(),
            supported: service.isSupported,
            refreshing,
        });
    };
    const events = ['devicesChanged', 'deviceConnected', 'deviceDisconnected', 'settingsChanged', 'statusChanged'];
    events.forEach(event => service.addEventListener(event, publish));
    publish();
    return {
        refresh() {
            if (!active) return Promise.resolve(false);
            if (pending) return pending;
            refreshing = true;
            publish();
            pending = Promise.resolve().then(() => active ? service.refreshDevices() : false)
                .catch(() => false).finally(() => {
                    pending = null;
                    refreshing = false;
                    publish();
                });
            return pending;
        },
        dispose() {
            active = false;
            events.forEach(event => service.removeEventListener(event, publish));
        },
    };
}
