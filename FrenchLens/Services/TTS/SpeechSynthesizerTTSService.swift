import AVFoundation
import Observation

/// On-device French speech with word-level progress callbacks.
@Observable
final class SpeechSynthesizerTTSService: NSObject, TTSService, AVSpeechSynthesizerDelegate {
    private(set) var current: SpeechPlayback?

    @ObservationIgnored private let synthesizer = AVSpeechSynthesizer()
    @ObservationIgnored private var activeUtterance: AVSpeechUtterance?

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    /// The highest-quality installed French (France) voice.
    static var frenchVoice: AVSpeechSynthesisVoice? {
        let voices = AVSpeechSynthesisVoice.speechVoices().filter { $0.language == "fr-FR" }
        return voices.max { $0.quality.rawValue < $1.quality.rawValue } ?? AVSpeechSynthesisVoice(language: "fr-FR")
    }

    func speak(_ text: String, id: String, rate: SpeechRate) {
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? AVAudioSession.sharedInstance().setActive(true)

        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = Self.frenchVoice
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * rate.multiplier
        utterance.postUtteranceDelay = 0.05
        activeUtterance = utterance
        current = SpeechPlayback(utteranceID: id, rate: rate, range: nil)
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        activeUtterance = nil
        current = nil
    }

    // MARK: AVSpeechSynthesizerDelegate

    func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        willSpeakRangeOfSpeechString characterRange: NSRange,
        utterance: AVSpeechUtterance
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self, utterance === self.activeUtterance, var playback = self.current else { return }
            playback.range = characterRange
            self.current = playback
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        finish(utterance)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        finish(utterance)
    }

    private func finish(_ utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in
            guard let self, utterance === self.activeUtterance else { return }
            self.activeUtterance = nil
            self.current = nil
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }
}
