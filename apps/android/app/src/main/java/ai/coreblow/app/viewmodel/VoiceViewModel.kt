package ai.coreblow.app.viewmodel

import android.app.Application
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ai.coreblow.app.voice.TalkDefaults
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * ViewModel for Voice tab. Binds voice managers, exposes
 * state flows for recording, wake word, playback, and
 * audio level visualization.
 */
class VoiceViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val TAG = "VoiceViewModel"
    }

    // Recording state
    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording.asStateFlow()

    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _audioLevel = MutableStateFlow(0f)
    val audioLevel: StateFlow<Float> = _audioLevel.asStateFlow()

    private val _recordingDurationMs = MutableStateFlow(0L)
    val recordingDurationMs: StateFlow<Long> = _recordingDurationMs.asStateFlow()

    // Wake word state
    private val _isWakeListening = MutableStateFlow(false)
    val isWakeListening: StateFlow<Boolean> = _isWakeListening.asStateFlow()

    private val _wakeDetected = MutableStateFlow(false)
    val wakeDetected: StateFlow<Boolean> = _wakeDetected.asStateFlow()

    private val _wakePhrase = MutableStateFlow("hey coreblow")
    val wakePhrase: StateFlow<String> = _wakePhrase.asStateFlow()

    private val _wakeEnabled = MutableStateFlow(false)
    val wakeEnabled: StateFlow<Boolean> = _wakeEnabled.asStateFlow()

    // Transcription state
    private val _transcription = MutableStateFlow("")
    val transcription: StateFlow<String> = _transcription.asStateFlow()

    private val _lastResponse = MutableStateFlow("")
    val lastResponse: StateFlow<String> = _lastResponse.asStateFlow()

    // Error state
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    // TTS state
    private val _isTtsSpeaking = MutableStateFlow(false)
    val isTtsSpeaking: StateFlow<Boolean> = _isTtsSpeaking.asStateFlow()

    private val _ttsQueue = MutableStateFlow<List<String>>(emptyList())
    val ttsQueue: StateFlow<List<String>> = _ttsQueue.asStateFlow()

    // Session state
    private val _sessionActive = MutableStateFlow(false)
    val sessionActive: StateFlow<Boolean> = _sessionActive.asStateFlow()

    private val _totalRecordingsThisSession = MutableStateFlow(0)
    val totalRecordingsThisSession: StateFlow<Int> = _totalRecordingsThisSession.asStateFlow()

    private var recordingJob: Job? = null
    private var durationJob: Job? = null

    // Derived state
    val isBusy = combine(_isRecording, _isProcessing, _isPlaying, _isTtsSpeaking) { rec, proc, play, tts ->
        rec || proc || play || tts
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val statusText = combine(_isRecording, _isProcessing, _isPlaying, _isTtsSpeaking, _isWakeListening) { rec, proc, play, tts, wake ->
        when {
            rec -> "Recording…"
            proc -> "Processing…"
            play -> "Playing…"
            tts -> "Speaking…"
            wake -> "Listening for wake word…"
            else -> "Ready"
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "Ready")

    fun startRecording() {
        if (_isRecording.value) return
        _isRecording.value = true
        _error.value = null
        _transcription.value = ""
        _recordingDurationMs.value = 0

        // Track duration
        durationJob = viewModelScope.launch {
            val startMs = System.currentTimeMillis()
            while (_isRecording.value) {
                _recordingDurationMs.value = System.currentTimeMillis() - startMs
                delay(100)
                // Auto-stop at max duration
                if (_recordingDurationMs.value >= TalkDefaults.MAX_RECORDING_DURATION_SEC * 1000L) {
                    stopRecording()
                }
            }
        }

        Log.i(TAG, "Recording started")
    }

    fun stopRecording() {
        if (!_isRecording.value) return
        _isRecording.value = false
        durationJob?.cancel()
        _totalRecordingsThisSession.value++

        Log.i(TAG, "Recording stopped (${_recordingDurationMs.value}ms)")

        // Simulate processing
        viewModelScope.launch {
            _isProcessing.value = true
            delay(1500)
            _transcription.value = "Voice input processed"
            _isProcessing.value = false
        }
    }

    fun toggleRecording() {
        if (_isRecording.value) stopRecording() else startRecording()
    }

    fun setAudioLevel(level: Float) {
        _audioLevel.value = level.coerceIn(0f, 1f)
    }

    // Wake word controls
    fun enableWake(enabled: Boolean) {
        _wakeEnabled.value = enabled
        if (enabled) {
            _isWakeListening.value = true
            Log.i(TAG, "Wake word listening enabled")
        } else {
            _isWakeListening.value = false
            _wakeDetected.value = false
        }
    }

    fun setWakePhrase(phrase: String) {
        _wakePhrase.value = phrase.trim().lowercase()
    }

    fun onWakeDetected() {
        _wakeDetected.value = true
        viewModelScope.launch {
            delay(500)
            _wakeDetected.value = false
            startRecording() // Auto-start recording after wake
        }
    }

    // TTS controls
    fun speak(text: String) {
        if (text.isBlank()) return
        _ttsQueue.value = _ttsQueue.value + text
        if (!_isTtsSpeaking.value) processNextTts()
    }

    fun stopSpeaking() {
        _isTtsSpeaking.value = false
        _ttsQueue.value = emptyList()
    }

    private fun processNextTts() {
        val queue = _ttsQueue.value
        if (queue.isEmpty()) {
            _isTtsSpeaking.value = false
            return
        }

        _isTtsSpeaking.value = true
        val text = queue.first()
        _ttsQueue.value = queue.drop(1)

        viewModelScope.launch {
            // Simulate TTS playback
            delay((text.length * 50L).coerceAtMost(5000))
            processNextTts()
        }
    }

    // Playback controls
    fun startPlayback() { _isPlaying.value = true }
    fun stopPlayback() { _isPlaying.value = false }

    // Session
    fun startSession() {
        _sessionActive.value = true
        _totalRecordingsThisSession.value = 0
    }

    fun endSession() {
        stopRecording()
        stopSpeaking()
        stopPlayback()
        _sessionActive.value = false
    }

    fun setLastResponse(text: String) { _lastResponse.value = text }
    fun clearError() { _error.value = null }
    fun setError(msg: String) { _error.value = msg }

    override fun onCleared() {
        endSession()
        super.onCleared()
    }
}
