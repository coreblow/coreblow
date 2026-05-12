import AVFoundation
import OSLog
import CoreBlowKit
import OSLog
import SwiftUI
import CoreBlowKit

enum MicRefreshSupport {
    static func availableMicrophones() -> [AVCaptureDevice] {
        AVCaptureDevice.DiscoverySession(
            deviceTypes: [.external, .microphone],
            mediaType: .audio,
            position: .unspecified
        ).devices
    }

    @MainActor
    static func voiceWakeBinding(for state: AppState) -> Binding<Bool> {
        Binding(
            get: { state.swabbleEnabled },
            set: { newValue in state.swabbleEnabled = newValue }
        )
    }

    @MainActor
    static func startObserver(_ observer: AudioInputDeviceObserver, onChange: @escaping () -> Void) {
        observer.start(onChange: onChange)
    }

    @MainActor
    static func schedule(refreshTask: inout Task<Void, Never>?, action: @escaping () async -> Void) {
        refreshTask?.cancel()
        refreshTask = Task {
            try? await Task.sleep(nanoseconds: 500_000_000)
            guard !Task.isCancelled else { return }
            await action()
        }
    }

    static func selectedMicName<T>(
        selectedID: String,
        in devices: [T],
        uid: KeyPath<T, String>,
        name: KeyPath<T, String>
    ) -> String {
        guard !selectedID.isEmpty else { return "System default" }
        if let device = devices.first(where: { $0[keyPath: uid] == selectedID }) {
            return device[keyPath: name]
        }
        return selectedID
    }
}
