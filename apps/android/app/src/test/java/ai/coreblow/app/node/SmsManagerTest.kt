package ai.coreblow.app.node

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsManagerTest {
    @Test fun commandName_isSms() { assertEquals("sms", SmsManager.COMMAND_NAME) }

    @Test fun characterCount_detectsGsm7bit() {
        val result = SmsManager.analyzeMessage("Hello world")
        assertEquals(SmsManager.Encoding.GSM_7BIT, result.encoding)
        assertEquals(11, result.charCount)
    }

    @Test fun characterCount_detectsUnicode() {
        val result = SmsManager.analyzeMessage("Hello 🌍")
        assertEquals(SmsManager.Encoding.UCS2, result.encoding)
    }

    @Test fun multipartSplit_singlePartForShortMessage() {
        val parts = SmsManager.splitMessage("Short message")
        assertEquals(1, parts.size)
    }

    @Test fun multipartSplit_splitsLongGsmMessage() {
        val longMsg = "A".repeat(200) // Exceeds 160 char GSM limit
        val parts = SmsManager.splitMessage(longMsg)
        assertTrue(parts.size > 1)
    }

    @Test fun multipartSplit_splitsLongUnicodeMessage() {
        val longMsg = "あ".repeat(100) // Exceeds 70 char UCS-2 limit
        val parts = SmsManager.splitMessage(longMsg)
        assertTrue(parts.size > 1)
    }

    @Test fun phoneNumberNormalization_stripsNonDigits() {
        assertEquals("+12345678901", SmsManager.normalizePhoneNumber("+1 (234) 567-8901"))
        assertEquals("+12345678901", SmsManager.normalizePhoneNumber("+1.234.567.8901"))
    }

    @Test fun phoneNumberNormalization_preservesPlus() {
        assertTrue(SmsManager.normalizePhoneNumber("+12345678901").startsWith("+"))
    }

    @Test fun parseSendRequest_extractsRequiredFields() {
        val json = """{"to":"+12345678901","body":"Hello"}"""
        val req = SmsManager.parseSendRequest(json)
        assertNotNull(req)
        assertEquals("+12345678901", req?.to)
        assertEquals("Hello", req?.body)
    }

    @Test fun parseSendRequest_handlesEmptyBody() {
        val json = """{"to":"+12345678901","body":""}"""
        val req = SmsManager.parseSendRequest(json)
        assertEquals("", req?.body)
    }

    @Test fun conversationThreading_groupsByContact() {
        val messages = listOf(
            SmsManager.SmsEntry(address = "+111", body = "a", timestamp = 1L, type = 1),
            SmsManager.SmsEntry(address = "+222", body = "b", timestamp = 2L, type = 1),
            SmsManager.SmsEntry(address = "+111", body = "c", timestamp = 3L, type = 2),
        )
        val threads = SmsManager.groupByConversation(messages)
        assertEquals(2, threads.size)
        assertEquals(2, threads["+111"]?.size)
        assertEquals(1, threads["+222"]?.size)
    }

    @Test fun contactNameResolution_returnsNullWhenUnknown() {
        val name = SmsManager.resolveContactName(emptyMap(), "+99999999")
        assertFalse(name != null)
    }

    @Test fun gsmCharacterSet_containsBasicLatin() {
        assertTrue(SmsManager.isGsmCharacter('A'))
        assertTrue(SmsManager.isGsmCharacter('0'))
        assertTrue(SmsManager.isGsmCharacter(' '))
        assertFalse(SmsManager.isGsmCharacter('あ'))
    }

    @Test fun requiredPermissions_includesSendAndRead() {
        val perms = SmsManager.requiredPermissions()
        assertTrue(perms.size >= 2)
    }

    @Test fun maxMessageLength_gsm7bit() {
        assertEquals(160, SmsManager.MAX_GSM_SINGLE_PART_LENGTH)
    }

    @Test fun maxMessageLength_ucs2() {
        assertEquals(70, SmsManager.MAX_UCS2_SINGLE_PART_LENGTH)
    }

    @Test fun multipartSegmentLength_gsm7bit() {
        assertEquals(153, SmsManager.GSM_MULTIPART_SEGMENT_LENGTH)
    }

    @Test fun multipartSegmentLength_ucs2() {
        assertEquals(67, SmsManager.UCS2_MULTIPART_SEGMENT_LENGTH)
    }

    @Test fun messageType_inbox() {
        assertEquals(1, SmsManager.MESSAGE_TYPE_INBOX)
    }

    @Test fun messageType_sent() {
        assertEquals(2, SmsManager.MESSAGE_TYPE_SENT)
    }

    @Test fun conversationThreading_sortsByTimestamp() {
        val messages = listOf(
            SmsManager.SmsEntry(address = "+111", body = "old", timestamp = 100L, type = 1),
            SmsManager.SmsEntry(address = "+111", body = "new", timestamp = 200L, type = 1),
        )
        val threads = SmsManager.groupByConversation(messages)
        val thread = threads["+111"]!!
        assertTrue(thread[0].timestamp <= thread[1].timestamp)
    }

    @Test fun filterInbox_returnsOnlyIncoming() {
        val messages = listOf(
            SmsManager.SmsEntry(address = "+111", body = "in", timestamp = 1L, type = 1),
            SmsManager.SmsEntry(address = "+111", body = "out", timestamp = 2L, type = 2),
        )
        val inbox = SmsManager.filterByType(messages, SmsManager.MESSAGE_TYPE_INBOX)
        assertEquals(1, inbox.size)
        assertEquals("in", inbox[0].body)
    }

    @Test fun filterSent_returnsOnlyOutgoing() {
        val messages = listOf(
            SmsManager.SmsEntry(address = "+222", body = "in", timestamp = 1L, type = 1),
            SmsManager.SmsEntry(address = "+222", body = "out", timestamp = 2L, type = 2),
        )
        val sent = SmsManager.filterByType(messages, SmsManager.MESSAGE_TYPE_SENT)
        assertEquals(1, sent.size)
        assertEquals("out", sent[0].body)
    }

    @Test fun analyzeMessage_emptyStringIsGsm() {
        val result = SmsManager.analyzeMessage("")
        assertEquals(SmsManager.Encoding.GSM_7BIT, result.encoding)
        assertEquals(0, result.charCount)
    }

    @Test fun parseSendRequest_rejectsMissingTo() {
        val json = """{"body":"Hello"}"""
        val req = SmsManager.parseSendRequest(json)
        assertTrue(req == null || req.to.isNullOrBlank())
    }

    @Test fun maxSearchResults_isReasonable() {
        assertTrue(SmsManager.MAX_SEARCH_RESULTS > 0)
        assertTrue(SmsManager.MAX_SEARCH_RESULTS <= 500)
    }
}
