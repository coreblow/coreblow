package ai.coreblow.app.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatControllerSessionPolicyTest {
    @Test fun newSession_createsUniqueId() {
        val s1 = ChatController.createSession()
        val s2 = ChatController.createSession()
        assertNotNull(s1.id)
        assertNotNull(s2.id)
        assertFalse(s1.id == s2.id)
    }

    @Test fun sessionReuse_returnsSameForActiveSession() {
        val policy = ChatController.SessionPolicy()
        val session = policy.getOrCreateSession()
        val same = policy.getOrCreateSession()
        assertEquals(session.id, same.id)
    }

    @Test fun sessionCreation_afterClear() {
        val policy = ChatController.SessionPolicy()
        val first = policy.getOrCreateSession()
        policy.clearActiveSession()
        val second = policy.getOrCreateSession()
        assertFalse(first.id == second.id)
    }

    @Test fun maxSessionAge_isPositive() {
        assertTrue(ChatController.MAX_SESSION_AGE_MS > 0L)
    }
}
