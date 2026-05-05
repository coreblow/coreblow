import AppKit
enum NodePairingApprovalPrompter { static func prompt(nodeName: String) async -> Bool { await DevicePairingApprovalPrompter.prompt(deviceName: nodeName, deviceId: "") } }
