package ai.coreblow.app.widget

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.compose.runtime.Composable
import androidx.glance.GlanceModifier

class ModelGlanceWidget : GlanceAppWidget() {
    @Composable
    override fun Content() {
        // Widget content
    }
}

class ModelGlanceWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget = ModelGlanceWidget()
}
