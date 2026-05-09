package ai.coreblow.app.voice

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import ai.coreblow.app.gateway.GatewaySession
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicLong

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
        private const val listenWatchdogMs = 12_000L
        private const val maxCachedRunCompletions = 128
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    // OC-parity state flows
    private val _isEnabled = MutableStateFlow(false)
    val isEnabled: StateFlow<Boolean> = _isEnabled
    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening
    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking
    private val _statusText = MutableStateFlow("Off")
    val statusText: StateFlow<String> = _statusText
    private val _lastAssistantText = MutableStateFlow<String?>(null)
    val lastAssistantText: StateFlow<String?> = _lastAssistantText

    // Legacy state flows (kept for backward compat)
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

    @Volatile var ttsOnAllResponses: Boolean = false
    @Volatile private var playbackEnabled: Boolean = true
    private var mainSessionKey: String = "main"

    // SpeechRecognizer lifecycle
    private var recognizer: SpeechRecognizer? = null
    private var restartJob: Job? = null
    private var stopRequested = false
    private var listeningMode = false

    // Silence monitor
    private var silenceJob: Job? = null
    private var silenceWindowMs = 2000L
    private var lastTranscript: String = ""
    private var lastHeardAtMs: Long? = null
    private var lastSpokenText: String? = null
    @Volatile private var finalizeInFlight = false

    // Interrupt-on-speech
    private var interruptOnSpeech: Boolean = false
    private var lastInterruptedAtSeconds: Double? = null

    // Pending run tracking
    @Volatile private var pendingRunId: String? = null
    private var pendingFinal: CompletableDeferred<Boolean>? = null
    private val completedRunsLock = Any()
    private val completedRunStates = LinkedHashMap<String, Boolean>()
    private val completedRunTexts = LinkedHashMap<String, String>()
    private var chatSubscribedSessionKey: String? = null
    private var configLoaded = false
    private val playbackGeneration = AtomicLong(0L)

    // TTS engine
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var ttsJob: Job? = null
    private val ttsLock = Any()
    private var textToSpeechInit: CompletableDeferred<TextToSpeech>? = null
    @Volatile private var currentUtteranceId: String? = null

    private var recordingJob: Job? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var mediaPlayer: MediaPlayer? = null
    private var chatSubscribeJob: Job? = null
    private var chatSubscribed = false
    private var listenWatchdogJob: Job? = null

    private val ttsQueue = ConcurrentLinkedQueue<String>()
    private var isSpeakingSequence = false
    private val json = Json { ignoreUnknownKeys = true }

    private val audioFocusListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                if (_isSpeaking.value) { Log.d(TAG, "audio focus lost; stopping TTS"); stopSpeaking(resetInterrupt = true) }
            }
        }
    }

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

    // MARK: - Enable/Disable

    fun setEnabled(enabled: Boolean) {
        if (_isEnabled.value == enabled) return
        _isEnabled.value = enabled
        if (enabled) { Log.d(TAG, "enabled"); start() } else { Log.d(TAG, "disabled"); stop() }
    }

    private fun start() {
        mainHandler.post {
            if (_isListening.value) return@post
            stopRequested = false; listeningMode = true
            if (!SpeechRecognizer.isRecognitionAvailable(context)) { _statusText.value = "Speech recognizer unavailable"; return@post }
            val micOk = androidx.core.content.ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
            if (!micOk) { _statusText.value = "Microphone permission required"; return@post }
            try {
                recognizer?.destroy()
                recognizer = SpeechRecognizer.createSpeechRecognizer(context).also { it.setRecognitionListener(recognitionListener) }
                startListeningInternal(markListening = true)
                startSilenceMonitor()
            } catch (err: Throwable) { _statusText.value = "Start failed: ${err.message}" }
        }
    }

    private fun stop() {
        stopRequested = true; finalizeInFlight = false; listeningMode = false
        restartJob?.cancel(); silenceJob?.cancel(); lastTranscript = ""; lastHeardAtMs = null
        _isListening.value = false; _statusText.value = "Off"
        stopSpeaking(resetInterrupt = true)
        chatSubscribedSessionKey = null; pendingRunId = null
        pendingFinal?.cancel(); pendingFinal = null
        synchronized(completedRunsLock) { completedRunStates.clear(); completedRunTexts.clear() }
        mainHandler.post { recognizer?.cancel(); recognizer?.destroy(); recognizer = null }
        shutdownTextToSpeech()
    }

    private fun startListeningInternal(markListening: Boolean) {
        val r = recognizer ?: return
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1800L)
        }
        if (markListening) { _statusText.value = "Listening"; _isListening.value = true }
        r.startListening(intent)
    }

    private fun scheduleRestart(delayMs: Long = 350) {
        if (stopRequested) return
        restartJob?.cancel()
        restartJob = scope.launch {
            delay(delayMs)
            mainHandler.post {
                if (stopRequested) return@post
                try { recognizer?.cancel(); if (listeningMode && !finalizeInFlight) startListeningInternal(markListening = true) } catch (_: Throwable) {}
            }
        }
    }

    private fun handleTranscript(text: String, isFinal: Boolean) {
        val trimmed = text.trim()
        if (_isSpeaking.value && interruptOnSpeech) { if (shouldInterrupt(trimmed)) stopSpeaking(resetInterrupt = true); return }
        if (!_isListening.value) return
        if (trimmed.isNotEmpty()) { lastTranscript = trimmed; lastHeardAtMs = SystemClock.elapsedRealtime() }
        if (isFinal) lastTranscript = trimmed
    }

    private fun startSilenceMonitor() {
        silenceJob?.cancel()
        silenceJob = scope.launch { while (_isEnabled.value) { delay(200); checkSilence() } }
    }

    private fun checkSilence() {
        if (!_isListening.value) return
        val transcript = lastTranscript.trim(); if (transcript.isEmpty()) return
        val lastHeard = lastHeardAtMs ?: return
        if (SystemClock.elapsedRealtime() - lastHeard < silenceWindowMs) return
        if (finalizeInFlight) return
        finalizeInFlight = true
        scope.launch { try { finalizeTranscript(transcript) } finally { finalizeInFlight = false } }
    }

    private suspend fun finalizeTranscript(transcript: String) {
        listeningMode = false; _isListening.value = false; _statusText.value = "Thinking…"
        lastTranscript = ""; lastHeardAtMs = null
        withContext(Dispatchers.Main) { recognizer?.cancel(); recognizer?.destroy(); recognizer = null }
        if (!isConnected()) { _statusText.value = "Gateway not connected"; start(); return }
        try {
            val startedAt = System.currentTimeMillis().toDouble() / 1000.0
            subscribeChatIfNeeded(mainSessionKey)
            val prompt = buildPrompt(transcript)
            val runId = sendChat(prompt)
            val ok = waitForChatFinal(runId)
            val assistant = consumeRunText(runId) ?: waitForAssistantText(startedAt, if (ok) 12_000 else 25_000)
            if (assistant.isNullOrBlank()) { _statusText.value = "No reply"; start(); return }
            val playbackToken = playbackGeneration.incrementAndGet()
            stopSpeaking(resetInterrupt = false)
            _statusText.value = "Speaking…"; _isSpeaking.value = true; _lastAssistantText.value = assistant
            requestAudioFocus()
            speakWithSystemTts(assistant, playbackToken)
        } catch (err: Throwable) {
            if (err is CancellationException) return
            _statusText.value = "Talk failed: ${err.message}"
        } finally { _isSpeaking.value = false }
        if (_isEnabled.value) start()
    }

    private suspend fun subscribeChatIfNeeded(sessionKey: String) {
        if (!supportsChatSubscribe) return
        val key = sessionKey.trim(); if (key.isEmpty() || chatSubscribedSessionKey == key) return
        val sent = session.sendNodeEvent("chat.subscribe", """{"sessionKey":"$key"}""")
        if (sent) { chatSubscribedSessionKey = key } else { Log.w(TAG, "chat.subscribe failed") }
    }

    private fun buildPrompt(transcript: String): String {
        val lines = mutableListOf("Talk Mode active. Reply in a concise, spoken tone.")
        lastInterruptedAtSeconds?.let { lines.add("Assistant speech interrupted at ${"%.1f".format(it)}s."); lastInterruptedAtSeconds = null }
        lines.add(""); lines.add(transcript)
        return lines.joinToString("\n")
    }

    private suspend fun sendChat(message: String): String {
        val runId = UUID.randomUUID().toString()
        val params = buildJsonObject {
            put("sessionKey", JsonPrimitive(mainSessionKey.ifBlank { "main" }))
            put("message", JsonPrimitive(message)); put("thinking", JsonPrimitive("low"))
            put("timeoutMs", JsonPrimitive(30_000)); put("idempotencyKey", JsonPrimitive(runId))
        }
        val res = session.request("chat.send", params.toString())
        return parseRunId(res) ?: runId
    }

    private suspend fun waitForChatFinal(runId: String): Boolean {
        pendingFinal?.cancel()
        val deferred = CompletableDeferred<Boolean>(); pendingRunId = runId; pendingFinal = deferred
        val result = withContext(Dispatchers.IO) { try { kotlinx.coroutines.withTimeout(120_000) { deferred.await() } } catch (_: Throwable) { false } }
        if (!result) { pendingFinal = null; pendingRunId = null }
        return result
    }

    private fun cacheRunCompletion(runId: String, isFinal: Boolean) {
        synchronized(completedRunsLock) {
            completedRunStates[runId] = isFinal
            while (completedRunStates.size > maxCachedRunCompletions) completedRunStates.entries.firstOrNull()?.let { completedRunStates.remove(it.key) }
        }
    }

    private fun consumeRunText(runId: String): String? = synchronized(completedRunsLock) { completedRunTexts.remove(runId) }

    private suspend fun waitForAssistantText(sinceSeconds: Double, timeoutMs: Long): String? {
        val deadline = SystemClock.elapsedRealtime() + timeoutMs
        while (SystemClock.elapsedRealtime() < deadline) {
            val key = mainSessionKey.ifBlank { "main" }
            val res = try { session.request("chat.history", """{"sessionKey":"$key"}""") } catch (_: Throwable) { null }
            if (res != null) {
                val root = json.parseToJsonElement(res) as? JsonObject
                val messages = root?.get("messages") as? JsonArray
                messages?.reversed()?.forEach { item ->
                    val obj = item as? JsonObject ?: return@forEach
                    if ((obj["role"] as? JsonPrimitive)?.content != "assistant") return@forEach
                    val content = obj["content"] as? JsonArray ?: return@forEach
                    val text = content.mapNotNull { (it as? JsonObject)?.get("text")?.let { t -> (t as? JsonPrimitive)?.content?.trim() } }.filter { it.isNotEmpty() }
                    if (text.isNotEmpty()) return text.joinToString("\n")
                }
            }
            delay(300)
        }
        return null
    }

    private suspend fun speakWithSystemTts(text: String, playbackToken: Long) {
        val engine = ensureTextToSpeechEngine()
        val utteranceId = UUID.randomUUID().toString()
        val finished = CompletableDeferred<Unit>()
        withContext(Dispatchers.Main) {
            synchronized(ttsLock) { currentUtteranceId = utteranceId; engine.stop() }
            engine.setSpeechRate(1.0f)
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(u: String?) = Unit
                override fun onDone(u: String?) { if (u == currentUtteranceId) finished.complete(Unit) }
                @Deprecated("Deprecated in Java") override fun onError(u: String?) { if (u == currentUtteranceId) finished.completeExceptionally(IllegalStateException("TTS failed")) }
                override fun onError(u: String?, code: Int) { if (u == currentUtteranceId) finished.completeExceptionally(IllegalStateException("TTS failed ($code)")) }
                override fun onStop(u: String?, interrupted: Boolean) { if (u == currentUtteranceId) finished.completeExceptionally(CancellationException("cancelled")) }
            })
            if (engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId) != TextToSpeech.SUCCESS) throw IllegalStateException("TTS start failed")
        }
        try { finished.await() } finally { synchronized(ttsLock) { if (currentUtteranceId == utteranceId) currentUtteranceId = null } }
    }

    private suspend fun ensureTextToSpeechEngine(): TextToSpeech {
        synchronized(ttsLock) { tts?.let { return it } }
        val deferred = CompletableDeferred<TextToSpeech>()
        withContext(Dispatchers.Main) {
            var engine: TextToSpeech? = null
            engine = TextToSpeech(context) { status ->
                if (status == TextToSpeech.SUCCESS) { synchronized(ttsLock) { tts = engine }; deferred.complete(engine!!) }
                else { engine?.shutdown(); deferred.completeExceptionally(IllegalStateException("TTS init failed")) }
            }
        }
        return deferred.await()
    }

    private fun shutdownTextToSpeech() { synchronized(ttsLock) { currentUtteranceId = null; tts?.stop(); tts?.shutdown(); tts = null; textToSpeechInit = null } }
    private fun stopSpeaking(resetInterrupt: Boolean = true) {
        if (resetInterrupt) lastInterruptedAtSeconds = null
        synchronized(ttsLock) { currentUtteranceId = null; tts?.stop() }
        _isSpeaking.value = false; abandonAudioFocus()
    }
    private fun shouldInterrupt(transcript: String): Boolean {
        if (transcript.length < 3) return false
        lastSpokenText?.lowercase()?.let { if (it.contains(transcript.lowercase())) return false }
        return true
    }
    private fun parseRunId(jsonString: String): String? = try { (json.parseToJsonElement(jsonString) as? JsonObject)?.get("runId")?.let { (it as? JsonPrimitive)?.content } } catch (_: Throwable) { null }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) { if (_isEnabled.value) _statusText.value = if (_isListening.value) "Listening" else _statusText.value }
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() { listenWatchdogJob?.cancel(); if (!finalizeInFlight) scheduleRestart() }
        override fun onError(error: Int) {
            if (stopRequested) return; _isListening.value = false
            if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) { _statusText.value = "Microphone permission required"; return }
            _statusText.value = when (error) { SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Listening"; else -> "Speech error ($error)" }
            scheduleRestart(delayMs = 600)
        }
        override fun onResults(results: Bundle?) { results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let { handleTranscript(it, isFinal = true) }; scheduleRestart() }
        override fun onPartialResults(partialResults: Bundle?) { partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let { handleTranscript(it, isFinal = false) } }
        override fun onEvent(eventType: Int, params: Bundle?) {}
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

