package ai.coreblow.app.widget

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.*
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.*
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import ai.coreblow.app.ui.MainActivity
import ai.coreblow.app.formatter.ByteFormatter

// ============================================================
// Shared widget state reader
// ============================================================

private object WidgetDataSource {
    private const val PREFS_NAME = "coreblow_widget_data"

    fun getPrefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getConnectionStatus(context: Context): String =
        getPrefs(context).getString("connection_status", "Disconnected") ?: "Disconnected"

    fun getLatencyMs(context: Context): Int =
        getPrefs(context).getInt("latency_ms", 0)

    fun getGatewayHost(context: Context): String =
        getPrefs(context).getString("gateway_host", "") ?: ""

    fun getModelName(context: Context): String =
        getPrefs(context).getString("model_name", "Not connected") ?: "Not connected"

    fun getTodayTokens(context: Context): Long =
        getPrefs(context).getLong("today_tokens", 0)

    fun getTodayConversations(context: Context): Int =
        getPrefs(context).getInt("today_conversations", 0)

    fun getLastMessagePreview(context: Context): String =
        getPrefs(context).getString("last_message_preview", "No recent messages") ?: "No recent messages"

    fun getLastMessageTime(context: Context): Long =
        getPrefs(context).getLong("last_message_time", 0)

    fun getServerVersion(context: Context): String =
        getPrefs(context).getString("server_version", "") ?: ""

    /**
     * Update widget data from the main app.
     */
    fun update(
        context: Context,
        connectionStatus: String? = null,
        latencyMs: Int? = null,
        gatewayHost: String? = null,
        modelName: String? = null,
        todayTokens: Long? = null,
        todayConversations: Int? = null,
        lastMessagePreview: String? = null,
        serverVersion: String? = null,
    ) {
        val editor = getPrefs(context).edit()
        connectionStatus?.let { editor.putString("connection_status", it) }
        latencyMs?.let { editor.putInt("latency_ms", it) }
        gatewayHost?.let { editor.putString("gateway_host", it) }
        modelName?.let { editor.putString("model_name", it) }
        todayTokens?.let { editor.putLong("today_tokens", it) }
        todayConversations?.let { editor.putInt("today_conversations", it) }
        lastMessagePreview?.let {
            editor.putString("last_message_preview", it.take(100))
            editor.putLong("last_message_time", System.currentTimeMillis())
        }
        serverVersion?.let { editor.putString("server_version", it) }
        editor.apply()
    }
}

// ============================================================
// ChatGlanceWidget — quick chat input widget
// ============================================================

class ChatGlanceWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val preview = WidgetDataSource.getLastMessagePreview(context)
        val timeMs = WidgetDataSource.getLastMessageTime(context)
        val timeLabel = if (timeMs > 0) ByteFormatter.formatRelativeTime(timeMs) else ""

        provideContent {
            Column(
                modifier = GlanceModifier.fillMaxSize().padding(12.dp)
                    .clickable(actionStartActivity<MainActivity>()),
            ) {
                Row {
                    Text("💬", style = TextStyle(fontSize = 16.sp))
                    Spacer(GlanceModifier.width(6.dp))
                    Text("CoreBlow Chat", style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp))
                }
                Spacer(GlanceModifier.height(6.dp))
                Text(preview, style = TextStyle(fontSize = 11.sp))
                if (timeLabel.isNotBlank()) {
                    Spacer(GlanceModifier.height(2.dp))
                    Text(timeLabel, style = TextStyle(fontSize = 9.sp))
                }
                Spacer(GlanceModifier.height(6.dp))
                Text("Tap to open chat →", style = TextStyle(fontSize = 10.sp))
            }
        }
    }
}

class ChatGlanceWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget = ChatGlanceWidget()
}

// ============================================================
// StatusGlanceWidget — gateway connection status
// ============================================================

class StatusGlanceWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val status = WidgetDataSource.getConnectionStatus(context)
        val host = WidgetDataSource.getGatewayHost(context)
        val latency = WidgetDataSource.getLatencyMs(context)
        val version = WidgetDataSource.getServerVersion(context)

        val statusEmoji = when (status) {
            "Connected" -> "🟢"
            "Connecting" -> "🟡"
            else -> "🔴"
        }

        provideContent {
            Column(
                modifier = GlanceModifier.fillMaxSize().padding(12.dp)
                    .clickable(actionStartActivity<MainActivity>()),
            ) {
                Row {
                    Text(statusEmoji, style = TextStyle(fontSize = 14.sp))
                    Spacer(GlanceModifier.width(6.dp))
                    Text("Gateway", style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp))
                }
                Spacer(GlanceModifier.height(6.dp))
                Text(status, style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium))
                if (host.isNotBlank()) {
                    Text(host, style = TextStyle(fontSize = 10.sp))
                }
                if (latency > 0) {
                    Text("${latency}ms latency", style = TextStyle(fontSize = 10.sp))
                }
                if (version.isNotBlank()) {
                    Text("v$version", style = TextStyle(fontSize = 9.sp))
                }
            }
        }
    }
}

class StatusGlanceWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget = StatusGlanceWidget()
}

// ============================================================
// QuickChatGlanceWidget — one-tap chat shortcuts
// ============================================================

class QuickChatGlanceWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            Column(
                modifier = GlanceModifier.fillMaxSize().padding(12.dp)
                    .clickable(actionStartActivity<MainActivity>()),
            ) {
                Text("Quick Chat", style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp))
                Spacer(GlanceModifier.height(8.dp))
                Row {
                    Text("💬 New Chat", style = TextStyle(fontSize = 11.sp))
                    Spacer(GlanceModifier.width(12.dp))
                    Text("🎤 Voice", style = TextStyle(fontSize = 11.sp))
                }
                Spacer(GlanceModifier.height(4.dp))
                Row {
                    Text("📎 Attach", style = TextStyle(fontSize = 11.sp))
                    Spacer(GlanceModifier.width(12.dp))
                    Text("⚙️ Settings", style = TextStyle(fontSize = 11.sp))
                }
            }
        }
    }
}

class QuickChatGlanceWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget = QuickChatGlanceWidget()
}

// ============================================================
// ModelGlanceWidget — current model display
// ============================================================

class ModelGlanceWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val model = WidgetDataSource.getModelName(context)
        val status = WidgetDataSource.getConnectionStatus(context)

        provideContent {
            Column(
                modifier = GlanceModifier.fillMaxSize().padding(12.dp)
                    .clickable(actionStartActivity<MainActivity>()),
            ) {
                Text("🤖 Model", style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp))
                Spacer(GlanceModifier.height(6.dp))
                Text(model, style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium))
                Spacer(GlanceModifier.height(2.dp))
                Text(if (status == "Connected") "Active" else "Offline", style = TextStyle(fontSize = 10.sp))
            }
        }
    }
}

class ModelGlanceWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget = ModelGlanceWidget()
}

// ============================================================
// UsageGlanceWidget — token/API usage display
// ============================================================

class UsageGlanceWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val tokens = WidgetDataSource.getTodayTokens(context)
        val conversations = WidgetDataSource.getTodayConversations(context)

        provideContent {
            Column(
                modifier = GlanceModifier.fillMaxSize().padding(12.dp)
                    .clickable(actionStartActivity<MainActivity>()),
            ) {
                Text("📊 Today", style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp))
                Spacer(GlanceModifier.height(6.dp))
                Text("${ByteFormatter.formatNumber(tokens)} tokens", style = TextStyle(fontSize = 12.sp))
                Text("$conversations conversations", style = TextStyle(fontSize = 11.sp))
                Spacer(GlanceModifier.height(4.dp))
                Text("Tap for details →", style = TextStyle(fontSize = 9.sp))
            }
        }
    }
}

class UsageGlanceWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget = UsageGlanceWidget()
}
