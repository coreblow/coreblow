import Foundation
public protocol AudioStreamSource: Sendable { func start() async throws; func stop() async; var sampleRate: Double { get } }
public protocol AudioStreamSink: Sendable { func write(_ buffer: Data) async throws; func flush() async }
public struct AudioStreamConfig: Sendable { public let sampleRate: Double; public let channels: Int; public let bitsPerSample: Int; public init(sampleRate: Double = 16000, channels: Int = 1, bitsPerSample: Int = 16) { self.sampleRate = sampleRate; self.channels = channels; self.bitsPerSample = bitsPerSample } }
