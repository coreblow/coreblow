package ai.coreblow.app.node

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceHandlerTest {
    @Test fun commandName_isDevice() { assertEquals("device", DeviceHandler.COMMAND_NAME) }

    @Test fun parseBatteryInfo_extractsLevel() {
        val json = """{"level":85,"status":"charging","health":"good","voltage":4200,"temperature":25.0,"technology":"Li-ion"}"""
        val info = DeviceHandler.parseBatteryInfo(json)
        assertNotNull(info)
        assertEquals(85, info?.level)
        assertEquals("charging", info?.status)
    }

    @Test fun parseBatteryInfo_handlesEdgeLevels() {
        val zero = DeviceHandler.parseBatteryInfo("""{"level":0,"status":"not_charging"}""")
        assertEquals(0, zero?.level)
        val full = DeviceHandler.parseBatteryInfo("""{"level":100,"status":"full"}""")
        assertEquals(100, full?.level)
    }

    @Test fun parseStorageInfo_extractsTotalAndFree() {
        val json = """{"totalBytes":128000000000,"freeBytes":64000000000}"""
        val info = DeviceHandler.parseStorageInfo(json)
        assertNotNull(info)
        assertTrue(info!!.totalBytes > 0)
        assertTrue(info.freeBytes <= info.totalBytes)
    }

    @Test fun formatBytes_handlesCommonSizes() {
        assertEquals("0 B", DeviceHandler.formatBytes(0L))
        assertEquals("1.0 KB", DeviceHandler.formatBytes(1024L))
        assertEquals("1.0 MB", DeviceHandler.formatBytes(1024L * 1024L))
        assertEquals("1.0 GB", DeviceHandler.formatBytes(1024L * 1024L * 1024L))
    }

    @Test fun networkType_mapsStandardValues() {
        assertEquals("WiFi", DeviceHandler.networkTypeLabel(1))
        assertEquals("Cellular", DeviceHandler.networkTypeLabel(0))
        assertEquals("VPN", DeviceHandler.networkTypeLabel(4))
    }

    @Test fun networkType_unknownDefaultsToOther() {
        assertEquals("Other", DeviceHandler.networkTypeLabel(999))
    }

    @Test fun displayMetrics_parsesFields() {
        val json = """{"densityDpi":420,"widthPixels":1080,"heightPixels":2400,"refreshRate":60.0}"""
        val metrics = DeviceHandler.parseDisplayMetrics(json)
        assertNotNull(metrics)
        assertEquals(1080, metrics?.widthPixels)
        assertEquals(2400, metrics?.heightPixels)
    }

    @Test fun sensorInfo_parsesList() {
        val json = """[{"name":"Accelerometer","type":1},{"name":"Gyroscope","type":4}]"""
        val sensors = DeviceHandler.parseSensorList(json)
        assertEquals(2, sensors.size)
        assertEquals("Accelerometer", sensors[0].name)
    }

    @Test fun buildInfo_includesExpectedFields() {
        val fields = DeviceHandler.buildInfoFields()
        assertTrue(fields.containsKey("manufacturer"))
        assertTrue(fields.containsKey("model"))
        assertTrue(fields.containsKey("sdkVersion"))
    }

    @Test fun thermalStatus_mapsValues() {
        assertEquals("none", DeviceHandler.thermalStatusLabel(0))
        assertEquals("moderate", DeviceHandler.thermalStatusLabel(2))
        assertEquals("critical", DeviceHandler.thermalStatusLabel(4))
    }
}
