package ai.coreblow.app.provider

import android.content.ContentProvider
import android.content.ContentValues
import android.net.Uri
import android.database.Cursor

class MessageProvider : ContentProvider() {
    override fun onCreate(): Boolean = true
    override fun query(uri: Uri, proj: Array<String>?, sel: String?, selArgs: Array<String>?, sort: String?): Cursor? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun update(uri: Uri, values: ContentValues?, sel: String?, selArgs: Array<String>?): Int = 0
    override fun delete(uri: Uri, sel: String?, selArgs: Array<String>?): Int = 0
    override fun getType(uri: Uri): String? = null
}
