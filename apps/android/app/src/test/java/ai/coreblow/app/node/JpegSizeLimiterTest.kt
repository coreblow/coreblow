package ai.coreblow.app.node

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class JpegSizeLimiterTest {
    @Test
    fun suggestedQuality_startsAtMaxForSmallInput() {
        val quality = JpegSizeLimiter.suggestQuality(byteCount = 10_000L, targetBytes = 100_000L)
        assertEquals(JpegSizeLimiter.MAX_QUALITY, quality)
    }

    @Test
    fun suggestedQuality_reducesForLargeInput() {
        val quality = JpegSizeLimiter.suggestQuality(byteCount = 500_000L, targetBytes = 100_000L)
        assertTrue(quality < JpegSizeLimiter.MAX_QUALITY)
        assertTrue(quality >= JpegSizeLimiter.MIN_QUALITY)
    }

    @Test
    fun suggestedQuality_neverBelowMinimum() {
        val quality = JpegSizeLimiter.suggestQuality(byteCount = 50_000_000L, targetBytes = 100_000L)
        assertTrue(quality >= JpegSizeLimiter.MIN_QUALITY)
    }

    @Test
    fun isWithinLimit_checksCorrectly() {
        assertTrue(JpegSizeLimiter.isWithinLimit(50_000L, 100_000L))
        assertTrue(JpegSizeLimiter.isWithinLimit(100_000L, 100_000L))
        assertFalse(JpegSizeLimiter.isWithinLimit(100_001L, 100_000L))
    }

    @Test
    fun scaleFactor_computesCorrectly() {
        val factor = JpegSizeLimiter.scaleFactor(byteCount = 400_000L, targetBytes = 100_000L)
        assertTrue(factor < 1.0)
        assertTrue(factor > 0.0)
    }

    @Test
    fun maxQuality_isReasonable() {
        assertTrue(JpegSizeLimiter.MAX_QUALITY in 80..100)
    }

    @Test
    fun minQuality_isReasonable() {
        assertTrue(JpegSizeLimiter.MIN_QUALITY in 10..50)
    }
}
