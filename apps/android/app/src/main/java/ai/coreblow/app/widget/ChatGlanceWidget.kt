package ai.coreblow.app.widget

import android.content.Context
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

// ============================================================
// ChatGlanceWidget — quick chat input widget
// ============================================================

class ChatGlanceWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            Column(
                modifier = GlanceModifier.fillMaxSize().padding(12.dp)
                    .clickable(actionStartActivity<MainActivity>()),
            ) {
                Text("CoreBlow Chat", style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp))
                Spacer(GlanceModifier.height(8.dp))
                Text("Tap to open chat", style = TextStyle(fontSize = 12.sp))
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
        provideContent {
            Column(
                modifier = GlanceModifier.fillMaxSize().padding(12.dp)
                    .clickable(actionStartActivity<MainActivity>()),
            ) {
                Text("Gateway Status", style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp))
                Spacer(GlanceModifier.height(6.dp))
                Text("Disconnected", style = TextStyle(fontSize = 12.sp))
                Spacer(GlanceModifier.height(4.dp))
                Text("Tap to connect", style = TextStyle(fontSize = 10.sp))
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
                Spacer(GlanceModifier.height(6.dp))
                Row {
                    Text("💬 New Chat", style = TextStyle(fontSize = 11.sp))
                    Spacer(GlanceModifier.width(8.dp))
                    Text("🎤 Voice", style = TextStyle(fontSize = 11.sp))
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
        provideContent {
            Column(
                modifier = GlanceModifier.fillMaxSize().padding(12.dp)
                    .clickable(actionStartActivity<MainActivity>()),
            ) {
                Text("Model", style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp))
                Spacer(GlanceModifier.height(6.dp))
                Text("Not connected", style = TextStyle(fontSize = 12.sp))
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
        provideContent {
            Column(
                modifier = GlanceModifier.fillMaxSize().padding(12.dp)
                    .clickable(actionStartActivity<MainActivity>()),
            ) {
                Text("Usage", style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp))
                Spacer(GlanceModifier.height(6.dp))
                Text("0 tokens today", style = TextStyle(fontSize = 12.sp))
                Text("0 conversations", style = TextStyle(fontSize = 10.sp))
            }
        }
    }
}

class UsageGlanceWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget = UsageGlanceWidget()
}
