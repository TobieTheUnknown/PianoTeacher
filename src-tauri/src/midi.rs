// ── Desktop implementation (Windows, macOS, Linux) ──────────────────────────
#[cfg(not(target_os = "android"))]
mod desktop {
    use midir::{MidiInput, MidiInputConnection};
    use parking_lot::Mutex;
    use serde::Serialize;
    use std::sync::Arc;
    use tauri::{AppHandle, Emitter};

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
        {
            let mut midi_state = state.lock();
            if midi_state.connection.is_some() {
                midi_state.connection = None;
                midi_state.connected_device_id = None;
            }
        }

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

        let app_clone = app.clone();
        let connection_name = format!("piano-teacher-{}-{}",
            device_idx,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        );

        log::info!("Using connection name: {}", connection_name);

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
                        let _ = app_clone.emit("midi-message", midi_msg);
                    }
                },
                (),
            )
            .map_err(|e| {
                log::error!("Failed to connect to MIDI port '{}': {}", port_name, e);
                format!("Failed to connect to device '{}': {}", port_name, e)
            })?;

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
}

// ── Android implementation via JNI (android.media.midi) ─────────────────────
#[cfg(target_os = "android")]
mod android {
    use jni::objects::{JObject, JString, JValue};
    use jni::JNIEnv;
    use serde::{Deserialize, Serialize};
    use tauri::{AppHandle, Emitter};

    #[derive(Debug, Clone, Serialize, Deserialize)]
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

