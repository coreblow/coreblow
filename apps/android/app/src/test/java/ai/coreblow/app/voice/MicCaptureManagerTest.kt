package ai.coreblow.app.voice

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MicCaptureManagerTest {

    private val manager = MicCaptureManager()

    @Test
    fun `calculateRms returns zero for empty buffer`() {
        assertEquals(0.0, manager.calculateRms(shortArrayOf()), 0.001)
    }

    @Test
    fun `calculateRms returns zero for silence`() {
        val silence = ShortArray(100) { 0 }
        assertEquals(0.0, manager.calculateRms(silence), 0.001)
    }

    @Test
    fun `calculateRms returns non-zero for non-silent audio`() {
        val audio = ShortArray(100) { 1000 }
        assertTrue(manager.calculateRms(audio) > 0)
    }

    @Test
    fun `calculateRms scales with amplitude`() {
        val quiet = ShortArray(100) { 100 }
        val loud = ShortArray(100) { 10000 }
        assertTrue(manager.calculateRms(loud) > manager.calculateRms(quiet))
    }

    @Test
    fun `isSpeechDetected returns false for silence`() {
        assertFalse(manager.isSpeechDetected(0.0))
    }

    @Test
    fun `isSpeechDetected returns false below threshold`() {
        assertFalse(manager.isSpeechDetected(TalkDefaults.SILENCE_THRESHOLD_RMS - 1))
    }

    @Test
    fun `isSpeechDetected returns true above threshold`() {
        assertTrue(manager.isSpeechDetected(TalkDefaults.SILENCE_THRESHOLD_RMS + 1))
    }

    @Test
    fun `isRecording returns false before start`() {
        assertFalse(manager.isRecording)
    }
}
