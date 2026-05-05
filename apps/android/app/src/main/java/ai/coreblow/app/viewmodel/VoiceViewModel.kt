package ai.coreblow.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ai.coreblow.app.voice.TalkDirective
import ai.coreblow.app.voice.TalkModeManager
import ai.coreblow.app.voice.TalkModeState
import ai.coreblow.app.voice.VoiceWakeManager
import ai.coreblow.app.voice.VoiceWakePreferences
import ai.coreblow.app.voice.WakeState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * ViewModel for voice wake and talk mode UI.
 */
class VoiceViewModel(application: Application) : AndroidViewModel(application) {

    private val preferences = VoiceWakePreferences(application)

    private val talkModeManager = TalkModeManager(
        context = application,
        scope = viewModelScope,
        onTranscript = { _lastTranscript.value = it },
    )

    private val wakeManager = VoiceWakeManager(
        context = application,
        scope = viewModelScope,
        preferences = preferences,
        onWakeDetected = { talkModeManager.startRecording() },
    )

    val wakeState: StateFlow<WakeState> = wakeManager.state
    val talkState: StateFlow<TalkModeState> = talkModeManager.state

    private val _lastTranscript = MutableStateFlow("")
    val lastTranscript: StateFlow<String> = _lastTranscript.asStateFlow()

    init {
        talkModeManager.initialize()
    }

    fun startWake() = wakeManager.startListening()
    fun stopWake() = wakeManager.stopListening()
    fun startRecording() = talkModeManager.startRecording()
    fun stopRecording() = talkModeManager.stopRecording()
    fun speak(text: String) = talkModeManager.speak(text)

    fun handleDirective(directive: TalkDirective) {
        talkModeManager.handleDirective(directive)
    }

    override fun onCleared() {
        super.onCleared()
        wakeManager.stopListening()
        talkModeManager.release()
    }
}
