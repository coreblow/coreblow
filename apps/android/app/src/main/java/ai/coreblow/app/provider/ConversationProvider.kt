package ai.coreblow.app.provider

import android.content.ContentProvider
import android.content.ContentValues
import android.content.UriMatcher
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.util.Log

// ============================================================
// ConversationProvider — content provider for conversations
// ============================================================

class ConversationProvider : ContentProvider() {
    companion object {
        private const val TAG = "ConversationProvider"
        const val AUTHORITY = "ai.coreblow.app.provider.conversations"
        val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY/conversations")
        private const val CONVERSATIONS = 1
        private const val CONVERSATION_ID = 2
        private val uriMatcher = UriMatcher(UriMatcher.NO_MATCH).apply {
            addURI(AUTHORITY, "conversations", CONVERSATIONS)
            addURI(AUTHORITY, "conversations/#", CONVERSATION_ID)
        }
    }

    override fun onCreate(): Boolean { Log.d(TAG, "Provider created"); return true }
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor {
        val cursor = MatrixCursor(arrayOf("_id", "title", "created_at"))
        // Return from local repository
        return cursor
    }
    override fun getType(uri: Uri): String = when (uriMatcher.match(uri)) {
        CONVERSATIONS -> "vnd.android.cursor.dir/conversation"
        CONVERSATION_ID -> "vnd.android.cursor.item/conversation"
        else -> throw IllegalArgumentException("Unknown URI: $uri")
    }
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
}

// ============================================================
// MessageProvider — content provider for messages
// ============================================================

class MessageProvider : ContentProvider() {
    companion object {
        const val AUTHORITY = "ai.coreblow.app.provider.messages"
        val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY/messages")
    }
    override fun onCreate(): Boolean = true
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor = MatrixCursor(arrayOf("_id", "role", "content", "created_at"))
    override fun getType(uri: Uri): String = "vnd.android.cursor.dir/message"
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
}

// ============================================================
// SettingsProvider — content provider for settings
// ============================================================

class SettingsProvider : ContentProvider() {
    companion object {
        const val AUTHORITY = "ai.coreblow.app.provider.settings"
        val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY/settings")
    }
    override fun onCreate(): Boolean = true
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor = MatrixCursor(arrayOf("key", "value", "type"))
    override fun getType(uri: Uri): String = "vnd.android.cursor.dir/setting"
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
