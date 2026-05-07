package ai.coreblow.app.node.handlers

import android.content.ContentResolver
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.provider.ContactsContract
import android.util.Log
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Reads contacts from the device for gateway invoke commands.
 * Supports listing with pagination/search, detail fetching,
 * and phone/email extraction.
 */
class ContactsHandler(private val appContext: Context) {

    companion object {
        private const val TAG = "ContactsHandler"
    }

    private val resolver: ContentResolver get() = appContext.contentResolver

    fun listContacts(limit: Int = 100, offset: Int = 0, search: String? = null): String {
        val contacts = mutableListOf<JsonObject>()
        val selection = if (!search.isNullOrBlank()) {
            "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} LIKE ?"
        } else null
        val selectionArgs = if (!search.isNullOrBlank()) arrayOf("%$search%") else null

        val cursor = resolver.query(
            ContactsContract.Contacts.CONTENT_URI,
            arrayOf(
                ContactsContract.Contacts._ID,
                ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
                ContactsContract.Contacts.HAS_PHONE_NUMBER,
                ContactsContract.Contacts.STARRED,
                ContactsContract.Contacts.PHOTO_THUMBNAIL_URI,
                ContactsContract.Contacts.LOOKUP_KEY,
            ),
            selection,
            selectionArgs,
            "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} ASC LIMIT $limit OFFSET $offset",
        )

        cursor?.use { c ->
            while (c.moveToNext()) {
                val id = c.getString(0) ?: continue
                val name = c.getString(1) ?: ""
                val hasPhone = c.getInt(2) > 0
                val starred = c.getInt(3) > 0
                val thumbUri = c.getString(4)
                val lookupKey = c.getString(5) ?: ""

                val phones = if (hasPhone) getPhoneNumbers(id) else emptyList()
                val emails = getEmails(id)

                contacts.add(buildJsonObject {
                    put("id", JsonPrimitive(id))
                    put("name", JsonPrimitive(name))
                    put("lookupKey", JsonPrimitive(lookupKey))
                    put("starred", JsonPrimitive(starred))
                    put("hasPhone", JsonPrimitive(hasPhone))
                    put("hasPhoto", JsonPrimitive(thumbUri != null))
                    if (phones.isNotEmpty()) put("phone", JsonPrimitive(phones.first()))
                    if (phones.size > 1) put("phones", JsonPrimitive(phones.joinToString(";")))
                    if (emails.isNotEmpty()) put("email", JsonPrimitive(emails.first()))
                    if (emails.size > 1) put("emails", JsonPrimitive(emails.joinToString(";")))
                })
            }
        }

        return kotlinx.serialization.json.JsonArray(contacts).toString()
    }

    fun getContact(id: String): String {
        val cursor = resolver.query(
            ContactsContract.Contacts.CONTENT_URI,
            null,
            "${ContactsContract.Contacts._ID} = ?",
            arrayOf(id),
            null,
        )

        cursor?.use { c ->
            if (c.moveToFirst()) {
                val name = c.getString(c.getColumnIndexOrThrow(ContactsContract.Contacts.DISPLAY_NAME_PRIMARY)) ?: ""
                val starred = c.getInt(c.getColumnIndexOrThrow(ContactsContract.Contacts.STARRED)) > 0
                val lookupKey = c.getString(c.getColumnIndexOrThrow(ContactsContract.Contacts.LOOKUP_KEY)) ?: ""

                val phones = getPhoneNumbers(id)
                val emails = getEmails(id)
                val addresses = getAddresses(id)
                val organizations = getOrganizations(id)
                val notes = getNotes(id)

                return buildJsonObject {
                    put("id", JsonPrimitive(id))
                    put("name", JsonPrimitive(name))
                    put("lookupKey", JsonPrimitive(lookupKey))
                    put("starred", JsonPrimitive(starred))
                    put("phones", JsonPrimitive(phones.joinToString(";")))
                    put("emails", JsonPrimitive(emails.joinToString(";")))
                    put("addresses", JsonPrimitive(addresses.joinToString(";")))
                    put("organizations", JsonPrimitive(organizations.joinToString(";")))
                    put("notes", JsonPrimitive(notes.joinToString("\n")))
                }.toString()
            }
        }

        return buildJsonObject { put("error", JsonPrimitive("Contact not found")) }.toString()
    }

