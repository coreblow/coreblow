package ai.coreblow.app.gateway

import org.junit.Assert.assertEquals
import org.junit.Test

class BonjourEscapesTest {
    @Test
    fun escapeDnsLabel_escapesBackslash() {
        assertEquals("hello\\\\world", BonjourEscapes.escapeDnsLabel("hello\\world"))
    }

    @Test
    fun escapeDnsLabel_escapesDot() {
        assertEquals("my\\.gateway", BonjourEscapes.escapeDnsLabel("my.gateway"))
    }

    @Test
    fun unescapeDnsLabel_roundTrips() {
        val original = "my.gateway\\test"
        val escaped = BonjourEscapes.escapeDnsLabel(original)
        assertEquals(original, BonjourEscapes.unescapeDnsLabel(escaped))
    }

    @Test
    fun escapeDnsLabel_passesPlainThroughUnchanged() {
        assertEquals("simple", BonjourEscapes.escapeDnsLabel("simple"))
    }
}
