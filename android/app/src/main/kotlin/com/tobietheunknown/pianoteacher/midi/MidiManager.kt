package com.tobietheunknown.pianoteacher.midi

import android.content.Context
import android.media.midi.*
import android.bluetooth.BluetoothManager
import android.bluetooth.le.*
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.util.concurrent.atomic.AtomicBoolean

sealed class MidiEvent {
    data class NoteOn(val pitch: Int, val velocity: Int, val channel: Int) : MidiEvent()
    data class NoteOff(val pitch: Int, val channel: Int) : MidiEvent()
    data class SustainPedal(val engaged: Boolean, val channel: Int) : MidiEvent()
    data object Reset : MidiEvent()
}

/** One process-wide input connection, shared by the learning screens. */
class MidiManager(private val context: Context) {
    private val _events = MutableSharedFlow<MidiEvent>(extraBufferCapacity = 256)
    val events: SharedFlow<MidiEvent> = _events.asSharedFlow()
    private val _deviceName = MutableStateFlow<String?>(null)
    val deviceName: StateFlow<String?> = _deviceName.asStateFlow()
    private val midiManager = context.getSystemService(Context.MIDI_SERVICE) as? android.media.midi.MidiManager
    private val handler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val resetPending = AtomicBoolean(false)
    private var activeDevice: MidiDevice? = null
    private var activePort: MidiOutputPort? = null
    private var usbScanning = false
    private var opening = false
    private var openingBluetooth = false
    @Volatile private var generation = 0
    private var bleScanner: BluetoothLeScanner? = null
    private val stopBle = Runnable { stopBleScanning() }

    // If a consumer falls behind, guarantee a final reset instead of silently
    // dropping a note-off and leaving a key sounding indefinitely.
    private fun publish(event: MidiEvent) {
        if (!_events.tryEmit(event) && resetPending.compareAndSet(false, true)) {
            scope.launch {
                try { _events.emit(MidiEvent.Reset) }
                finally { resetPending.set(false) }
            }
        }
    }

    private val deviceCallback = object : android.media.midi.MidiManager.DeviceCallback() {
        override fun onDeviceAdded(info: MidiDeviceInfo) {
            if (usbScanning && activeDevice == null && !opening && info.type != MidiDeviceInfo.TYPE_BLUETOOTH) connectToDevice(info)
        }
        override fun onDeviceRemoved(info: MidiDeviceInfo) {
            if (activeDevice?.info?.id == info.id) disconnect()
        }
    }

    fun configure(usb: Boolean, ble: Boolean) {
        if (!usb && usbScanning) {
            midiManager?.unregisterDeviceCallback(deviceCallback)
            usbScanning = false
        }
        if (!ble) stopBleScanning()
        val bluetooth = activeDevice?.info?.type == MidiDeviceInfo.TYPE_BLUETOOTH
        if (activeDevice != null && ((!usb && !bluetooth) || (!ble && bluetooth))) disconnect()
        if (opening && ((!usb && !openingBluetooth) || (!ble && openingBluetooth))) disconnect()
        if (usb) startUsbScanning()
        if (ble) startBleScanning()
    }

    fun startUsbScanning() {
        val manager = midiManager ?: return
        if (!usbScanning) {
            manager.registerDeviceCallback(deviceCallback, handler)
            usbScanning = true
        }
        if (activeDevice == null && !opening) {
            manager.devices.firstOrNull { it.outputPortCount > 0 && it.type != MidiDeviceInfo.TYPE_BLUETOOTH }
                ?.let { connectToDevice(it) }
        }
    }

    private fun connectToDevice(info: MidiDeviceInfo) {
        if (info.outputPortCount == 0 || activeDevice != null || opening) return
        val manager = midiManager ?: return
        opening = true
        openingBluetooth = false
        val request = generation
        try {
            manager.openDevice(info, { device -> acceptDevice(device, request) }, handler)
        } catch (_: Exception) { opening = false }
    }

    private fun acceptDevice(device: MidiDevice?, request: Int) {
        if (request != generation) { device?.close(); return }
        opening = false
        if (device == null) return
        if (activeDevice != null) { device.close(); return }
        try {
            val port = device.openOutputPort(0)
            if (port == null) { device.close(); return }
            // Parser state belongs to this connection, never to a future device.
            val parser = MidiByteParser(::publish)
            port.connect(object : MidiReceiver() {
                override fun onSend(msg: ByteArray, offset: Int, count: Int, timestamp: Long) {
                    if (request == generation) parser.accept(msg, offset, count)
                }
            })
            activePort = port
            activeDevice = device
            _deviceName.value = device.info.properties.getString(MidiDeviceInfo.PROPERTY_NAME)
                ?: device.info.properties.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER) ?: "MIDI Device"
            stopBleScanning()
        } catch (_: Exception) {
            device.close()
        }
    }

    private fun disconnect() {
        generation++ // Late callbacks must close their device instead of reviving it.
        opening = false
        runCatching { activePort?.close() }
        runCatching { activeDevice?.close() }
        activePort = null
        activeDevice = null
        _deviceName.value = null
        publish(MidiEvent.Reset)
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            if (bleScanner == null || activeDevice != null || opening) return
            val manager = midiManager ?: return
            stopBleScanning()
            opening = true
            openingBluetooth = true
            val request = generation
            try {
                // Use the device returned here directly; reopening its info leaks
                // this handle and can create a second connection to the keyboard.
                manager.openBluetoothDevice(result.device, { acceptDevice(it, request) }, handler)
            } catch (_: SecurityException) { opening = false }
        }
        override fun onScanFailed(errorCode: Int) { stopBleScanning() }
    }

    fun startBleScanning() {
        if (bleScanner != null || activeDevice != null || opening) return
        try {
            val bt = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val scanner = bt?.adapter?.bluetoothLeScanner ?: return
            val filter = ScanFilter.Builder()
                .setServiceUuid(android.os.ParcelUuid.fromString("03B80E5A-EDE8-4B33-A751-6CE34EC4C700"))
                .build()
            val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
            bleScanner = scanner
            scanner.startScan(listOf(filter), settings, scanCallback)
            handler.postDelayed(stopBle, 30_000)
        } catch (_: SecurityException) {
            bleScanner = null // Permission can be requested from Settings.
        }
    }

    private fun stopBleScanning() {
        handler.removeCallbacks(stopBle)
        try { bleScanner?.stopScan(scanCallback) } catch (_: SecurityException) { }
        bleScanner = null
    }

    fun stop() {
        stopBleScanning()
        if (usbScanning) midiManager?.unregisterDeviceCallback(deviceCallback)
        usbScanning = false
        disconnect()
    }

    companion object {
        @Volatile private var instance: MidiManager? = null
        fun getInstance(context: Context): MidiManager = instance ?: synchronized(this) {
            instance ?: MidiManager(context.applicationContext).also { instance = it }
        }
    }
}
