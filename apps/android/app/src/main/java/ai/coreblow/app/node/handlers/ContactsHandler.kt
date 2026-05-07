package ai.coreblow.app.node.handlers

import android.Manifest
import android.content.ContentResolver
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.ContactsContract
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.serialization.json.*

/**
 * Handles contacts-related gateway invoke commands.
 * Supports reading, searching, creating, and managing contacts
 * with proper permission verification.
 */
class ContactsHandler(private val context: Context) {

    companion object {
        private const val TAG = "ContactsHandler"
        private const val DEFAULT_LIMIT = 50
        private const val MAX_LIMIT = 200
    }

    /**
     * Get all contacts with pagination.
     */
    fun getContacts(limit: Int = DEFAULT_LIMIT, offset: Int = 0): String {
        if (!hasPermission()) return errorJson("Contacts permission not granted")

        return buildJsonObject {
            val contacts = buildJsonArray {
                val cursor = context.contentResolver.query(
                    ContactsContract.Contacts.CONTENT_URI,
                    arrayOf(
                        ContactsContract.Contacts._ID,
                        ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
                        ContactsContract.Contacts.HAS_PHONE_NUMBER,
                        ContactsContract.Contacts.STARRED,
                        ContactsContract.Contacts.PHOTO_URI,
                        ContactsContract.Contacts.LOOKUP_KEY,
                    ),
                    null, null,
                    "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} ASC",
                )
                cursor?.use { c ->
                    var skipped = 0
                    var count = 0
                    while (c.moveToNext()) {
                        if (skipped < offset) { skipped++; continue }
                        if (count >= limit.coerceAtMost(MAX_LIMIT)) break
                        add(cursorToContact(c))
                        count++
                    }
                }
            }
            put("contacts", contacts)
            put("count", contacts.size)
            put("offset", offset)
            put("limit", limit)
        }.toString()
    }

    /**
     * Search contacts by name or phone number.
     */
    fun searchContacts(query: String, limit: Int = DEFAULT_LIMIT): String {
        if (!hasPermission()) return errorJson("Contacts permission not granted")
        if (query.isBlank()) return errorJson("Search query is required")

        return buildJsonObject {
            val contacts = buildJsonArray {
                val cursor = context.contentResolver.query(
                    ContactsContract.Contacts.CONTENT_URI,
                    arrayOf(
                        ContactsContract.Contacts._ID,
                        ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
                        ContactsContract.Contacts.HAS_PHONE_NUMBER,
                        ContactsContract.Contacts.STARRED,
                        ContactsContract.Contacts.PHOTO_URI,
                        ContactsContract.Contacts.LOOKUP_KEY,
                    ),
                    "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} LIKE ?",
                    arrayOf("%$query%"),
                    "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} ASC",
                )
                cursor?.use { c ->
                    var count = 0
                    while (c.moveToNext() && count < limit) {
                        add(cursorToContact(c))
                        count++
                    }
                }
            }
            put("contacts", contacts)
            put("query", query)
            put("count", contacts.size)
        }.toString()
    }

    /**
     * Get detailed contact information by ID.
     */
    fun getContactDetail(contactId: String): String {
        if (!hasPermission()) return errorJson("Contacts permission not granted")

        return buildJsonObject {
            // Basic info
            val cursor = context.contentResolver.query(
                ContactsContract.Contacts.CONTENT_URI,
                null,
                "${ContactsContract.Contacts._ID} = ?",
                arrayOf(contactId),
                null,
            )

            cursor?.use { c ->
                if (c.moveToFirst()) {
                    put("id", contactId)
                    put("name", c.getString(c.getColumnIndexOrThrow(ContactsContract.Contacts.DISPLAY_NAME_PRIMARY)) ?: "")
                    put("starred", c.getInt(c.getColumnIndexOrThrow(ContactsContract.Contacts.STARRED)) == 1)

                    // Phone numbers
                    put("phones", getPhoneNumbers(contactId))

                    // Emails
                    put("emails", getEmails(contactId))

                    // Organizations
                    put("organizations", getOrganizations(contactId))
                } else {
                    put("error", "Contact not found: $contactId")
                }
            }
        }.toString()
    }

