package ai.coreblow.app.node.handlers

import android.content.Context
import android.provider.MediaStore
import android.util.Base64
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

class PhotosHandler(private val context: Context) : InvokeHandler {
    override val namespace = CoreBlowProtocol.NS_PHOTOS

    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        return when (command) {
            "list-photos" -> listPhotos(params)
            "get-photo" -> getPhoto(params)
            else -> throw IllegalArgumentException("Unknown command: $command")
        }
    }

    private fun listPhotos(params: JsonObject): JsonElement {
        val limit = params["limit"]?.jsonPrimitive?.content?.toIntOrNull() ?: 20

        val photos = buildJsonArray {
            val cursor = context.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                arrayOf(
                    MediaStore.Images.Media._ID,
                    MediaStore.Images.Media.DISPLAY_NAME,
                    MediaStore.Images.Media.DATE_ADDED,
                    MediaStore.Images.Media.SIZE,
                    MediaStore.Images.Media.WIDTH,
                    MediaStore.Images.Media.HEIGHT,
                ),
                null, null,
                "${MediaStore.Images.Media.DATE_ADDED} DESC",
            )

            cursor?.use {
                var count = 0
                while (it.moveToNext() && count < limit) {
                    add(buildJsonObject {
                        put("id", it.getLong(0).toString())
                        put("name", it.getString(1) ?: "")
                        put("dateAdded", it.getLong(2))
                        put("sizeBytes", it.getLong(3))
                        put("width", it.getInt(4))
                        put("height", it.getInt(5))
                    })
                    count++
                }
            }
        }

        return buildJsonObject {
            put("photos", photos)
            put("count", photos.size)
        }
    }

    private fun getPhoto(params: JsonObject): JsonElement {
        val photoId = params["id"]?.jsonPrimitive?.content
            ?: throw IllegalArgumentException("Missing 'id' parameter")
        val maxSizeKb = params["maxSizeKb"]?.jsonPrimitive?.content?.toIntOrNull() ?: 512

        val uri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            .buildUpon().appendPath(photoId).build()

        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            ?: throw IllegalStateException("Could not read photo: $photoId")

        val data = if (bytes.size > maxSizeKb * 1024) {
            bytes.copyOf(maxSizeKb * 1024)
        } else {
            bytes
        }

        val base64 = Base64.encodeToString(data, Base64.NO_WRAP)

        return buildJsonObject {
            put("id", photoId)
            put("base64", base64)
            put("sizeBytes", data.size)
        }
    }
}
