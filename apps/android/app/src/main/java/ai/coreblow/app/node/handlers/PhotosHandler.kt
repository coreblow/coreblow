package ai.coreblow.app.node.handlers

import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.database.Cursor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.util.Size
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.io.ByteArrayOutputStream

/**
 * Reads photos and media from the device gallery for gateway invoke commands.
 * Supports listing recent photos, fetching thumbnails, reading EXIF metadata,
 * and searching by date range or album.
 */
class PhotosHandler(private val appContext: Context) {

    companion object {
        private const val TAG = "PhotosHandler"
        private const val THUMBNAIL_SIZE = 256
        private const val THUMBNAIL_QUALITY = 70
        private const val MAX_RESULTS = 200
    }

    private val resolver: ContentResolver get() = appContext.contentResolver

    /**
     * Get recent photos with metadata.
     */
    suspend fun getRecentPhotos(limit: Int = 20): String = withContext(Dispatchers.IO) {
        val photos = mutableListOf<JsonObject>()
        val effectiveLimit = limit.coerceIn(1, MAX_RESULTS)

        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }

        val projection = arrayOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.DATE_ADDED,
            MediaStore.Images.Media.DATE_MODIFIED,
            MediaStore.Images.Media.SIZE,
            MediaStore.Images.Media.WIDTH,
            MediaStore.Images.Media.HEIGHT,
            MediaStore.Images.Media.MIME_TYPE,
            MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
        )

        val cursor = resolver.query(
            collection,
            projection,
            null, null,
            "${MediaStore.Images.Media.DATE_ADDED} DESC LIMIT $effectiveLimit",
        )

        cursor?.use { c ->
            while (c.moveToNext()) {
                val id = c.getLong(0)
                val name = c.getString(1) ?: "unknown"
                val dateAdded = c.getLong(2)
                val dateModified = c.getLong(3)
                val size = c.getLong(4)
                val width = c.getInt(5)
                val height = c.getInt(6)
                val mimeType = c.getString(7) ?: "image/jpeg"
                val bucket = c.getString(8) ?: ""

                photos.add(buildJsonObject {
                    put("id", JsonPrimitive(id))
                    put("name", JsonPrimitive(name))
                    put("dateAddedSec", JsonPrimitive(dateAdded))
                    put("dateModifiedSec", JsonPrimitive(dateModified))
                    put("sizeBytes", JsonPrimitive(size))
                    put("width", JsonPrimitive(width))
                    put("height", JsonPrimitive(height))
                    put("mimeType", JsonPrimitive(mimeType))
                    put("album", JsonPrimitive(bucket))
                    put("uri", JsonPrimitive(ContentUris.withAppendedId(collection, id).toString()))
                })
            }
        }

        kotlinx.serialization.json.JsonArray(photos).toString()
    }

    /**
     * Get a thumbnail for a photo as base64 JPEG.
     */
    suspend fun getThumbnail(photoId: Long, size: Int? = null): String? = withContext(Dispatchers.IO) {
        try {
            val effectiveSize = (size ?: THUMBNAIL_SIZE).coerceIn(64, 512)
            val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, photoId)

            val bitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                resolver.loadThumbnail(uri, Size(effectiveSize, effectiveSize), null)
            } else {
                @Suppress("DEPRECATION")
                MediaStore.Images.Thumbnails.getThumbnail(
                    resolver, photoId, MediaStore.Images.Thumbnails.MINI_KIND, null,
                )
            }

            if (bitmap == null) return@withContext null

            val scaled = if (bitmap.width > effectiveSize || bitmap.height > effectiveSize) {
                val scale = effectiveSize.toFloat() / maxOf(bitmap.width, bitmap.height)
                Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true)
            } else bitmap

            val stream = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, THUMBNAIL_QUALITY, stream)
            val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)

            if (scaled !== bitmap) scaled.recycle()
            bitmap.recycle()

            base64
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get thumbnail for $photoId: ${e.message}")
            null
        }
    }

    /**
     * Search photos by date range.
     */
    suspend fun searchByDateRange(startSec: Long, endSec: Long, limit: Int = 50): String = withContext(Dispatchers.IO) {
        val photos = mutableListOf<JsonObject>()
        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }

        val cursor = resolver.query(
            collection,
            arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.DATE_ADDED,
                MediaStore.Images.Media.WIDTH,
                MediaStore.Images.Media.HEIGHT,
                MediaStore.Images.Media.MIME_TYPE,
            ),
            "${MediaStore.Images.Media.DATE_ADDED} BETWEEN ? AND ?",
            arrayOf(startSec.toString(), endSec.toString()),
            "${MediaStore.Images.Media.DATE_ADDED} DESC LIMIT ${limit.coerceAtMost(MAX_RESULTS)}",
        )

        cursor?.use { c ->
            while (c.moveToNext()) {
                photos.add(buildJsonObject {
                    put("id", JsonPrimitive(c.getLong(0)))
                    put("name", JsonPrimitive(c.getString(1) ?: ""))
                    put("dateAddedSec", JsonPrimitive(c.getLong(2)))
                    put("width", JsonPrimitive(c.getInt(3)))
                    put("height", JsonPrimitive(c.getInt(4)))
                    put("mimeType", JsonPrimitive(c.getString(5) ?: ""))
                })
            }
        }

        kotlinx.serialization.json.JsonArray(photos).toString()
    }

    /**
     * Get album list with photo counts.
     */
    suspend fun getAlbums(): String = withContext(Dispatchers.IO) {
        val albums = mutableMapOf<String, Int>()
        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }

        val cursor = resolver.query(
            collection,
            arrayOf(MediaStore.Images.Media.BUCKET_DISPLAY_NAME),
            null, null, null,
        )

        cursor?.use { c ->
            while (c.moveToNext()) {
                val bucket = c.getString(0) ?: "Unknown"
                albums[bucket] = (albums[bucket] ?: 0) + 1
            }
        }

        val albumList = albums.map { (name, count) ->
            buildJsonObject {
                put("name", JsonPrimitive(name))
                put("count", JsonPrimitive(count))
            }
        }

        kotlinx.serialization.json.JsonArray(albumList).toString()
    }

    /**
     * Get total photo count.
     */
    fun getPhotoCount(): Int {
        val cursor = resolver.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            arrayOf("count(*) AS count"),
            null, null, null,
        )
        return cursor?.use { if (it.moveToFirst()) it.getInt(0) else 0 } ?: 0
    }

    fun handleCommand(subCommand: String, params: JsonObject): String? {
        return null // handled via suspend functions through InvokeDispatcher
    }
}