    /**
     * Get starred/favorite contacts.
     */
    fun getStarredContacts(): String {
        if (!hasPermission()) return errorJson("Contacts permission not granted")

        return buildJsonObject {
            val contacts = buildJsonArray {
                val cursor = context.contentResolver.query(
                    ContactsContract.Contacts.CONTENT_URI,
                    arrayOf(
                        ContactsContract.Contacts._ID,
                        ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
                        ContactsContract.Contacts.HAS_PHONE_NUMBER,
                        ContactsContract.Contacts.STARRED,
                        ContactsContract.Contacts.PHOTO_URI,
                        ContactsContract.Contacts.LOOKUP_KEY,
                    ),
                    "${ContactsContract.Contacts.STARRED} = 1",
                    null,
                    "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} ASC",
                )
                cursor?.use { c ->
                    while (c.moveToNext()) add(cursorToContact(c))
                }
            }
            put("contacts", contacts)
            put("count", contacts.size)
        }.toString()
    }

    /**
     * Get total contact count.
     */
    fun getContactCount(): Int {
        if (!hasPermission()) return 0
        val cursor = context.contentResolver.query(
            ContactsContract.Contacts.CONTENT_URI,
            arrayOf(ContactsContract.Contacts._ID),
            null, null, null,
        )
        return cursor?.use { it.count } ?: 0
    }

    // MARK: - Private helpers

    private fun cursorToContact(c: Cursor): JsonObject {
        return buildJsonObject {
            put("id", c.getString(0) ?: "")
            put("name", c.getString(1) ?: "")
            put("hasPhone", c.getInt(2) == 1)
            put("starred", c.getInt(3) == 1)
            put("photoUri", c.getString(4) ?: "")
            put("lookupKey", c.getString(5) ?: "")
        }
    }

    private fun getPhoneNumbers(contactId: String): JsonArray {
        return buildJsonArray {
            val cursor = context.contentResolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                arrayOf(
                    ContactsContract.CommonDataKinds.Phone.NUMBER,
                    ContactsContract.CommonDataKinds.Phone.TYPE,
                    ContactsContract.CommonDataKinds.Phone.LABEL,
                ),
                "${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?",
                arrayOf(contactId),
                null,
            )
            cursor?.use { c ->
                while (c.moveToNext()) {
                    add(buildJsonObject {
                        put("number", c.getString(0) ?: "")
                        put("type", phoneTypeLabel(c.getInt(1)))
                        put("label", c.getString(2) ?: "")
                    })
                }
            }
        }
    }

    private fun getEmails(contactId: String): JsonArray {
        return buildJsonArray {
            val cursor = context.contentResolver.query(
                ContactsContract.CommonDataKinds.Email.CONTENT_URI,
                arrayOf(
                    ContactsContract.CommonDataKinds.Email.ADDRESS,
                    ContactsContract.CommonDataKinds.Email.TYPE,
                ),
                "${ContactsContract.CommonDataKinds.Email.CONTACT_ID} = ?",
                arrayOf(contactId),
                null,
            )
            cursor?.use { c ->
                while (c.moveToNext()) {
                    add(buildJsonObject {
                        put("address", c.getString(0) ?: "")
                        put("type", emailTypeLabel(c.getInt(1)))
                    })
                }
            }
        }
    }

    private fun getOrganizations(contactId: String): JsonArray {
        return buildJsonArray {
            val cursor = context.contentResolver.query(
                ContactsContract.Data.CONTENT_URI,
                arrayOf(
                    ContactsContract.CommonDataKinds.Organization.COMPANY,
                    ContactsContract.CommonDataKinds.Organization.TITLE,
                ),
                "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?",
                arrayOf(contactId, ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE),
                null,
            )
            cursor?.use { c ->
                while (c.moveToNext()) {
                    add(buildJsonObject {
                        put("company", c.getString(0) ?: "")
                        put("title", c.getString(1) ?: "")
                    })
                }
            }
        }
    }

    private fun phoneTypeLabel(type: Int): String = when (type) {
        ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE -> "mobile"
        ContactsContract.CommonDataKinds.Phone.TYPE_HOME -> "home"
        ContactsContract.CommonDataKinds.Phone.TYPE_WORK -> "work"
        ContactsContract.CommonDataKinds.Phone.TYPE_MAIN -> "main"
        else -> "other"
    }

    private fun emailTypeLabel(type: Int): String = when (type) {
        ContactsContract.CommonDataKinds.Email.TYPE_HOME -> "home"
        ContactsContract.CommonDataKinds.Email.TYPE_WORK -> "work"
        else -> "other"
    }

    private fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
    }

    private fun errorJson(message: String): String {
        return buildJsonObject { put("error", message) }.toString()
    }
}
