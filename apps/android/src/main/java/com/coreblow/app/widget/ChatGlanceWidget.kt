package com.coreblow.app.widget

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.compose.runtime.Composable
import androidx.glance.GlanceModifier

class ChatGlanceWidget : GlanceAppWidget() {
    @Composable
    override fun Content() {
        // Widget content
    }
}

class ChatGlanceWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget = ChatGlanceWidget()
}
