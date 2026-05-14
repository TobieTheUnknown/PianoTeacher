package com.pianoteacher.app

import android.content.Context
import android.media.midi.*
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject

/**
 * MidiHelper - Bridge between Android's MIDI API and Rust/JNI
 *
 * Provides static methods callable from Rust via JNI:
 * - getDevices(context): Enumerate connected MIDI USB devices
 * - connect(context, deviceId): Open a MIDI device and listen for messages
 * - disconnect(): Close the current connection
 * - getConnectedDeviceId(): Get the currently connected device ID
 *
 * When MIDI messages arrive, they are forwarded to Rust via the native
 * onMidiMessage() JNI callback.
 */
object MidiHelper {
    private var midiManager: MidiManager? = null
    private var openDevice: MidiDevice? = null
    private var outputPort: MidiOutputPort? = null
    private var connectedDeviceId: String? = null
    private var deviceCallback: MidiManager.DeviceCallback? = null

    init {
        System.loadLibrary("app_lib")
    }

    // Native callback to Rust
    @JvmStatic
    external fun onMidiMessage(status: Int, note: Int, velocity: Int, timestamp: Long)

    private fun ensureManager(context: Context): MidiManager {
        if (midiManager == null) {
            midiManager = context.getSystemService(Context.MIDI_SERVICE) as? MidiManager
        }
        return midiManager ?: throw IllegalStateException("MIDI not supported on this device")
    }

    /**
     * Returns a JSON string with an array of MIDI devices.
     * Called from Rust via JNI.
     */
    @JvmStatic
    fun getDevices(context: Context): String {
        val manager = try {
            ensureManager(context)
        } catch (e: Exception) {
            return "[]"
        }

        val devices = manager.devices
        val jsonArray = JSONArray()

        for (info in devices) {
            // Only include devices with input ports (they send MIDI to us)
            val inputPortCount = info.inputPortCount
            val outputPortCount = info.outputPortCount

            if (outputPortCount > 0) {
                val obj = JSONObject()
                obj.put("id", "midi-android-${info.id}")
                obj.put("name", info.properties.getString(MidiDeviceInfo.PROPERTY_NAME) ?: "MIDI Device ${info.id}")
                obj.put("manufacturer", info.properties.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER) ?: "Unknown")
                jsonArray.put(obj)
            }
        }

        return jsonArray.toString()
    }

    /**
     * Connect to a MIDI device and start receiving messages.
     * Called from Rust via JNI.
     */
    @JvmStatic
    fun connect(context: Context, deviceId: String) {
        val manager = ensureManager(context)

        // Disconnect existing connection first
        disconnect()

        // Parse device ID
        val androidDeviceId = deviceId.removePrefix("midi-android-").toIntOrNull()
            ?: throw IllegalArgumentException("Invalid device ID: $deviceId")

        // Find the device info
        val deviceInfo = manager.devices.find { it.id == androidDeviceId }
            ?: throw IllegalArgumentException("Device not found: $deviceId")

        // Open the device
        manager.openDevice(deviceInfo, { device ->
            if (device == null) {
                android.util.Log.e("MidiHelper", "Failed to open MIDI device: $deviceId")
                return@openDevice
            }

            openDevice = device
            connectedDeviceId = deviceId

            // Open the first output port (data FROM the device TO us)
            if (deviceInfo.outputPortCount > 0) {
                val port = device.openOutputPort(0)
                outputPort = port

                port?.connect(object : MidiReceiver() {
                    override fun onSend(data: ByteArray, offset: Int, count: Int, timestamp: Long) {
                        // Process MIDI messages
                        var i = offset
                        while (i < offset + count) {
                            val status = data[i].toInt() and 0xFF

                            // Check if this is a status byte (>= 0x80)
                            if (status >= 0x80 && i + 2 < offset + count) {
                                val note = data[i + 1].toInt() and 0x7F
                                val velocity = data[i + 2].toInt() and 0x7F

                                // Forward to Rust via JNI callback
                                onMidiMessage(status, note, velocity, timestamp / 1_000_000) // ns to ms
                                i += 3
                            } else {
                                i++
                            }
                        }
                    }
                })
            }

            android.util.Log.i("MidiHelper", "Connected to MIDI device: $deviceId")
        }, Handler(Looper.getMainLooper()))

        // Register device callback for hot-plug detection
        if (deviceCallback == null) {
            deviceCallback = object : MidiManager.DeviceCallback() {
                override fun onDeviceAdded(device: MidiDeviceInfo) {
                    android.util.Log.i("MidiHelper", "MIDI device added: ${device.id}")
                }

                override fun onDeviceRemoved(device: MidiDeviceInfo) {
                    android.util.Log.i("MidiHelper", "MIDI device removed: ${device.id}")
                    // If our connected device was removed, clean up
                    if (connectedDeviceId == "midi-android-${device.id}") {
                        disconnect()
                    }
                }
            }
            manager.registerDeviceCallback(deviceCallback, Handler(Looper.getMainLooper()))
        }
    }

    /**
     * Disconnect from the current MIDI device.
     * Called from Rust via JNI.
     */
    @JvmStatic
    fun disconnect() {
        try {
            outputPort?.close()
            openDevice?.close()
        } catch (e: Exception) {
            android.util.Log.w("MidiHelper", "Error closing MIDI device", e)
        }
        outputPort = null
        openDevice = null
        connectedDeviceId = null
    }

    /**
     * Get the currently connected device ID.
     * Called from Rust via JNI.
     */
    @JvmStatic
    fun getConnectedDeviceId(): String? {
        return connectedDeviceId
    }
}