    fun handleCommand(subCommand: String, params: JsonObject): String? {
        return when (subCommand) {
            "list" -> {
                val limit = (params["limit"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 100
                val offset = (params["offset"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 0
                val search = (params["search"] as? JsonPrimitive)?.content
                listContacts(limit, offset, search)
            }
            "get" -> {
                val id = (params["id"] as? JsonPrimitive)?.content ?: return null
                getContact(id)
            }
            "count" -> {
                val cursor = resolver.query(ContactsContract.Contacts.CONTENT_URI, arrayOf("count(*) AS count"), null, null, null)
                val count = cursor?.use { if (it.moveToFirst()) it.getInt(0) else 0 } ?: 0
                buildJsonObject { put("count", JsonPrimitive(count)) }.toString()
            }
            else -> null
        }
    }

    // MARK: - Private

    private fun getPhoneNumbers(contactId: String): List<String> {
        val phones = mutableListOf<String>()
        val cursor = resolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
            "${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?",
            arrayOf(contactId), null,
        )
        cursor?.use { while (it.moveToNext()) { it.getString(0)?.trim()?.let { p -> if (p.isNotEmpty()) phones.add(p) } } }
        return phones.distinct()
    }

    private fun getEmails(contactId: String): List<String> {
        val emails = mutableListOf<String>()
        val cursor = resolver.query(
            ContactsContract.CommonDataKinds.Email.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Email.ADDRESS),
            "${ContactsContract.CommonDataKinds.Email.CONTACT_ID} = ?",
            arrayOf(contactId), null,
        )
        cursor?.use { while (it.moveToNext()) { it.getString(0)?.trim()?.let { e -> if (e.isNotEmpty()) emails.add(e) } } }
        return emails.distinct()
    }

    private fun getAddresses(contactId: String): List<String> {
        val addresses = mutableListOf<String>()
        val cursor = resolver.query(
            ContactsContract.CommonDataKinds.StructuredPostal.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.StructuredPostal.FORMATTED_ADDRESS),
            "${ContactsContract.CommonDataKinds.StructuredPostal.CONTACT_ID} = ?",
            arrayOf(contactId), null,
        )
        cursor?.use { while (it.moveToNext()) { it.getString(0)?.trim()?.let { a -> if (a.isNotEmpty()) addresses.add(a) } } }
        return addresses
    }

    private fun getOrganizations(contactId: String): List<String> {
        val orgs = mutableListOf<String>()
        val cursor = resolver.query(
            ContactsContract.Data.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Organization.COMPANY, ContactsContract.CommonDataKinds.Organization.TITLE),
            "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?",
            arrayOf(contactId, ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE), null,
        )
        cursor?.use {
            while (it.moveToNext()) {
                val company = it.getString(0)?.trim() ?: ""
                val title = it.getString(1)?.trim() ?: ""
                val combined = listOf(company, title).filter { s -> s.isNotEmpty() }.joinToString(" - ")
                if (combined.isNotEmpty()) orgs.add(combined)
            }
        }
        return orgs
    }

    private fun getNotes(contactId: String): List<String> {
        val notes = mutableListOf<String>()
        val cursor = resolver.query(
            ContactsContract.Data.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Note.NOTE),
            "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?",
            arrayOf(contactId, ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE), null,
        )
        cursor?.use { while (it.moveToNext()) { it.getString(0)?.trim()?.let { n -> if (n.isNotEmpty()) notes.add(n) } } }
        return notes
    }
}
