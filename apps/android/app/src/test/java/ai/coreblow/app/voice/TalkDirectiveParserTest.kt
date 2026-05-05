package ai.coreblow.app.voice

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TalkDirectiveParserTest {

    @Test
    fun `parse speak directive`() {
        val payload = buildJsonObject {
            put("directive", "speak")
            put("text", "Hello from CoreBlow")
            put("voice", "default")
        }
        val result = TalkDirectiveParser.parse(payload)
        assertTrue(result is TalkDirective.Speak)
        assertEquals("Hello from CoreBlow", (result as TalkDirective.Speak).text)
        assertEquals("default", result.voice)
    }

    @Test
    fun `parse navigate directive`() {
        val payload = buildJsonObject {
            put("directive", "navigate")
            put("target", "settings")
        }
        val result = TalkDirectiveParser.parse(payload)
        assertTrue(result is TalkDirective.Navigate)
        assertEquals("settings", (result as TalkDirective.Navigate).target)
    }

    @Test
    fun `parse execute directive`() {
        val payload = buildJsonObject {
            put("directive", "execute")
            put("command", "camera.capture-photo")
        }
        val result = TalkDirectiveParser.parse(payload)
        assertTrue(result is TalkDirective.Execute)
        assertEquals("camera.capture-photo", (result as TalkDirective.Execute).command)
    }

    @Test
    fun `parse stop directive`() {
        val payload = buildJsonObject { put("directive", "stop") }
        assertTrue(TalkDirectiveParser.parse(payload) is TalkDirective.StopListening)
    }

    @Test
    fun `parse play-audio directive`() {
        val payload = buildJsonObject {
            put("directive", "play-audio")
            put("url", "https://example.com/audio.wav")
        }
        val result = TalkDirectiveParser.parse(payload)
        assertTrue(result is TalkDirective.PlayAudio)
        assertEquals("https://example.com/audio.wav", (result as TalkDirective.PlayAudio).url)
    }

    @Test
    fun `parse unknown directive type`() {
        val payload = buildJsonObject { put("directive", "foobar") }
        val result = TalkDirectiveParser.parse(payload)
        assertTrue(result is TalkDirective.Unknown)
        assertEquals("foobar", (result as TalkDirective.Unknown).type)
    }

    @Test
    fun `parse missing directive returns unknown`() {
        val payload = buildJsonObject { put("text", "no directive key") }
        assertTrue(TalkDirectiveParser.parse(payload) is TalkDirective.Unknown)
    }
}
