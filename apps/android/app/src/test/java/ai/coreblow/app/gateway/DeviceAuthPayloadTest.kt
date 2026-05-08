package ai.coreblow.app.gateway

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceAuthPayloadTest {
    @Test
    fun buildPayload_containsRequiredFields() {
        val payload = DeviceAuthPayload.build(
            deviceName = "Pixel 8", osVersion = "Android 15", appVersion = "1.0.0",
        )
        assertNotNull(payload)
        assertEquals("Pixel 8", payload.deviceName)
        assertEquals("Android 15", payload.osVersion)
        assertEquals("1.0.0", payload.appVersion)
    }

    @Test
    fun buildPayload_includesPlatformIdentifier() {
        val payload = DeviceAuthPayload.build(
            deviceName = "Test", osVersion = "14", appVersion = "1.0",
        )
        assertEquals("android", payload.platform)
    }

    @Test
    fun serialize_producesValidJson() {
        val payload = DeviceAuthPayload.build(deviceName = "D", osVersion = "V", appVersion = "A")
        val json = payload.toJson()
        assertTrue(json.contains("deviceName"))
        assertTrue(json.contains("platform"))
    }

    @Test
    fun serialize_roundTrips() {
        val original = DeviceAuthPayload.build(deviceName = "Test", osVersion = "15", appVersion = "2.0")
        val json = original.toJson()
        val parsed = DeviceAuthPayload.fromJson(json)
        assertEquals(original.deviceName, parsed?.deviceName)
        assertEquals(original.platform, parsed?.platform)
    }
}
