import Foundation
import SwiftUI

enum SpeechRate: Equatable {
    case normal
    case slow

    /// Multiplier applied to the system default rate.
    var multiplier: Float {
        switch self {
        case .normal: 0.95
        case .slow: 0.55
        }
    }
}

/// What is being spoken right now, for transcript highlighting.
struct SpeechPlayback: Equatable {
    var utteranceID: String
    var rate: SpeechRate
    /// UTF-16 range of the word currently spoken, when the engine reports it.
    var range: NSRange?
}

/// Text-to-speech abstraction. The prototype uses `AVSpeechSynthesizer`; a
/// neural voice provider can replace it without touching any view.
protocol TTSService: AnyObject {
    var current: SpeechPlayback? { get }
    func speak(_ text: String, id: String, rate: SpeechRate)
    func stop()
}

extension TTSService {
    func isSpeaking(_ id: String) -> Bool { current?.utteranceID == id }
}

/// Used when no TTS is injected (previews, tests).
final class SilentTTSService: TTSService {
    var current: SpeechPlayback? { nil }
    func speak(_ text: String, id: String, rate: SpeechRate) {}
    func stop() {}
}

private struct TTSServiceKey: EnvironmentKey {
    static let defaultValue: any TTSService = SilentTTSService()
}

extension EnvironmentValues {
    var tts: any TTSService {
        get { self[TTSServiceKey.self] }
        set { self[TTSServiceKey.self] = newValue }
    }
}
