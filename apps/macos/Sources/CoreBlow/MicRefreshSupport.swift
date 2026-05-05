import AVFoundation
enum MicRefreshSupport { static func availableMicrophones() -> [AVCaptureDevice] { AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInMicrophone, .externalUnknown], mediaType: .audio, position: .unspecified).devices } }
