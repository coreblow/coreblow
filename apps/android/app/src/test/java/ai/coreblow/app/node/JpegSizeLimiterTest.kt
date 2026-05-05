package ai.coreblow.app.node

import org.junit.Assert.*
import org.junit.Test

class JpegSizeLimiterTest {
    @Test fun `small input returned as-is`() { val input = ByteArray(100); val result = ai.coreblow.app.node.handlers.JpegSizeLimiter.limit(input, maxSizeKb = 1); assertSame(input, result) }
    @Test fun `estimateQuality returns valid range`() { val q = ai.coreblow.app.node.handlers.JpegSizeLimiter.estimateQuality(1_000_000, 100); assertTrue(q in 5..100) }
    @Test fun `estimateQuality zero size returns 85`() = assertEquals(85, ai.coreblow.app.node.handlers.JpegSizeLimiter.estimateQuality(0, 100))
}