// ── Voice configuration (OC parity) ─────────────────────

/**
 * Configuration for talk mode behavior.
 */
data class TalkModeConfig(
    val silenceWindowMs: Long = 2000L,
    val interruptOnSpeech: Boolean = false,
    val ttsOnAllResponses: Boolean = false,
    val playbackEnabled: Boolean = true,
    val autoRestartListening: Boolean = true,
    val maxTtsLength: Int = 4000,
    val speechRate: Float = 1.0f,
    val pitch: Float = 1.0f,
    val locale: Locale = Locale.getDefault(),
) {
    companion object {
        val DEFAULT = TalkModeConfig()

        fun fromJson(json: String): TalkModeConfig = try {
            val obj = Json.parseToJsonElement(json) as? JsonObject ?: return DEFAULT
            TalkModeConfig(
                silenceWindowMs = (obj["silenceWindowMs"] as? JsonPrimitive)?.content?.toLongOrNull() ?: 2000L,
                interruptOnSpeech = (obj["interruptOnSpeech"] as? JsonPrimitive)?.content?.toBooleanStrictOrNull() ?: false,
                ttsOnAllResponses = (obj["ttsOnAllResponses"] as? JsonPrimitive)?.content?.toBooleanStrictOrNull() ?: false,
                playbackEnabled = (obj["playbackEnabled"] as? JsonPrimitive)?.content?.toBooleanStrictOrNull() ?: true,
                autoRestartListening = (obj["autoRestartListening"] as? JsonPrimitive)?.content?.toBooleanStrictOrNull() ?: true,
                maxTtsLength = (obj["maxTtsLength"] as? JsonPrimitive)?.content?.toIntOrNull() ?: 4000,
                speechRate = (obj["speechRate"] as? JsonPrimitive)?.content?.toFloatOrNull() ?: 1.0f,
                pitch = (obj["pitch"] as? JsonPrimitive)?.content?.toFloatOrNull() ?: 1.0f,
            )
        } catch (_: Throwable) { DEFAULT }
    }
}

