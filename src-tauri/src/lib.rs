mod midi;

#[cfg(not(target_os = "android"))]
use parking_lot::Mutex;
#[cfg(not(target_os = "android"))]
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init());

  // On desktop, manage the full MIDI state with connection tracking
  #[cfg(not(target_os = "android"))]
  let builder = builder.manage(Arc::new(Mutex::new(midi::MidiState::new())));

  builder
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
