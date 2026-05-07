package ai.coreblow.app.provider

import android.content.*
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.util.Log

/**
 * ContentProvider exposing conversation data to other apps and widgets.
 * Provides read-only access to conversations, messages, and sessions
 * via a structured URI scheme for Glance widgets and share targets.
 */
class ConversationProvider : ContentProvider() {

    companion object {
        private const val TAG = "ConversationProvider"
        const val AUTHORITY = "ai.coreblow.app.provider.conversations"
        val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY")

        // URI codes
        private const val CONVERSATIONS = 1
        private const val CONVERSATION_ID = 2
        private const val MESSAGES = 3
        private const val MESSAGE_ID = 4
        private const val SESSIONS = 5
        private const val RECENT = 6
        private const val STATS = 7

        // Column names
        val CONVERSATION_COLUMNS = arrayOf("_id", "title", "message_count", "last_message_ms", "is_starred", "is_archived", "provider", "model", "preview")
        val MESSAGE_COLUMNS = arrayOf("_id", "conversation_id", "role", "content", "created_at", "token_count", "model")
        val SESSION_COLUMNS = arrayOf("_id", "conversation_id", "gateway_host", "is_connected", "connected_at", "latency_ms")
        val STATS_COLUMNS = arrayOf("total_conversations", "total_messages", "starred_count", "active_sessions")

        private val uriMatcher = UriMatcher(UriMatcher.NO_MATCH).apply {
            addURI(AUTHORITY, "conversations", CONVERSATIONS)
            addURI(AUTHORITY, "conversations/#", CONVERSATION_ID)
            addURI(AUTHORITY, "conversations/#/messages", MESSAGES)
            addURI(AUTHORITY, "messages/#", MESSAGE_ID)
            addURI(AUTHORITY, "sessions", SESSIONS)
            addURI(AUTHORITY, "recent", RECENT)
            addURI(AUTHORITY, "stats", STATS)
        }
    }

    override fun onCreate(): Boolean {
        Log.i(TAG, "ConversationProvider created")
        return true
    }

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor? {
        return when (uriMatcher.match(uri)) {
            CONVERSATIONS -> queryConversations(projection, selection, selectionArgs, sortOrder)
            CONVERSATION_ID -> queryConversationById(uri.lastPathSegment, projection)
            MESSAGES -> queryMessages(uri, projection, selection, selectionArgs, sortOrder)
            MESSAGE_ID -> queryMessageById(uri.lastPathSegment, projection)
            SESSIONS -> querySessions(projection)
            RECENT -> queryRecentConversations(projection, sortOrder)
            STATS -> queryStats()
            else -> {
                Log.w(TAG, "Unknown URI: $uri")
                null
            }
        }
    }

    override fun getType(uri: Uri): String? = when (uriMatcher.match(uri)) {
        CONVERSATIONS, RECENT -> "vnd.android.cursor.dir/vnd.$AUTHORITY.conversation"
        CONVERSATION_ID -> "vnd.android.cursor.item/vnd.$AUTHORITY.conversation"
        MESSAGES -> "vnd.android.cursor.dir/vnd.$AUTHORITY.message"
        MESSAGE_ID -> "vnd.android.cursor.item/vnd.$AUTHORITY.message"
        SESSIONS -> "vnd.android.cursor.dir/vnd.$AUTHORITY.session"
        STATS -> "vnd.android.cursor.item/vnd.$AUTHORITY.stats"
        else -> null
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? {
        Log.w(TAG, "Insert not supported via provider (use ViewModel)")
        return null
    }

    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int {
        Log.w(TAG, "Update not supported via provider")
        return 0
    }

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int {
        Log.w(TAG, "Delete not supported via provider")
        return 0
    }

    // MARK: - Query implementations

    private fun queryConversations(
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor {
        val columns = projection ?: CONVERSATION_COLUMNS
        val cursor = MatrixCursor(columns)
        // In production, this would query Room database
        // For now, return empty cursor
        return cursor
    }

    private fun queryConversationById(id: String?, projection: Array<out String>?): Cursor {
        val columns = projection ?: CONVERSATION_COLUMNS
        return MatrixCursor(columns)
    }

    private fun queryMessages(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor {
        val columns = projection ?: MESSAGE_COLUMNS
        return MatrixCursor(columns)
    }

    private fun queryMessageById(id: String?, projection: Array<out String>?): Cursor {
        val columns = projection ?: MESSAGE_COLUMNS
        return MatrixCursor(columns)
    }

    private fun querySessions(projection: Array<out String>?): Cursor {
        val columns = projection ?: SESSION_COLUMNS
        return MatrixCursor(columns)
    }

    private fun queryRecentConversations(projection: Array<out String>?, sortOrder: String?): Cursor {
        val columns = projection ?: CONVERSATION_COLUMNS
        return MatrixCursor(columns)
    }

    private fun queryStats(): Cursor {
        val cursor = MatrixCursor(STATS_COLUMNS)
        cursor.addRow(arrayOf(0, 0, 0, 0)) // Placeholder
        return cursor
    }
}
