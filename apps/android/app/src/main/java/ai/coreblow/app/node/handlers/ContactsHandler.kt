package ai.coreblow.app.node.handlers

import android.content.Context
import android.provider.ContactsContract
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

class ContactsHandler(private val context: Context) : InvokeHandler {
    override val namespace = CoreBlowProtocol.NS_CONTACTS

    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        return when (command) {
            "list-contacts" -> listContacts(params)
            "search-contacts" -> searchContacts(params)
            else -> throw IllegalArgumentException("Unknown command: $command")
        }
    }

    private fun listContacts(params: JsonObject): JsonElement {
        val limit = params["limit"]?.jsonPrimitive?.content?.toIntOrNull() ?: 50
        return queryContacts(selection = null, selectionArgs = null, limit = limit)
    }

    private fun searchContacts(params: JsonObject): JsonElement {
        val query = params["query"]?.jsonPrimitive?.content
            ?: throw IllegalArgumentException("Missing 'query' parameter")
        val limit = params["limit"]?.jsonPrimitive?.content?.toIntOrNull() ?: 20

        val selection = "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} LIKE ?"
        val selectionArgs = arrayOf("%$query%")
        return queryContacts(selection, selectionArgs, limit)
    }

    private fun queryContacts(selection: String?, selectionArgs: Array<String>?, limit: Int): JsonElement {
        val contacts = buildJsonArray {
            val cursor = context.contentResolver.query(
                ContactsContract.Contacts.CONTENT_URI,
                arrayOf(
                    ContactsContract.Contacts._ID,
                    ContactsContract.Contacts.DISPLAY_NAME_PRIMARY,
                    ContactsContract.Contacts.HAS_PHONE_NUMBER,
                ),
                selection,
                selectionArgs,
                "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} ASC",
            )

            cursor?.use {
                var count = 0
                while (it.moveToNext() && count < limit) {
                    val id = it.getString(0)
                    val name = it.getString(1) ?: ""
                    val hasPhone = it.getInt(2) > 0

                    add(buildJsonObject {
                        put("id", id)
                        put("name", name)
                        put("hasPhone", hasPhone)
                    })
                    count++
                }
            }
        }

        return buildJsonObject {
            put("contacts", contacts)
            put("count", contacts.size)
        }
    }
}
