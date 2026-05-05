package ai.coreblow.app.voice

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.*
import org.junit.Test

class TalkModeConfigParsingTest {
    @Test fun `default config values`() { val c = TalkModeGatewayConfig(); assertEquals("en-US", c.language); assertEquals(30_000L, c.maxDurationMs) }
    @Test fun `fromJson parses language`() { val j = buildJsonObject { put("language", "id-ID") }; assertEquals("id-ID", TalkModeGatewayConfig.fromJson(j).language) }
    @Test fun `fromJson parses streamAudio`() { val j = buildJsonObject { put("streamAudio", "true") }; assertTrue(TalkModeGatewayConfig.fromJson(j).streamAudio) }
    @Test fun `fromJson missing fields use defaults`() { val c = TalkModeGatewayConfig.fromJson(buildJsonObject {}); assertEquals("default", c.sttModel); assertEquals("default", c.ttsVoice) }
    @Test fun `fromJson parses maxDurationMs`() { val j = buildJsonObject { put("maxDurationMs", "15000") }; assertEquals(15_000L, TalkModeGatewayConfig.fromJson(j).maxDurationMs) }
}
