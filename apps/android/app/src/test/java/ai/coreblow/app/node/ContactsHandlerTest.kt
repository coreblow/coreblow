package ai.coreblow.app.node

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ContactsHandlerTest {
    @Test fun commandName_isContacts() { assertEquals("contacts", ContactsHandler.COMMAND_NAME) }

    @Test fun parseContactEntry_extractsRequiredFields() {
        val json = """{"id":"1","displayName":"Alice","phoneNumbers":["+1234567890"]}"""
        val contact = ContactsHandler.parseContactEntry(json)
        assertNotNull(contact)
        assertEquals("1", contact?.id)
        assertEquals("Alice", contact?.displayName)
    }

    @Test fun parseContactEntry_handlesMultiplePhoneNumbers() {
        val json = """{"id":"2","displayName":"Bob","phoneNumbers":["+111","+222","+333"]}"""
        val contact = ContactsHandler.parseContactEntry(json)
        assertEquals(3, contact?.phoneNumbers?.size)
    }

    @Test fun parseContactEntry_handlesOptionalEmails() {
        val json = """{"id":"3","displayName":"Carol","phoneNumbers":[],"emails":["carol@example.com"]}"""
        val contact = ContactsHandler.parseContactEntry(json)
        assertEquals(1, contact?.emails?.size)
        assertEquals("carol@example.com", contact?.emails?.first())
    }

    @Test fun searchContacts_matchesDisplayName() {
        assertTrue(ContactsHandler.matchesSearch("Alice Johnson", "alice"))
        assertTrue(ContactsHandler.matchesSearch("Alice Johnson", "john"))
        assertFalse(ContactsHandler.matchesSearch("Alice Johnson", "bob"))
    }

    @Test fun searchContacts_matchesPhoneNumber() {
        assertTrue(ContactsHandler.matchesSearchByPhone("+12345678901", "2345"))
        assertFalse(ContactsHandler.matchesSearchByPhone("+12345678901", "9999"))
    }

    @Test fun searchContacts_caseInsensitive() {
        assertTrue(ContactsHandler.matchesSearch("Alice", "ALICE"))
        assertTrue(ContactsHandler.matchesSearch("ALICE", "alice"))
    }

    @Test fun phoneTypeLabel_mapsStandardTypes() {
        assertEquals("Mobile", ContactsHandler.phoneTypeLabel(2))
        assertEquals("Home", ContactsHandler.phoneTypeLabel(1))
        assertEquals("Work", ContactsHandler.phoneTypeLabel(3))
    }

    @Test fun phoneTypeLabel_unknownDefaultsToOther() {
        assertEquals("Other", ContactsHandler.phoneTypeLabel(999))
    }

    @Test fun structuredName_parsesComponents() {
        val name = ContactsHandler.parseStructuredName("Alice", "Johnson", "M", "Dr.", "Jr.")
        assertEquals("Alice", name.givenName)
        assertEquals("Johnson", name.familyName)
        assertEquals("M", name.middleName)
    }

    @Test fun requiredPermissions_includesReadAndWrite() {
        val perms = ContactsHandler.requiredPermissions()
        assertTrue(perms.size >= 2)
    }
}
