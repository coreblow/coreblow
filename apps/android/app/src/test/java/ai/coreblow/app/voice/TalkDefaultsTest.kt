package ai.coreblow.app.voice

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TalkDefaultsTest {

    @Test
    fun `sample rate is 16kHz`() {
        assertEquals(16_000, TalkDefaults.SAMPLE_RATE)
    }

    @Test
    fun `min buffer size is positive`() {
        assertTrue(TalkDefaults.MIN_BUFFER_SIZE > 0)
    }

    @Test
    fun `silence threshold is positive`() {
        assertTrue(TalkDefaults.SILENCE_THRESHOLD_RMS > 0)
    }

    @Test
    fun `max recording duration is reasonable`() {
        assertTrue(TalkDefaults.MAX_RECORDING_DURATION_MS in 5_000L..120_000L)
    }

    @Test
    fun `wake confidence is between 0 and 1`() {
        assertTrue(TalkDefaults.MIN_WAKE_CONFIDENCE in 0.0f..1.0f)
    }

    @Test
    fun `default wake phrase is lowercase`() {
        assertEquals(TalkDefaults.DEFAULT_WAKE_PHRASE, TalkDefaults.DEFAULT_WAKE_PHRASE.lowercase())
    }

    @Test
    fun `cooldown is positive`() {
        assertTrue(TalkDefaults.WAKE_COOLDOWN_MS > 0)
    }

    @Test
    fun `talk mode timeout is positive`() {
        assertTrue(TalkDefaults.TALK_MODE_TIMEOUT_MS > 0)
    }
}
