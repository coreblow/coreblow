package ai.coreblow.app.ui.chat

import ai.coreblow.app.ui.compose.chat.SessionFilter
import org.junit.Assert.*
import org.junit.Test

class SessionFiltersTest {
    @Test fun `all filter values exist`() = assertEquals(5, SessionFilter.entries.size)
    @Test fun `ALL is first`() = assertEquals(SessionFilter.ALL, SessionFilter.entries[0])
    @Test fun `GATEWAY_ONLY exists`() = assertNotNull(SessionFilter.GATEWAY_ONLY)
    @Test fun `LOCAL_ONLY exists`() = assertNotNull(SessionFilter.LOCAL_ONLY)
}
