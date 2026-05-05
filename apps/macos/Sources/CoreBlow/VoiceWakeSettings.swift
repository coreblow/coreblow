import AppKit
import AVFoundation
import Observation
import Speech
import SwabbleKit
import SwiftUI
import UniformTypeIdentifiers

/// Settings view for the Voice Wake system. Controls trigger words, microphone
/// selection, locale, chime sounds, and provides an inline test card that
/// exercises the full `WakeWordGate` pipeline.
struct VoiceWakeSettings: View {
    @Bindable var state: AppState
    let isActive: Bool
    @State private var testState: VoiceWakeTestState = .idle
    @State private var tester = VoiceWakeTester()
    @State private var isTesting = false
    @State private var testTimeoutTask: Task<Void, Never>?
    @State private var availableMics: [AudioInputDevice] = []
    @State private var loadingMics = false
    @State private var meterLevel: Double = 0
    @State private var meterError: String?
    private let meter = MicLevelMonitor()
    @State private var micObserver = AudioInputDeviceObserver()
    @State private var micRefreshTask: Task<Void, Never>?
    @State private var availableLocales: [Locale] = []
    @State private var triggerEntries: [TriggerEntry] = []
    private let fieldLabelWidth: CGFloat = 140
    private let controlWidth: CGFloat = 240
    private let isPreview = ProcessInfo.processInfo.isPreview

    // MARK: - Supporting Types

    private struct AudioInputDevice: Identifiable, Equatable {
        let uid: String
        let name: String
        var id: String { uid }
    }

    private struct TriggerEntry: Identifiable {
        let id: UUID
        var value: String
    }

    private var voiceWakeBinding: Binding<Bool> {
        MicRefreshSupport.voiceWakeBinding(for: state)
    }

    // MARK: - Body

