package ai.coreblow.app.voice

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VoiceWakeCommandExtractorTest {

    @Test
    fun `extract camera command`() {
        assertEquals("camera.capture-photo", TalkDirectiveParser.extractCommand("take a photo"))
    }

    @Test
    fun `extract location command`() {
        assertEquals("location.get-location", TalkDirectiveParser.extractCommand("where am i"))
    }

    @Test
    fun `extract sms command`() {
        assertEquals("sms.read-sms", TalkDirectiveParser.extractCommand("read messages"))
    }

    @Test
    fun `extract battery command`() {
        assertEquals("device.get-battery", TalkDirectiveParser.extractCommand("check battery"))
    }

    @Test
    fun `extract storage command`() {
        assertEquals("device.get-storage", TalkDirectiveParser.extractCommand("check storage"))
    }

    @Test
    fun `extract contacts command`() {
        assertEquals("contacts.list-contacts", TalkDirectiveParser.extractCommand("list contacts"))
    }

    @Test
    fun `extract calendar command`() {
        assertEquals("calendar.list-events", TalkDirectiveParser.extractCommand("my events"))
    }

    @Test
    fun `extract steps command`() {
        assertEquals("motion.get-steps", TalkDirectiveParser.extractCommand("step count"))
    }

    @Test
    fun `unknown input returns null`() {
        assertNull(TalkDirectiveParser.extractCommand("tell me a joke"))
    }

    @Test
    fun `case insensitive matching`() {
        assertEquals("camera.capture-photo", TalkDirectiveParser.extractCommand("TAKE A PHOTO"))
    }

    @Test
    fun `trims whitespace`() {
        assertEquals("device.get-battery", TalkDirectiveParser.extractCommand("  battery  "))
    }
}
