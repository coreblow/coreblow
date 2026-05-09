package ai.coreblow.app.node

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SystemHandlerTest {
    @Test fun commandName_isSystem() { assertEquals("system", SystemHandler.COMMAND_NAME) }

    @Test fun parseUptimeResponse_returnsPositiveValue() {
        val uptime = SystemHandler.parseUptime("""{"uptimeMs":1234567}""")
        assertNotNull(uptime)
        assertTrue(uptime!!.uptimeMs > 0)
    }

    @Test fun formatUptime_handlesMinutes() {
        assertEquals("5m 0s", SystemHandler.formatUptime(300_000L))
    }

    @Test fun formatUptime_handlesHours() {
        assertEquals("1h 30m 0s", SystemHandler.formatUptime(5_400_000L))
    }

    @Test fun formatUptime_handlesDays() {
        assertEquals("1d 0h 0m 0s", SystemHandler.formatUptime(86_400_000L))
    }

    @Test fun parseMemoryInfo_extractsFields() {
        val json = """{"totalBytes":8000000000,"availableBytes":4000000000,"usedBytes":4000000000}"""
        val mem = SystemHandler.parseMemoryInfo(json)
        assertNotNull(mem)
        assertEquals(8_000_000_000L, mem!!.totalBytes)
        assertTrue(mem.availableBytes <= mem.totalBytes)
    }

    @Test fun memoryUsagePercent_computesCorrectly() {
        val pct = SystemHandler.memoryUsagePercent(totalBytes = 100L, usedBytes = 75L)
        assertEquals(75.0, pct, 0.1)
    }

    @Test fun memoryUsagePercent_handlesZeroTotal() {
        val pct = SystemHandler.memoryUsagePercent(totalBytes = 0L, usedBytes = 0L)
        assertEquals(0.0, pct, 0.1)
    }

    @Test fun diagnosticsResponse_containsExpectedKeys() {
        val keys = SystemHandler.diagnosticKeys()
        assertTrue(keys.contains("uptime"))
        assertTrue(keys.contains("memory"))
        assertTrue(keys.contains("storage"))
    }

    @Test fun formatUptime_handlesZero() {
        assertEquals("0s", SystemHandler.formatUptime(0L))
    }

    @Test fun formatUptime_handlesSmallMs() {
        assertEquals("0s", SystemHandler.formatUptime(500L))
    }

    @Test fun parseStorageInfo_extractsTotalAndFree() {
        val json = """{"totalBytes":128000000000,"freeBytes":64000000000,"usedBytes":64000000000}"""
        val storage = SystemHandler.parseStorageInfo(json)
        assertNotNull(storage)
        assertEquals(128_000_000_000L, storage!!.totalBytes)
        assertEquals(64_000_000_000L, storage.freeBytes)
    }

    @Test fun thermalState_mapsValues() {
        assertEquals("nominal", SystemHandler.mapThermalState(0))
        assertEquals("fair", SystemHandler.mapThermalState(2))
        assertEquals("serious", SystemHandler.mapThermalState(3))
        assertEquals("critical", SystemHandler.mapThermalState(4))
    }

    @Test fun memoryPressure_mapsFromRatio() {
        assertEquals("normal", SystemHandler.memoryPressureLevel(total = 100, available = 60))
        assertEquals("moderate", SystemHandler.memoryPressureLevel(total = 100, available = 25))
        assertEquals("high", SystemHandler.memoryPressureLevel(total = 100, available = 10))
        assertEquals("critical", SystemHandler.memoryPressureLevel(total = 100, available = 3))
    }
}
