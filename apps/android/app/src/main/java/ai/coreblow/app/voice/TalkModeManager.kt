package ai.coreblow.app.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import ai.coreblow.app.gateway.GatewaySession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.io.File
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * Talk mode lifecycle state.
 */
enum class TalkModeState {
    INACTIVE,
    RECORDING,
    PROCESSING,
    SPEAKING,
    ERROR,
}

/**
 * Manages full talk mode lifecycle:
 * wake detection → speech capture → gateway processing → TTS response → loop.
 *
 * Coordinates between VoiceWakeManager, MicCaptureManager,
 * and the gateway session for end-to-end voice interaction.
 * Supports chat subscription for streaming assistant replies,
 * audio focus management, TTS queueing, and gateway event routing.
 */
class TalkModeManager(
    private val context: Context,
    private val scope: CoroutineScope,
    private val session: GatewaySession,
    private val supportsChatSubscribe: Boolean,
    private val isConnected: () -> Boolean,
) {
    companion object {
        private const val TAG = "TalkModeManager"
        private const val MAX_TTS_LENGTH = 4000
        private const val TTS_UTTERANCE_PREFIX = "coreblow-tts-"
        private const val CHAT_SUBSCRIBE_DEBOUNCE_MS = 500L
    }

    private val _state = MutableStateFlow(TalkModeState.INACTIVE)
    val state: StateFlow<TalkModeState> = _state.asStateFlow()

    private val _currentUtterance = MutableStateFlow<String?>(null)
    val currentUtterance: StateFlow<String?> = _currentUtterance.asStateFlow()

    private val _ttsProgress = MutableStateFlow(0f)
    val ttsProgress: StateFlow<Float> = _ttsProgress.asStateFlow()

    private val _isTtsSpeaking = MutableStateFlow(false)
    val isTtsSpeaking: StateFlow<Boolean> = _isTtsSpeaking.asStateFlow()

    private val _conversationHistory = MutableStateFlow<List<VoiceConversationEntry>>(emptyList())
    val conversationHistory: StateFlow<List<VoiceConversationEntry>> = _conversationHistory.asStateFlow()

    var ttsOnAllResponses: Boolean = false
    private var playbackEnabled: Boolean = true
    private var mainSessionKey: String = "main"

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var recordingJob: Job? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var mediaPlayer: MediaPlayer? = null
    private var chatSubscribeJob: Job? = null
    private var chatSubscribed = false

    private val ttsQueue = ConcurrentLinkedQueue<String>()
    private var isSpeakingSequence = false
    private val json = Json { ignoreUnknownKeys = true }

    // MARK: - Init

    fun initialize() {
        tts = TextToSpeech(context) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                tts?.language = Locale.getDefault()
                tts?.setSpeechRate(1.0f)
                tts?.setPitch(1.0f)
                setupTtsListener()
                Log.i(TAG, "TTS initialized")
            } else {
                Log.e(TAG, "TTS initialization failed")
            }
        }
    }

    private fun setupTtsListener() {
        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                _isTtsSpeaking.value = true
                _state.value = TalkModeState.SPEAKING
            }

            override fun onDone(utteranceId: String?) {
                _isTtsSpeaking.value = false
                processNextInQueue()
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                Log.w(TAG, "TTS utterance error: $utteranceId")
                _isTtsSpeaking.value = false
                processNextInQueue()
            }

            override fun onError(utteranceId: String?, errorCode: Int) {
                Log.w(TAG, "TTS utterance error: $utteranceId code=$errorCode")
                _isTtsSpeaking.value = false
                processNextInQueue()
            }
        })
    }

    // MARK: - Session Key

    fun setMainSessionKey(key: String) {
        val trimmed = key.trim()
        if (trimmed.isEmpty() || trimmed == mainSessionKey) return
        mainSessionKey = trimmed
        if (chatSubscribed && supportsChatSubscribe) {
            chatSubscribed = false
            scope.launch { ensureChatSubscribed() }
        }
    }

    // MARK: - Chat Subscribe

    suspend fun ensureChatSubscribed() {
        if (!supportsChatSubscribe) return
        if (chatSubscribed) return
        if (!isConnected()) return

        chatSubscribeJob?.cancel()
        chatSubscribeJob = scope.launch {
            delay(CHAT_SUBSCRIBE_DEBOUNCE_MS)
            try {
                val params = """{"sessionKey":"$mainSessionKey"}"""
                session.sendNodeEvent("chat.subscribe", params)
                chatSubscribed = true
                Log.d(TAG, "Chat subscribed for session: $mainSessionKey")
            } catch (e: Throwable) {
                Log.w(TAG, "Chat subscribe failed: ${e.message}")
                chatSubscribed = false
            }
        }
    }

    // MARK: - Gateway Events

    fun handleGatewayEvent(event: String, payloadJson: String?) {
        when (event) {
            "chat" -> handleChatEvent(payloadJson)
            "tts.audio" -> handleTtsAudioEvent(payloadJson)
            "voice.directive" -> handleVoiceDirective(payloadJson)
        }
    }

    private fun handleChatEvent(payloadJson: String?) {
        if (payloadJson.isNullOrBlank()) return
        if (!ttsOnAllResponses) return

        try {
            val root = json.parseToJsonElement(payloadJson) as? JsonObject ?: return
            val state = (root["state"] as? JsonPrimitive)?.content
            if (state == "final") {
                val message = root["message"] as? JsonObject ?: return
                val role = (message["role"] as? JsonPrimitive)?.content
                if (role == "assistant") {
                    val text = extractAssistantText(message)
                    if (text.isNotBlank()) {
                        addConversationEntry(VoiceConversationEntry(role = "assistant", text = text, timestampMs = System.currentTimeMillis()))
                        speakAssistantReply(text)
                    }
                }
            }
        } catch (_: Throwable) {}
    }

    private fun extractAssistantText(message: JsonObject): String {
        val content = message["content"]
        if (content is kotlinx.serialization.json.JsonArray) {
            val parts = content.mapNotNull { el ->
                val obj = el as? JsonObject ?: return@mapNotNull null
                val type = (obj["type"] as? JsonPrimitive)?.content
                if (type == "text") (obj["text"] as? JsonPrimitive)?.content else null
            }
            return parts.joinToString(" ").trim()
        }
        return (content as? JsonPrimitive)?.content?.trim().orEmpty()
    }

    private fun handleTtsAudioEvent(payloadJson: String?) {
        if (payloadJson.isNullOrBlank()) return
        if (!playbackEnabled) return
        try {
            val root = json.parseToJsonElement(payloadJson) as? JsonObject ?: return
            val audioUrl = (root["url"] as? JsonPrimitive)?.content?.trim()
            if (!audioUrl.isNullOrEmpty()) playAudioUrl(audioUrl)
        } catch (_: Throwable) {}
    }

    private fun handleVoiceDirective(payloadJson: String?) {
        if (payloadJson.isNullOrBlank()) return
        try {
            val root = json.parseToJsonElement(payloadJson) as? JsonObject ?: return
            val type = (root["type"] as? JsonPrimitive)?.content?.trim().orEmpty()
            when (type) {
                "speak" -> {
                    val text = (root["text"] as? JsonPrimitive)?.content?.trim().orEmpty()
                    if (text.isNotEmpty()) speakAssistantReply(text)
                }
                "stop" -> stopTts()
                "navigate" -> Log.i(TAG, "Navigate directive: ${(root["target"] as? JsonPrimitive)?.content}")
                else -> Log.w(TAG, "Unknown directive type: $type")
            }
        } catch (_: Throwable) {}
    }

    // MARK: - TTS

    fun speakAssistantReply(text: String) {
        if (!playbackEnabled) return
        val cleaned = cleanTextForTts(text)
        if (cleaned.isBlank()) return

        if (cleaned.length > MAX_TTS_LENGTH) {
            val chunks = splitForTts(cleaned)
            ttsQueue.addAll(chunks)
        } else {
            ttsQueue.add(cleaned)
        }

        if (!isSpeakingSequence) processNextInQueue()
    }

    private fun processNextInQueue() {
        val next = ttsQueue.poll()
        if (next == null) {
            isSpeakingSequence = false
            if (_state.value == TalkModeState.SPEAKING) _state.value = TalkModeState.INACTIVE
            _currentUtterance.value = null
            return
        }

        isSpeakingSequence = true
        _currentUtterance.value = next
        requestAudioFocus()

        val utteranceId = "$TTS_UTTERANCE_PREFIX${UUID.randomUUID()}"
        tts?.speak(next, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
    }

    fun stopTts() {
        ttsQueue.clear()
        isSpeakingSequence = false
        tts?.stop()
        _isTtsSpeaking.value = false
        _currentUtterance.value = null
        mediaPlayer?.let { mp ->
            try { mp.stop(); mp.release() } catch (_: Throwable) {}
        }
        mediaPlayer = null
        abandonAudioFocus()
        if (_state.value == TalkModeState.SPEAKING) _state.value = TalkModeState.INACTIVE
    }

    fun setPlaybackEnabled(enabled: Boolean) {
        playbackEnabled = enabled
        if (!enabled) stopTts()
    }

    // MARK: - Audio Playback

    private fun playAudioUrl(url: String) {
        stopTts()
        requestAudioFocus()
        _state.value = TalkModeState.SPEAKING

        try {
            mediaPlayer?.release()
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build())
                setDataSource(url)
                setOnCompletionListener {
                    _state.value = TalkModeState.INACTIVE
                    abandonAudioFocus()
                    it.release()
                    mediaPlayer = null
                }
                setOnErrorListener { mp, what, extra ->
                    Log.e(TAG, "MediaPlayer error: what=$what extra=$extra")
                    _state.value = TalkModeState.INACTIVE
                    abandonAudioFocus()
                    mp.release()
                    mediaPlayer = null
                    true
                }
                prepareAsync()
                setOnPreparedListener { it.start() }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play audio: ${e.message}")
            _state.value = TalkModeState.INACTIVE
            abandonAudioFocus()
        }
    }

    // MARK: - Conversation History

    private fun addConversationEntry(entry: VoiceConversationEntry) {
        val current = _conversationHistory.value.toMutableList()
        current.add(entry)
        if (current.size > 50) current.removeAt(0)
        _conversationHistory.value = current
    }

    fun clearConversationHistory() {
        _conversationHistory.value = emptyList()
    }

    // MARK: - Connection

    fun onGatewayConnectionChanged(connected: Boolean) {
        if (!connected) {
            chatSubscribed = false
            if (_state.value != TalkModeState.INACTIVE) {
                stopTts()
                _state.value = TalkModeState.INACTIVE
            }
        }
    }

    // MARK: - Release

    fun release() {
        stopTts()
        chatSubscribeJob?.cancel()
        recordingJob?.cancel()
        tts?.shutdown()
        tts = null
        ttsReady = false
        mediaPlayer?.release()
        mediaPlayer = null
    }

    // MARK: - Audio Focus

    private fun requestAudioFocus() {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
            .setAudioAttributes(AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build())
            .setOnAudioFocusChangeListener { focusChange ->
                if (focusChange == AudioManager.AUDIOFOCUS_LOSS) stopTts()
            }
            .build()
        audioManager.requestAudioFocus(request)
        audioFocusRequest = request
    }

    private fun abandonAudioFocus() {
        audioFocusRequest?.let { request ->
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.abandonAudioFocusRequest(request)
        }
        audioFocusRequest = null
    }

    // MARK: - Text Cleanup

    private fun cleanTextForTts(text: String): String {
        var cleaned = text
        // Strip markdown
        cleaned = cleaned.replace(Regex("```[\\s\\S]*?```"), " code block ")
        cleaned = cleaned.replace(Regex("`[^`]+`"), " code ")
        cleaned = cleaned.replace(Regex("\\*\\*(.+?)\\*\\*"), "$1")
        cleaned = cleaned.replace(Regex("\\*(.+?)\\*"), "$1")
        cleaned = cleaned.replace(Regex("#{1,6}\\s+"), "")
        cleaned = cleaned.replace(Regex("\\[(.+?)]\\(.+?\\)"), "$1")
        // Strip URLs
        cleaned = cleaned.replace(Regex("https?://\\S+"), " link ")
        // Collapse whitespace
        cleaned = cleaned.replace(Regex("\\s+"), " ").trim()
        return cleaned
    }

    private fun splitForTts(text: String): List<String> {
        val chunks = mutableListOf<String>()
        val sentences = text.split(Regex("(?<=[.!?])\\s+"))
        val current = StringBuilder()
        for (sentence in sentences) {
            if (current.length + sentence.length + 1 > MAX_TTS_LENGTH) {
                if (current.isNotEmpty()) chunks.add(current.toString().trim())
                current.clear()
            }
            if (current.isNotEmpty()) current.append(" ")
            current.append(sentence)
        }
        if (current.isNotEmpty()) chunks.add(current.toString().trim())
        return chunks
    }
}

/**
 * A single entry in the voice conversation history.
 */
data class VoiceConversationEntry(
    val role: String,
    val text: String,
    val timestampMs: Long,
)
