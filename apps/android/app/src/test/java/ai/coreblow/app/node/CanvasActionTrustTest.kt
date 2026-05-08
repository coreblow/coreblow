package ai.coreblow.app.node

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CanvasActionTrustTest {
    @Test
    fun safeActions_areTrusted() {
        assertTrue(CanvasActionTrust.isTrusted("show"))
        assertTrue(CanvasActionTrust.isTrusted("hide"))
        assertTrue(CanvasActionTrust.isTrusted("update"))
        assertTrue(CanvasActionTrust.isTrusted("navigate"))
    }

    @Test
    fun dangerousActions_areUntrusted() {
        assertFalse(CanvasActionTrust.isTrusted("exec"))
        assertFalse(CanvasActionTrust.isTrusted("eval"))
        assertFalse(CanvasActionTrust.isTrusted("shell"))
    }

    @Test
    fun unknownActions_areUntrusted() {
        assertFalse(CanvasActionTrust.isTrusted("something_unknown"))
        assertFalse(CanvasActionTrust.isTrusted(""))
    }

    @Test
    fun trustLevel_categorizes() {
        assertEquals(CanvasActionTrust.Level.Safe, CanvasActionTrust.trustLevel("show"))
        assertEquals(CanvasActionTrust.Level.Restricted, CanvasActionTrust.trustLevel("exec"))
        assertEquals(CanvasActionTrust.Level.Unknown, CanvasActionTrust.trustLevel("xyz"))
    }

    @Test
    fun auditLog_recordsActionAttempt() {
        val log = CanvasActionTrust.AuditLog()
        log.record("show", trusted = true)
        log.record("exec", trusted = false)
        assertEquals(2, log.entries().size)
        assertTrue(log.entries()[0].trusted)
        assertFalse(log.entries()[1].trusted)
    }
}
