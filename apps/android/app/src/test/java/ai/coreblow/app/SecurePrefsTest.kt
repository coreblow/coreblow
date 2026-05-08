package ai.coreblow.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SecurePrefsTest {
    @Test
    fun getAndSetGatewayToken_roundTrips() {
        val prefs = SecurePrefs.createInMemory()
        assertNull(prefs.getGatewayToken())
        prefs.setGatewayToken("test-token-123")
        assertEquals("test-token-123", prefs.getGatewayToken())
    }

    @Test
    fun clearAll_removesStoredValues() {
        val prefs = SecurePrefs.createInMemory()
        prefs.setGatewayToken("token")
        prefs.clearAll()
        assertNull(prefs.getGatewayToken())
    }

    @Test
    fun setGatewayToken_overwritesPreviousValue() {
        val prefs = SecurePrefs.createInMemory()
        prefs.setGatewayToken("old")
        prefs.setGatewayToken("new")
        assertEquals("new", prefs.getGatewayToken())
    }

    @Test
    fun getInstanceId_returnsStableValue() {
        val prefs = SecurePrefs.createInMemory()
        val id1 = prefs.getInstanceId()
        val id2 = prefs.getInstanceId()
        assertNotNull(id1)
        assertTrue(id1.isNotEmpty())
        assertEquals(id1, id2)
    }
}
