package ai.coreblow.app.ui.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatImageCodecTest {
    @Test fun encodeBase64_roundTrips() {
        val original = byteArrayOf(0x01, 0x02, 0x03, 0x04)
        val encoded = ChatImageCodec.encodeToBase64(original)
        assertNotNull(encoded)
        assertTrue(encoded.isNotEmpty())
        val decoded = ChatImageCodec.decodeFromBase64(encoded)
        assertNotNull(decoded)
        assertEquals(original.size, decoded!!.size)
    }

    @Test fun decodeBase64_returnsNullForInvalid() {
        assertNull(ChatImageCodec.decodeFromBase64("not-valid-base64!!!"))
    }

    @Test fun maxImageSizeBytes_isReasonable() {
        assertTrue(ChatImageCodec.MAX_IMAGE_SIZE_BYTES > 0)
        assertTrue(ChatImageCodec.MAX_IMAGE_SIZE_BYTES <= 20L * 1024L * 1024L) // max 20MB
    }
}
