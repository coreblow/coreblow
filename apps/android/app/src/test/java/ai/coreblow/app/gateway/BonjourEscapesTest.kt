package ai.coreblow.app.gateway

import org.junit.Assert.*
import org.junit.Test

class BonjourEscapesTest {
    @Test fun `encode safe string unchanged`() = assertEquals("hello", BonjourEscapes.encode("hello"))
    @Test fun `encode spaces`() = assertTrue(BonjourEscapes.encode("my gateway").contains("%"))
    @Test fun `decode reverses encode`() { val input = "my gateway!"; assertEquals(input, BonjourEscapes.decode(BonjourEscapes.encode(input))) }
    @Test fun `sanitize truncates to 63 chars`() { val long = "a".repeat(100); assertTrue(BonjourEscapes.sanitizeServiceName(long).length <= 63) }
    @Test fun `parse txt record`() { val data = mapOf("key" to "value".toByteArray()); val result = BonjourEscapes.parseTxtRecord(data); assertEquals("value", result["key"]) }
}
