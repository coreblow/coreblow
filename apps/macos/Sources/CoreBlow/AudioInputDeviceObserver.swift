import AVFoundation; import Foundation
@MainActor final class AudioInputDeviceObserver {
    private(set) var devices: [AVCaptureDevice] = []
    func refresh() { devices = MicRefreshSupport.availableMicrophones() }
}
