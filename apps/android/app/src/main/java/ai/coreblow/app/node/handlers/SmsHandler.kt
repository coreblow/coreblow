package ai.coreblow.app.node.handlers

import android.content.Context
import android.telephony.SmsManager as AndroidSmsManager
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

class SmsHandler(private val context: Context) : InvokeHandler {
    override val namespace = CoreBlowProtocol.NS_SMS

    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        return when (command) {
            "read-sms" -> readSms(params)
            "send-sms" -> sendSms(params)
            else -> throw IllegalArgumentException("Unknown command: $command")
        }
    }

    private fun readSms(params: JsonObject): JsonElement {
        val limit = params["limit"]?.jsonPrimitive?.content?.toIntOrNull() ?: 10
        val messages = buildJsonArray {
            val cursor = context.contentResolver.query(
                android.net.Uri.parse("content://sms/inbox"),
                arrayOf("_id", "address", "body", "date"),
                null, null, "date DESC",
            )
            cursor?.use {
                var count = 0
                while (it.moveToNext() && count < limit) {
                    add(buildJsonObject {
                        put("id", it.getString(0))
                        put("address", it.getString(1) ?: "")
                        put("body", it.getString(2) ?: "")
                        put("date", it.getLong(3))
                    })
                    count++
                }
            }
        }
        return buildJsonObject { put("messages", messages) }
    }

    private fun sendSms(params: JsonObject): JsonElement {
        val to = params["to"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'to'")
        val body = params["body"]?.jsonPrimitive?.content ?: throw IllegalArgumentException("Missing 'body'")
        val smsManager = context.getSystemService(AndroidSmsManager::class.java)
        smsManager.sendTextMessage(to, null, body, null, null)
        return buildJsonObject { put("sent", true); put("to", to) }
    }
}
