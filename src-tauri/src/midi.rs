use midir::{MidiInput, MidiInputConnection};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize)]
pub struct MidiDevice {
    pub id: String,
    pub name: String,
    pub manufacturer: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MidiMessage {
    pub status: u8,
    pub note: u8,
    pub velocity: u8,
    pub timestamp: f64,
}

pub struct MidiState {
    pub connection: Option<MidiInputConnection<()>>,
    pub connected_device_id: Option<String>,
}

impl MidiState {
    pub fn new() -> Self {
        Self {
            connection: None,
            connected_device_id: None,
        }
    }
}

#[tauri::command]
pub async fn get_midi_devices() -> Result<Vec<MidiDevice>, String> {
    let midi_in = MidiInput::new("Piano Teacher")
        .map_err(|e| format!("Failed to create MIDI input: {}", e))?;

    let mut devices = Vec::new();
    let ports = midi_in.ports();

    for (idx, port) in ports.iter().enumerate() {
        let name = midi_in
            .port_name(port)
            .unwrap_or_else(|_| format!("Unknown Device {}", idx));

        devices.push(MidiDevice {
            id: format!("midi-{}", idx),
            name: name.clone(),
            manufacturer: "Unknown".to_string(),
        });
    }

    Ok(devices)
}

#[tauri::command]
pub async fn connect_midi_device(
    app: AppHandle,
    device_id: String,
    state: tauri::State<'_, Arc<Mutex<MidiState>>>,
) -> Result<(), String> {
    // Disconnect existing connection
    {
        let mut midi_state = state.lock();
        if midi_state.connection.is_some() {
            midi_state.connection = None;
            midi_state.connected_device_id = None;
        }
    }

    // Parse device index from ID
    let device_idx = device_id
        .strip_prefix("midi-")
        .and_then(|s| s.parse::<usize>().ok())
        .ok_or_else(|| "Invalid device ID".to_string())?;

    let midi_in = MidiInput::new("Piano Teacher")
        .map_err(|e| format!("Failed to create MIDI input: {}", e))?;

    let ports = midi_in.ports();
    let port = ports
        .get(device_idx)
        .ok_or_else(|| "Device not found".to_string())?;

    let port_name = midi_in
        .port_name(port)
        .unwrap_or_else(|_| "Unknown".to_string());

    log::info!("Attempting to connect to port: {} (index {})", port_name, device_idx);

    // Clone app handle for the callback
    let app_clone = app.clone();

    // Use a unique connection name with timestamp to avoid conflicts
    let connection_name = format!("piano-teacher-{}-{}",
        device_idx,
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    );

    log::info!("Using connection name: {}", connection_name);

    // Connect to the MIDI device
    let connection = midi_in
        .connect(
            port,
            &connection_name,
            move |_timestamp, message, _| {
                if message.len() >= 3 {
                    let midi_msg = MidiMessage {
                        status: message[0],
                        note: message[1],
                        velocity: message[2],
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as f64,
                    };

                    // Emit event to frontend
                    let _ = app_clone.emit("midi-message", midi_msg);
                }
            },
            (),
        )
        .map_err(|e| {
            log::error!("Failed to connect to MIDI port '{}': {}", port_name, e);
            format!("Failed to connect to device '{}': {}", port_name, e)
        })?;

    // Store connection in state
    {
        let mut midi_state = state.lock();
        midi_state.connection = Some(connection);
        midi_state.connected_device_id = Some(device_id.clone());
    }

    log::info!("Connected to MIDI device: {}", port_name);
    Ok(())
}

#[tauri::command]
pub async fn disconnect_midi_device(
    state: tauri::State<'_, Arc<Mutex<MidiState>>>,
) -> Result<(), String> {
    let mut midi_state = state.lock();
    midi_state.connection = None;
    midi_state.connected_device_id = None;
    log::info!("Disconnected MIDI device");
    Ok(())
}

#[tauri::command]
pub async fn get_connected_device(
    state: tauri::State<'_, Arc<Mutex<MidiState>>>,
) -> Result<Option<String>, String> {
    let midi_state = state.lock();
    Ok(midi_state.connected_device_id.clone())
}