// ── Talk mode diagnostics (OC parity) ───────────────────

/**
 * Diagnostic snapshot for talk mode state.
 */
data class TalkModeDiagnosticSnapshot(
    val isEnabled: Boolean,
    val isListening: Boolean,
    val isSpeaking: Boolean,
    val statusText: String,
    val chatSubscribed: Boolean,
    val ttsReady: Boolean,
    val conversationCount: Int,
    val pendingRunId: String?,
    val ttsQueueSize: Int,
)

// ── Speech analytics (OC parity) ────────────────────────

/**
 * Tracks speech recognition metrics for diagnostics.
 */
class SpeechAnalytics {
    private var totalRecognitions = 0
    private var successfulRecognitions = 0
    private var failedRecognitions = 0
    private var totalCharactersRecognized = 0L
    private var lastRecognitionTimeMs: Long? = null

    fun recordSuccess(text: String) {
        totalRecognitions++
        successfulRecognitions++
        totalCharactersRecognized += text.length
        lastRecognitionTimeMs = System.currentTimeMillis()
    }

    fun recordFailure() {
        totalRecognitions++
        failedRecognitions++
    }

    fun reset() {
        totalRecognitions = 0
        successfulRecognitions = 0
        failedRecognitions = 0
        totalCharactersRecognized = 0L
        lastRecognitionTimeMs = null
    }

    fun successRate(): Double =
        if (totalRecognitions == 0) 0.0
        else successfulRecognitions.toDouble() / totalRecognitions.toDouble()

    fun averageCharactersPerRecognition(): Double =
        if (successfulRecognitions == 0) 0.0
        else totalCharactersRecognized.toDouble() / successfulRecognitions.toDouble()

    fun snapshot(): Map<String, Any?> = mapOf(
        "totalRecognitions" to totalRecognitions,
        "successfulRecognitions" to successfulRecognitions,
        "failedRecognitions" to failedRecognitions,
        "totalCharactersRecognized" to totalCharactersRecognized,
        "successRate" to successRate(),
        "avgCharsPerRecognition" to averageCharactersPerRecognition(),
        "lastRecognitionTimeMs" to lastRecognitionTimeMs,
    )
}
