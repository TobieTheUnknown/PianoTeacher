mod midi;

use parking_lot::Mutex;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Initialize MIDI state
  let midi_state = Arc::new(Mutex::new(midi::MidiState::new()));

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .manage(midi_state)
    .invoke_handler(tauri::generate_handler![
      midi::get_midi_devices,
      midi::connect_midi_device,
      midi::disconnect_midi_device,
      midi::get_connected_device,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