    /// Helper to get the Android Activity and call MidiHelper methods via JNI
    fn with_jni<F, R>(callback: F) -> Result<R, String>
    where
        F: FnOnce(&mut JNIEnv, &JObject) -> Result<R, String>,
    {
        let ctx = ndk_context::android_context();
        let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }
            .map_err(|e| format!("Failed to get JavaVM: {}", e))?;
        let mut env = vm
            .attach_current_thread()
            .map_err(|e| format!("Failed to attach thread: {}", e))?;
        let activity = unsafe { JObject::from_raw(ctx.context().cast()) };
        callback(&mut env, &activity)
    }

    /// Find an app class using the Activity's class loader.
    ///
    /// `env.find_class()` on a native (non-Java) thread only has access to the
    /// system class loader, which cannot see app-defined classes.  We must go
    /// through `activity.getClassLoader().loadClass(name)` instead.
    /// We also clear any pending Java exception so it never leaks as a FATAL.
    fn find_app_class<'a>(
        env: &mut JNIEnv<'a>,
        activity: &JObject,
        class_name: &str,
    ) -> Result<jni::objects::JClass<'a>, String> {
        // Convert JNI-style slashes to Java dots: "com/foo/Bar" -> "com.foo.Bar"
        let dotted = class_name.replace('/', ".");
        let j_name = env
            .new_string(&dotted)
            .map_err(|e| format!("Failed to create class name string: {}", e))?;

        let class_loader = env
            .call_method(activity, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])
            .and_then(|v| v.l())
            .map_err(|e| {
                let _ = env.exception_clear();
                e
            })
            .map_err(|e| format!("Failed to get ClassLoader: {}", e))?;

        let class_obj = env
            .call_method(
                &class_loader,
                "loadClass",
                "(Ljava/lang/String;)Ljava/lang/Class;",
                &[jni::objects::JValue::Object(&j_name)],
            )
            .and_then(|v| v.l())
            .map_err(|e| {
                let _ = env.exception_clear();
                e
            })
            .map_err(|e| format!("Class '{}' not found via app ClassLoader: {}", dotted, e))?;

        Ok(jni::objects::JClass::from(class_obj))
    }

    #[tauri::command]
    pub async fn get_midi_devices() -> Result<Vec<MidiDevice>, String> {
        with_jni(|env, activity| {
            // Call MidiHelper.getDevices(activity) static method
            let helper_class = find_app_class(env, activity, "com/pianoteacher/app/MidiHelper")?;

            let result = env
                .call_static_method(
                    &helper_class,
                    "getDevices",
                    "(Landroid/content/Context;)Ljava/lang/String;",
                    &[JValue::Object(activity)],
                )
                .map_err(|e| format!("Failed to call getDevices: {}", e))?;

            let jstr = JString::from(result.l().map_err(|e| format!("Bad return type: {}", e))?);
            let json: String = env
                .get_string(&jstr)
                .map_err(|e| format!("Failed to get string: {}", e))?
                .into();

            let devices: Vec<MidiDevice> =
                serde_json::from_str(&json).map_err(|e| format!("Failed to parse JSON: {}", e))?;

            Ok(devices)
        })
    }

    #[tauri::command]
    pub async fn connect_midi_device(
        app: AppHandle,
        device_id: String,
    ) -> Result<(), String> {
        // Store a global reference to the AppHandle for the MIDI callback
        // The Kotlin side will call back via JNI when MIDI messages arrive
        let _ = app; // AppHandle is used by the JNI callback registered in MidiHelper

        with_jni(|env, activity| {
            let helper_class = find_app_class(env, activity, "com/pianoteacher/app/MidiHelper")?;

            let j_device_id = env
                .new_string(&device_id)
                .map_err(|e| format!("Failed to create string: {}", e))?;

            env.call_static_method(
                &helper_class,
                "connect",
                "(Landroid/content/Context;Ljava/lang/String;)V",
                &[JValue::Object(activity), JValue::Object(&j_device_id)],
            )
            .map_err(|e| format!("Failed to connect: {}", e))?;

            Ok(())
        })
    }

    #[tauri::command]
    pub async fn disconnect_midi_device() -> Result<(), String> {
        with_jni(|env, activity| {
            let helper_class = find_app_class(env, activity, "com/pianoteacher/app/MidiHelper")?;

            env.call_static_method(&helper_class, "disconnect", "()V", &[])
                .map_err(|e| format!("Failed to disconnect: {}", e))?;

            Ok(())
        })
    }

    #[tauri::command]
    pub async fn get_connected_device() -> Result<Option<String>, String> {
        with_jni(|env, activity| {
            let helper_class = find_app_class(env, activity, "com/pianoteacher/app/MidiHelper")?;

            let result = env
                .call_static_method(
                    &helper_class,
                    "getConnectedDeviceId",
                    "()Ljava/lang/String;",
                    &[],
                )
                .map_err(|e| format!("Failed to get connected device: {}", e))?;

            let obj = result
                .l()
                .map_err(|e| format!("Bad return type: {}", e))?;

            if obj.is_null() {
                Ok(None)
            } else {
                let jstr = JString::from(obj);
                let id: String = env
                    .get_string(&jstr)
                    .map_err(|e| format!("Failed to get string: {}", e))?
                    .into();
                Ok(Some(id))
            }
        })
    }

    /// Called from Kotlin via JNI when a MIDI message is received
    #[no_mangle]
    pub extern "system" fn Java_com_pianoteacher_app_MidiHelper_onMidiMessage(
        _env: JNIEnv,
        _class: jni::objects::JClass,
        status: jni::sys::jint,
        note: jni::sys::jint,
        velocity: jni::sys::jint,
        timestamp: jni::sys::jlong,
    ) {
        let midi_msg = MidiMessage {
            status: status as u8,
            note: note as u8,
            velocity: velocity as u8,
            timestamp: timestamp as f64,
        };

        // Emit to the frontend via Tauri's global app handle
        // This requires the app handle to be accessible globally
        if let Some(app) = crate::get_app_handle() {
            let _ = app.emit("midi-message", midi_msg);
        }
    }
}

// ── Re-export the active platform module ────────────────────────────────────
#[cfg(not(target_os = "android"))]
pub use desktop::*;

#[cfg(target_os = "android")]
pub use android::*;
