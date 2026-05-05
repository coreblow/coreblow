package ai.coreblow.app.node

import org.junit.Assert.*
import org.junit.Test

class NodeUtilsTest {
    @Test fun `formatBytes bytes`() = assertEquals("100 B", NodeUtils.formatBytes(100))
    @Test fun `formatBytes kilobytes`() = assertTrue(NodeUtils.formatBytes(2048).contains("KB"))
    @Test fun `formatBytes megabytes`() = assertTrue(NodeUtils.formatBytes(5_000_000).contains("MB"))
    @Test fun `formatBytes gigabytes`() = assertTrue(NodeUtils.formatBytes(2_000_000_000).contains("GB"))
    @Test fun `truncate short string unchanged`() = assertEquals("hello", NodeUtils.truncate("hello", 10))
    @Test fun `truncate long string adds ellipsis`() { val r = NodeUtils.truncate("a".repeat(200), 50); assertTrue(r.length <= 50); assertTrue(r.endsWith("…")) }
    @Test fun `deviceDisplayName is non-empty`() = assertTrue(NodeUtils.deviceDisplayName().isNotBlank())
}
