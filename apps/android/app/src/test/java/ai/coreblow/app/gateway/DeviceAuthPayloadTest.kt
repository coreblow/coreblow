package ai.coreblow.app.gateway

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.*
import org.junit.Test

class DeviceAuthPayloadTest {
    @Test fun `toJson includes deviceId`() { val p = DeviceAuthPayload("id1", "device-token", "tok", "My Phone", "android-14", "Pixel 8", "1.0"); val j = p.toJson(); assertEquals("\"id1\"", j["deviceId"].toString()) }
    @Test fun `toJson excludes null token`() { val p = DeviceAuthPayload("id1", "bootstrap", null, "Phone", "android", "Model", "1.0"); assertNull(p.toJson()["token"]) }
    @Test fun `toJson includes all fields`() { val p = DeviceAuthPayload("id", "device-token", "t", "N", "P", "M", "V"); val j = p.toJson(); assertNotNull(j["platform"]); assertNotNull(j["model"]); assertNotNull(j["version"]) }
}
