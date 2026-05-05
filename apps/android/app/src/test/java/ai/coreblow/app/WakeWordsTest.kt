package ai.coreblow.app

import org.junit.Assert.*
import org.junit.Test

class WakeWordsTest {
    @Test fun `default wake phrase is hey coreblow`() = assertEquals("hey coreblow", ai.coreblow.app.voice.TalkDefaults.DEFAULT_WAKE_PHRASE)
    @Test fun `min confidence is reasonable`() = assertTrue(ai.coreblow.app.voice.TalkDefaults.MIN_WAKE_CONFIDENCE in 0.5f..0.95f)
    @Test fun `cooldown is positive`() = assertTrue(ai.coreblow.app.voice.TalkDefaults.WAKE_COOLDOWN_MS > 0)
}