    var body: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 14) {
                SettingsToggleRow(
                    title: "Enable Voice Wake",
                    subtitle: "Listen for a wake phrase (e.g. \"Claude\") before running voice commands. "
                        + "Voice recognition runs fully on-device.",
                    binding: voiceWakeBinding)
                    .disabled(!voiceWakeSupported)

                SettingsToggleRow(
                    title: "Hold Right Option to talk",
                    subtitle: """
                    Push-to-talk mode that starts listening while you hold the key
                    and shows the preview overlay.
                    """,
                    binding: $state.voicePushToTalkEnabled)
                    .disabled(!voiceWakeSupported)

                if !voiceWakeSupported {
                    Label("Voice Wake requires macOS 26 or newer.", systemImage: "exclamationmark.triangle.fill")
                        .font(.callout)
                        .foregroundStyle(.yellow)
                        .padding(8)
                        .background(Color.secondary.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                localePicker
                micPicker
                levelMeter

                VoiceWakeTestCard(
                    testState: $testState,
                    isTesting: $isTesting,
                    onToggle: toggleTest)

                chimeSection
                triggerTable

                Spacer(minLength: 8)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
        }
        .task {
            guard !isPreview else { return }
            await loadMicsIfNeeded()
        }
        .task {
            guard !isPreview else { return }
            await loadLocalesIfNeeded()
        }
        .task {
            guard !isPreview else { return }
            await restartMeter()
        }
        .onAppear {
            guard !isPreview else { return }
            startMicObserver()
            loadTriggerEntries()
        }
        .onChange(of: state.voiceWakeMicID) { _, _ in
            guard !isPreview else { return }
            updateSelectedMicName()
            Task { await restartMeter() }
        }
        .onChange(of: isActive) { _, active in
            guard !isPreview else { return }
            if !active {
                tester.stop()
                isTesting = false
                testState = .idle
                testTimeoutTask?.cancel()
                micRefreshTask?.cancel()
                micRefreshTask = nil
                Task { await meter.stop() }
                micObserver.stop()
                syncTriggerEntriesToState()
            } else {
                startMicObserver()
                loadTriggerEntries()
            }
        }
        .onDisappear {
            guard !isPreview else { return }
            tester.stop()
            isTesting = false
            testState = .idle
            testTimeoutTask?.cancel()
            micRefreshTask?.cancel()
            micRefreshTask = nil
            micObserver.stop()
            Task { await meter.stop() }
            syncTriggerEntriesToState()
        }
    }

    // MARK: - Trigger Words

    private func loadTriggerEntries() {
        triggerEntries = state.swabbleTriggerWords.map { TriggerEntry(id: UUID(), value: $0) }
    }

    private func syncTriggerEntriesToState() {
        state.swabbleTriggerWords = triggerEntries.map(\.value)
    }

    private var triggerTable: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Trigger words")
                    .font(.callout.weight(.semibold))
                Spacer()
                Button {
                    addWord()
                } label: {
                    Label("Add word", systemImage: "plus")
                }
                .disabled(triggerEntries
                    .contains(where: { $0.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }))

                Button("Reset defaults") {
                    triggerEntries = defaultVoiceWakeTriggers.map { TriggerEntry(id: UUID(), value: $0) }
                    syncTriggerEntriesToState()
                }
            }

            VStack(spacing: 0) {
                ForEach($triggerEntries) { $entry in
                    HStack(spacing: 8) {
                        TextField("Wake word", text: $entry.value)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit { syncTriggerEntriesToState() }

                        Button {
                            removeWord(id: entry.id)
                        } label: {
                            Image(systemName: "trash")
                        }
                        .buttonStyle(.borderless)
                        .help("Remove trigger word")
                        .frame(width: 24)
                    }
                    .padding(8)

                    if entry.id != triggerEntries.last?.id {
                        Divider()
                    }
                }
            }
            .frame(maxWidth: .infinity, minHeight: 180, alignment: .topLeading)
            .background(Color(nsColor: .textBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color.secondary.opacity(0.25), lineWidth: 1))

            Text(
                "CoreBlow reacts when any trigger appears in a transcription. "
                    + "Keep them short to avoid false positives.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func addWord() {
        triggerEntries.append(TriggerEntry(id: UUID(), value: ""))
    }

    private func removeWord(id: UUID) {
        triggerEntries.removeAll { $0.id == id }
        syncTriggerEntriesToState()
    }

    // MARK: - Chime Sounds

    private var chimeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("Sounds")
                    .font(.callout.weight(.semibold))
                Spacer()
            }

            chimeRow(title: "Trigger sound", selection: $state.voiceWakeTriggerChime)
            chimeRow(title: "Send sound", selection: $state.voiceWakeSendChime)
        }
        .padding(.top, 4)
    }

    private func chimeRow(title: String, selection: Binding<VoiceWakeChime>) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Text(title)
                .font(.callout.weight(.semibold))
                .frame(width: fieldLabelWidth, alignment: .leading)

            Menu {
                Button("No Sound") { selectChime(.none, binding: selection) }
                Divider()
                ForEach(VoiceWakeChimeCatalog.systemOptions, id: \.self) { option in
                    Button(VoiceWakeChimeCatalog.displayName(for: option)) {
                        selectChime(.system(name: option), binding: selection)
                    }
                }
                Divider()
                Button("Choose file…") { chooseCustomChime(for: selection) }
            } label: {
                HStack(spacing: 6) {
                    Text(selection.wrappedValue.displayLabel)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(6)
                .frame(minWidth: controlWidth, maxWidth: .infinity, alignment: .leading)
                .background(Color(nsColor: .windowBackgroundColor))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.secondary.opacity(0.25), lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            Button("Play") {
                VoiceWakeChimePlayer.play(selection.wrappedValue)
            }
            .keyboardShortcut(.space, modifiers: [.command])
        }
    }

    private func chooseCustomChime(for selection: Binding<VoiceWakeChime>) {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.audio]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.resolvesAliases = true
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                let bookmark = try url.bookmarkData(
                    options: [.withSecurityScope],
                    includingResourceValuesForKeys: nil,
                    relativeTo: nil)
                let chosen = VoiceWakeChime.custom(displayName: url.lastPathComponent, bookmark: bookmark)
                selection.wrappedValue = chosen
                VoiceWakeChimePlayer.play(chosen)
            } catch {
                // Ignore failures; user can retry.
            }
        }
    }

    private func selectChime(_ chime: VoiceWakeChime, binding: Binding<VoiceWakeChime>) {
        binding.wrappedValue = chime
        VoiceWakeChimePlayer.play(chime)
    }

    // MARK: - Test

    private func sanitizedTriggers() -> [String] {
        sanitizeVoiceWakeTriggers(state.swabbleTriggerWords)
    }

    /// Uses SwabbleKit's `WakeWordGate.stripWake` for text-only fallback command
    /// extraction when segment timing is unavailable during testing timeout.
    private static func textOnlyCommand(from transcript: String, triggers: [String]) -> String? {
        VoiceWakeTextUtils.textOnlyCommand(
            transcript: transcript,
            triggers: triggers,
            minCommandLength: 1,
            trimWake: { WakeWordGate.stripWake(text: $0, triggers: $1) })
    }

    private func toggleTest() {
        guard voiceWakeSupported else {
            testState = .failed("Voice Wake requires macOS 26 or newer.")
            return
        }
        if isTesting {
            tester.finalize()
            isTesting = false
            testState = .finalizing
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                if testState == .finalizing {
                    tester.stop()
                    testState = .failed("Stopped")
                }
            }
            testTimeoutTask?.cancel()
            return
        }

        let triggers = sanitizedTriggers()
        tester.stop()
        testTimeoutTask?.cancel()
        isTesting = true
        testState = .requesting
        Task { @MainActor in
            do {
                try await tester.start(
                    triggers: triggers,
                    micID: state.voiceWakeMicID.isEmpty ? nil : state.voiceWakeMicID,
                    localeID: state.voiceWakeLocaleID,
                    onUpdate: { newState in
                        DispatchQueue.main.async { [self] in
                            testState = newState
                            if case .detected = newState { isTesting = false }
                            if case .failed = newState { isTesting = false }
                            if case .detected = newState { testTimeoutTask?.cancel() }
                            if case .failed = newState { testTimeoutTask?.cancel() }
                        }
                    })
                testTimeoutTask?.cancel()
                testTimeoutTask = Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 10 * 1_000_000_000)
                    guard !Task.isCancelled else { return }
                    if isTesting {
                        tester.stop()
                        if case let .hearing(text) = testState,
                           let command = Self.textOnlyCommand(from: text, triggers: triggers)
                        {
                            testState = .detected(command)
                        } else {
                            testState = .failed("Timeout: no trigger heard")
                        }
                        isTesting = false
                    }
                }
            } catch {
                tester.stop()
                testState = .failed(error.localizedDescription)
                isTesting = false
                testTimeoutTask?.cancel()
            }
        }
    }

    // MARK: - Microphone

    private var micPicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("Microphone")
                    .font(.callout.weight(.semibold))
                    .frame(width: fieldLabelWidth, alignment: .leading)
                Picker("Microphone", selection: $state.voiceWakeMicID) {
                    Text("System default").tag("")
                    if isSelectedMicUnavailable {
                        Text(state.voiceWakeMicName.isEmpty ? "Unavailable" : state.voiceWakeMicName)
                            .tag(state.voiceWakeMicID)
                    }
                    ForEach(availableMics) { mic in
                        Text(mic.name).tag(mic.uid)
                    }
                }
                .labelsHidden()
                .frame(width: controlWidth)
            }
            if isSelectedMicUnavailable {
                HStack(spacing: 10) {
                    Color.clear.frame(width: fieldLabelWidth, height: 1)
                    Text("Disconnected (using System default)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            if loadingMics {
                ProgressView().controlSize(.small)
            }
        }
    }

    // MARK: - Locale

    private var localePicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("Recognition language")
                    .font(.callout.weight(.semibold))
                    .frame(width: fieldLabelWidth, alignment: .leading)
                Picker("Language", selection: $state.voiceWakeLocaleID) {
                    let current = Locale(identifier: Locale.current.identifier)
                    Text("\(friendlyName(for: current)) (System)").tag(Locale.current.identifier)
                    ForEach(availableLocales.map(\.identifier), id: \.self) { id in
                        if id != Locale.current.identifier {
                            Text(friendlyName(for: Locale(identifier: id))).tag(id)
                        }
                    }
                }
                .labelsHidden()
                .frame(width: controlWidth)
            }

            if !state.voiceWakeAdditionalLocaleIDs.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Additional languages")
                        .font(.footnote.weight(.semibold))
                    ForEach(
                        Array(state.voiceWakeAdditionalLocaleIDs.enumerated()),
                        id: \.offset)
                    { idx, localeID in
                        HStack(spacing: 8) {
                            Picker("Extra \(idx + 1)", selection: Binding(
                                get: { localeID },
                                set: { newValue in
                                    guard state.voiceWakeAdditionalLocaleIDs.indices.contains(idx) else { return }
                                    state.voiceWakeAdditionalLocaleIDs[idx] = newValue
                                })) {
                                    ForEach(availableLocales.map(\.identifier), id: \.self) { id in
                                        Text(friendlyName(for: Locale(identifier: id))).tag(id)
                                    }
                                }
                                .labelsHidden()
                                .frame(width: 220)

                            Button {
                                guard state.voiceWakeAdditionalLocaleIDs.indices.contains(idx) else { return }
                                state.voiceWakeAdditionalLocaleIDs.remove(at: idx)
                            } label: {
                                Image(systemName: "trash")
                            }
                            .buttonStyle(.borderless)
                            .help("Remove language")
                        }
                    }

                    Button {
                        if let first = availableLocales.first {
                            state.voiceWakeAdditionalLocaleIDs.append(first.identifier)
                        }
                    } label: {
                        Label("Add language", systemImage: "plus")
                    }
                    .disabled(availableLocales.isEmpty)
                }
                .padding(.top, 4)
            } else {
                Button {
                    if let first = availableLocales.first {
                        state.voiceWakeAdditionalLocaleIDs.append(first.identifier)
                    }
                } label: {
                    Label("Add additional language", systemImage: "plus")
                }
                .buttonStyle(.link)
                .disabled(availableLocales.isEmpty)
                .padding(.top, 4)
            }

            Text("Languages are tried in order. Models may need a first-use download on macOS 26.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Mic Loading

    @MainActor
    private func loadMicsIfNeeded(force: Bool = false) async {
        guard force || availableMics.isEmpty, !loadingMics else { return }
        loadingMics = true
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.external, .microphone],
            mediaType: .audio,
            position: .unspecified)
        let aliveUIDs = AudioInputDeviceObserver.aliveInputDeviceUIDs()
        let connectedDevices = discovery.devices.filter(\.isConnected)
        let devices = aliveUIDs.isEmpty
            ? connectedDevices
            : connectedDevices.filter { aliveUIDs.contains($0.uniqueID) }
        availableMics = devices.map { AudioInputDevice(uid: $0.uniqueID, name: $0.localizedName) }
        updateSelectedMicName()
        loadingMics = false
    }

    private var isSelectedMicUnavailable: Bool {
        let selected = state.voiceWakeMicID
        guard !selected.isEmpty else { return false }
        return !availableMics.contains(where: { $0.uid == selected })
    }

    @MainActor
    private func updateSelectedMicName() {
        state.voiceWakeMicName = MicRefreshSupport.selectedMicName(
            selectedID: state.voiceWakeMicID,
            in: availableMics,
            uid: \.uid,
            name: \.name)
    }

    private func startMicObserver() {
        MicRefreshSupport.startObserver(micObserver) {
            scheduleMicRefresh()
        }
    }

    @MainActor
    private func scheduleMicRefresh() {
        MicRefreshSupport.schedule(refreshTask: &micRefreshTask) {
            await loadMicsIfNeeded(force: true)
            await restartMeter()
        }
    }

    @MainActor
    private func loadLocalesIfNeeded() async {
        guard availableLocales.isEmpty else { return }
        availableLocales = Array(SFSpeechRecognizer.supportedLocales()).sorted { lhs, rhs in
            friendlyName(for: lhs)
                .localizedCaseInsensitiveCompare(friendlyName(for: rhs)) == .orderedAscending
        }
    }

    private func friendlyName(for locale: Locale) -> String {
        let cleanedID = normalizeLocaleIdentifier(locale.identifier)
        let cleanLocale = Locale(identifier: cleanedID)

        if let langCode = cleanLocale.language.languageCode?.identifier,
           let lang = cleanLocale.localizedString(forLanguageCode: langCode),
           let regionCode = cleanLocale.region?.identifier,
           let region = cleanLocale.localizedString(forRegionCode: regionCode)
        {
            return "\(lang) (\(region))"
        }
        if let langCode = cleanLocale.language.languageCode?.identifier,
           let lang = cleanLocale.localizedString(forLanguageCode: langCode)
        {
            return lang
        }
        return cleanLocale.localizedString(forIdentifier: cleanedID) ?? cleanedID
    }

    // MARK: - Level Meter

    private var levelMeter: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center, spacing: 10) {
                Text("Live level")
                    .font(.callout.weight(.semibold))
                    .frame(width: fieldLabelWidth, alignment: .leading)
                MicLevelBar(level: meterLevel)
                    .frame(width: controlWidth, alignment: .leading)
                Text(levelLabel)
                    .font(.callout.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .frame(width: 60, alignment: .trailing)
            }
            if let meterError {
                Text(meterError)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var levelLabel: String {
        let db = (meterLevel * 50) - 50
        return String(format: "%.0f dB", db)
    }

    @MainActor
    private func restartMeter() async {
        meterError = nil
        await meter.stop()
        do {
            try await meter.start { [weak state] level in
                Task { @MainActor in
                    guard state != nil else { return }
                    self.meterLevel = level
                }
            }
        } catch {
            meterError = error.localizedDescription
        }
    }
}

// MARK: - Preview & Testing

#if DEBUG
struct VoiceWakeSettings_Previews: PreviewProvider {
    static var previews: some View {
        VoiceWakeSettings(state: .preview, isActive: true)
            .frame(width: SettingsTab.windowWidth, height: SettingsTab.windowHeight)
    }
}

@MainActor
extension VoiceWakeSettings {
    static func exerciseForTesting() {
        let state = AppState(preview: true)
        state.swabbleEnabled = true
        state.voicePushToTalkEnabled = true
        state.swabbleTriggerWords = ["Claude", "Hey"]

        let view = VoiceWakeSettings(state: state, isActive: true)
        view.availableMics = [AudioInputDevice(uid: "mic-1", name: "Built-in")]
        view.availableLocales = [Locale(identifier: "en_US")]
        view.meterLevel = 0.42
        view.meterError = "No input"
        view.testState = .detected("ok")
        view.isTesting = true
        view.triggerEntries = [TriggerEntry(id: UUID(), value: "Claude")]

        _ = view.body
        _ = view.localePicker
        _ = view.micPicker
        _ = view.levelMeter
        _ = view.triggerTable
        _ = view.chimeSection

        view.addWord()
        if let entryId = view.triggerEntries.first?.id {
            view.removeWord(id: entryId)
        }
    }
}
#endif
