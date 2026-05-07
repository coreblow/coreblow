package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ai.coreblow.app.voice.MicCaptureManager
import ai.coreblow.app.voice.TalkModeManager
import ai.coreblow.app.voice.TalkModeState
import ai.coreblow.app.voice.VoiceConversationEntry
import ai.coreblow.app.voice.VoiceWakeManager
import ai.coreblow.app.voice.WakeState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel for the Voice tab. Bridges TalkModeManager, MicCaptureManager,
 * and VoiceWakeManager state to the Compose UI.
 */
class VoiceViewModel(application: Application) : AndroidViewModel(application) {

    private var talkModeManager: TalkModeManager? = null
    private var micCaptureManager: MicCaptureManager? = null
    private var voiceWakeManager: VoiceWakeManager? = null

    private val _wakeState = MutableStateFlow(WakeState.IDLE)
    val wakeState: StateFlow<WakeState> = _wakeState.asStateFlow()

    private val _talkState = MutableStateFlow(TalkModeState.INACTIVE)
    val talkState: StateFlow<TalkModeState> = _talkState.asStateFlow()

    private val _lastTranscript = MutableStateFlow("")
    val lastTranscript: StateFlow<String> = _lastTranscript.asStateFlow()

    private val _inputLevel = MutableStateFlow(0f)
    val inputLevel: StateFlow<Float> = _inputLevel.asStateFlow()

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking.asStateFlow()

    private val _speakerEnabled = MutableStateFlow(true)
    val speakerEnabled: StateFlow<Boolean> = _speakerEnabled.asStateFlow()

    private val _conversationHistory = MutableStateFlow<List<VoiceConversationEntry>>(emptyList())
    val conversationHistory: StateFlow<List<VoiceConversationEntry>> = _conversationHistory.asStateFlow()

    private val _micCooldown = MutableStateFlow(false)
    val micCooldown: StateFlow<Boolean> = _micCooldown.asStateFlow()

    fun bindManagers(
        talkMode: TalkModeManager,
        micCapture: MicCaptureManager,
        wakeManager: VoiceWakeManager,
    ) {
        talkModeManager = talkMode
        micCaptureManager = micCapture
        voiceWakeManager = wakeManager

        viewModelScope.launch { talkMode.state.collect { _talkState.value = it } }
        viewModelScope.launch { talkMode.isTtsSpeaking.collect { _isSpeaking.value = it } }
        viewModelScope.launch { talkMode.conversationHistory.collect { _conversationHistory.value = it } }
        viewModelScope.launch { micCapture.inputLevel.collect { _inputLevel.value = it } }
        viewModelScope.launch { micCapture.isListening.collect { _isListening.value = it } }
        viewModelScope.launch { micCapture.liveTranscript.collect { _lastTranscript.value = it ?: "" } }
        viewModelScope.launch { micCapture.micCooldown.collect { _micCooldown.value = it } }
        viewModelScope.launch { wakeManager.state.collect { _wakeState.value = it } }
    }

    fun startRecording() {
        micCaptureManager?.startCapture()
    }

    fun stopRecording() {
        micCaptureManager?.stopCapture()
    }

    fun startWake() {
        voiceWakeManager?.startListening()
    }

    fun stopWake() {
        voiceWakeManager?.stopListening()
    }

    fun toggleSpeaker() {
        val newValue = !_speakerEnabled.value
        _speakerEnabled.value = newValue
        talkModeManager?.setPlaybackEnabled(newValue)
    }

    fun stopSpeaking() {
        talkModeManager?.stopTts()
    }

    fun clearConversation() {
        talkModeManager?.clearConversationHistory()
    }
}
