package ai.coreblow.app.voice

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TalkModeConfigParsingTest {
    @Test
    fun parseTalkConfig_extractsModelAndVoice() {
        val json = """{"sttModel":"whisper-1","ttsVoice":"nova","vadSensitivity":0.8}"""
        val cfg = TalkModeConfigParser.parse(json)
        assertNotNull(cfg)
        assertEquals("whisper-1", cfg?.sttModel)
        assertEquals("nova", cfg?.ttsVoice)
    }

    @Test
    fun parseTalkConfig_handlesDefaults() {
        val cfg = TalkModeConfigParser.parse("{}")
        assertNotNull(cfg)
        assertNotNull(cfg?.sttModel)
        assertNotNull(cfg?.ttsVoice)
    }

    @Test
    fun parseTalkConfig_returnsNullForInvalid() {
        assertNull(TalkModeConfigParser.parse("not json"))
        assertNull(TalkModeConfigParser.parse(""))
    }

    @Test
    fun vadSensitivity_clampsToRange() {
        val low = TalkModeConfigParser.parse("""{"vadSensitivity":-1.0}""")
        assertTrue((low?.vadSensitivity ?: 0.0) >= 0.0)

        val high = TalkModeConfigParser.parse("""{"vadSensitivity":5.0}""")
        assertTrue((high?.vadSensitivity ?: 1.0) <= 1.0)
    }

    @Test
    fun streamingEnabled_defaultsToTrue() {
        val cfg = TalkModeConfigParser.parse("{}")
        assertTrue(cfg?.streamingEnabled ?: false)
    }

    @Test
    fun streamingEnabled_respectsExplicitFalse() {
        val cfg = TalkModeConfigParser.parse("""{"streamingEnabled":false}""")
        assertFalse(cfg?.streamingEnabled ?: true)
    }

    @Test
    fun sttModel_trims() {
        val cfg = TalkModeConfigParser.parse("""{"sttModel":"  whisper-1  "}""")
        assertEquals("whisper-1", cfg?.sttModel)
    }
}
