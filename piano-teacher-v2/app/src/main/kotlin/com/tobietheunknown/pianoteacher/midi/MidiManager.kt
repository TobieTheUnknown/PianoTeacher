package com.tobietheunknown.pianoteacher.midi

import android.content.Context
import android.media.midi.*
import android.bluetooth.BluetoothManager
import android.bluetooth.le.*
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.flow.*

/**
 * Manages MIDI input from USB and BLE devices.
 * Emits MidiEvent via a shared StateFlow consumed by ViewModels.
 */
sealed class MidiEvent {
    data class NoteOn(val pitch: Int, val velocity: Int, val channel: Int) : MidiEvent()
    data class NoteOff(val pitch: Int, val channel: Int) : MidiEvent()
}

class MidiManager(private val context: Context) {

    private val _events = MutableSharedFlow<MidiEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<MidiEvent> = _events.asSharedFlow()

    private val midiManager = context.getSystemService(Context.MIDI_SERVICE) as? android.media.midi.MidiManager
    private var activeDevice: MidiDevice? = null
    private var activePort: MidiOutputPort? = null

    // ─── USB MIDI ─────────────────────────────────────────────────────────────

    fun startUsbScanning() {
        midiManager?.registerDeviceCallback(object : android.media.midi.MidiManager.DeviceCallback() {
            override fun onDeviceAdded(info: MidiDeviceInfo) {
                connectToDevice(info)
            }
            override fun onDeviceRemoved(info: MidiDeviceInfo) {
                if (activeDevice?.info == info) disconnect()
            }
        }, Handler(Looper.getMainLooper()))

        // Connect to already attached device
        midiManager?.devices?.firstOrNull()?.let { connectToDevice(it) }
    }

    private fun connectToDevice(info: MidiDeviceInfo) {
        midiManager?.openDevice(info, { device ->
            device ?: return@openDevice
            activeDevice = device
            val port = device.openOutputPort(0) ?: return@openDevice
            activePort = port
            port.connect(object : MidiReceiver() {
                override fun onSend(msg: ByteArray, offset: Int, count: Int, timestamp: Long) {
                    parseMidiBytes(msg, offset, count)
                }
            })
        }, Handler(Looper.getMainLooper()))
    }

    private fun disconnect() {
        activePort?.close()
        activeDevice?.close()
        activePort = null
        activeDevice = null
    }

    // ─── BLE MIDI ─────────────────────────────────────────────────────────────

    fun startBleScanning() {
        val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val scanner = btManager?.adapter?.bluetoothLeScanner ?: return

        val filter = ScanFilter.Builder()
            .setServiceUuid(android.os.ParcelUuid.fromString("03B80E5A-EDE8-4B33-A751-6CE34EC4C700"))
            .build()

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        scanner.startScan(listOf(filter), settings, object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                // Connect via MIDI over BLE
                midiManager?.openBluetoothDevice(
                    result.device,
                    { device -> device?.let { connectToDevice(it.info) } },
                    Handler(Looper.getMainLooper())
                )
            }
        })
    }

    // ─── MIDI parsing ─────────────────────────────────────────────────────────

    private fun parseMidiBytes(msg: ByteArray, offset: Int, count: Int) {
        var i = offset
        while (i < offset + count) {
            val status = msg[i].toInt() and 0xFF
            val type = status and 0xF0
            val channel = status and 0x0F

            when (type) {
                0x90 -> { // Note On
                    if (i + 2 < offset + count) {
                        val pitch = msg[i + 1].toInt() and 0x7F
                        val velocity = msg[i + 2].toInt() and 0x7F
                        val event = if (velocity == 0) MidiEvent.NoteOff(pitch, channel)
                                    else MidiEvent.NoteOn(pitch, velocity, channel)
                        _events.tryEmit(event)
                        i += 3
                    } else break
                }
                0x80 -> { // Note Off
                    if (i + 2 < offset + count) {
                        val pitch = msg[i + 1].toInt() and 0x7F
                        _events.tryEmit(MidiEvent.NoteOff(pitch, channel))
                        i += 3
                    } else break
                }
                else -> i++ // skip unknown
            }
        }
    }

    fun stop() {
        disconnect()
    }
}
