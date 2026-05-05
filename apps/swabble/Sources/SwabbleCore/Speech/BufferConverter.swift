import AVFoundation

public enum ConverterError: Error {
    case incompatibleFormats
    case failedToCreateConverter
    case failedToCreateConversionBuffer
    case conversionFailed(NSError?)
}

/// Converts audio buffers between sample rates/formats using AVAudioConverter.
/// Thread-safe: each call creates its own converter to avoid shared mutable state.
public struct BufferConverter: Sendable {
    public init() {}

    public func convert(_ buffer: AVAudioPCMBuffer, to targetFormat: AVAudioFormat) throws -> AVAudioPCMBuffer {
        let sourceFormat = buffer.format
        guard sourceFormat != targetFormat else { return buffer }

        guard let converter = AVAudioConverter(from: sourceFormat, to: targetFormat)
        else { throw ConverterError.failedToCreateConverter }

        let ratio = targetFormat.sampleRate / sourceFormat.sampleRate
        let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up))
        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: capacity)
        else { throw ConverterError.failedToCreateConversionBuffer }

        final class Flag: @unchecked Sendable { var consumed = false }
        let flag = Flag()
        var nsError: NSError?
        let status = converter.convert(to: outputBuffer, error: &nsError) { _, statusPtr in
            if flag.consumed { statusPtr.pointee = .noDataNow; return nil }
            flag.consumed = true; statusPtr.pointee = .haveData; return buffer
        }
        if status == .error { throw ConverterError.conversionFailed(nsError) }
        return outputBuffer
    }
}
