import Foundation

/// Everything that can stop a share from becoming a lesson, with honest copy.
enum IngestError: Error, Equatable, Identifiable {
    /// The learner tried to paste a link but there was no link.
    case noURL
    /// The share contained nothing FrenchLens can read.
    case nothingShared
    /// Content arrived but FrenchLens can't learn from it (e.g. an image).
    case unsupportedContent(String)
    /// A video was expected (e.g. from the picker) but none was provided.
    case noVideo
    /// The video has no audio track.
    case noAudio
    /// Only a link arrived. FrenchLens never fetches media behind links.
    case linkOnly(URL, caption: String?)
    case processingFailed
    case network
    case aiFailure
    /// Speech recognition heard no French.
    case noSpeech
    case speechPermissionDenied
    /// Apple Intelligence can't run right now; the message says why.
    case onDeviceUnavailable(String)
    case contentBlocked

    var id: String { String(describing: self) }

    var title: String {
        switch self {
        case .noURL: "There's no link to read."
        case .nothingShared: "Nothing came through."
        case .unsupportedContent(let what): "FrenchLens can't learn from \(what) yet."
        case .noVideo: "That doesn't look like a video."
        case .noAudio: "This video has no sound."
        case .linkOnly(let url, _):
            "We received the \(SourcePlatform(url: url).mediaNoun(for: url)) link, but couldn't access its audio."
        case .processingFailed: "Something went wrong with this video."
        case .network: "You're offline."
        case .aiFailure: "We couldn't build this lesson."
        case .noSpeech: "We couldn't hear any French."
        case .speechPermissionDenied: "FrenchLens needs Speech Recognition."
        case .onDeviceUnavailable: "Apple Intelligence isn't ready."
        case .contentBlocked: "This video couldn't be analysed."
        }
    }

    var message: String {
        switch self {
        case .noURL:
            "Copy a link or some French text, then try again. Or add the video itself."
        case .nothingShared:
            "The app you shared from didn't pass along a video, link or text. Try uploading the video instead."
        case .unsupportedContent:
            "FrenchLens learns from speech. Try uploading the video instead."
        case .noVideo:
            "Choose a video from your Photos library."
        case .noAudio:
            "FrenchLens needs to hear the French. Try a video with speech."
        case .linkOnly(let url, _):
            switch SourcePlatform(url: url) {
            case .instagram, .tiktok, .facebook, .x:
                "Try uploading the video instead. \(SourcePlatform(url: url).displayName) often shares only a link — save the video to Photos, then add it here."
            default:
                "Try uploading the video instead."
            }
        case .processingFailed:
            "We couldn't read this file. Try exporting it again, or choose another video."
        case .network:
            "Check your connection and try again. Your share is kept until it works."
        case .aiFailure:
            "The analysis didn't work this time. Try again in a moment."
        case .noSpeech:
            "Try a video where someone speaks clearly, without loud music over the voice."
        case .speechPermissionDenied:
            "Allow it in Settings → Apps → FrenchLens → Speech Recognition, then try again."
        case .onDeviceUnavailable(let reason):
            reason
        case .contentBlocked:
            "Apple Intelligence declined to analyse this content. Try another video."
        }
    }

    var symbol: String {
        switch self {
        case .noURL: "link"
        case .nothingShared: "tray"
        case .unsupportedContent: "photo"
        case .noVideo: "film"
        case .noAudio: "speaker.slash"
        case .linkOnly: "link"
        case .processingFailed: "exclamationmark.triangle"
        case .network: "wifi.slash"
        case .aiFailure: "sparkles"
        case .noSpeech: "waveform.slash"
        case .speechPermissionDenied: "mic.slash"
        case .onDeviceUnavailable: "sparkles"
        case .contentBlocked: "hand.raised"
        }
    }

    /// Whether "Add video" is the right next step.
    var offersVideoUpload: Bool {
        switch self {
        case .network, .aiFailure, .speechPermissionDenied, .onDeviceUnavailable: false
        default: true
        }
    }

    var canRetry: Bool {
        switch self {
        case .network, .aiFailure, .processingFailed, .speechPermissionDenied, .onDeviceUnavailable: true
        default: false
        }
    }

    var isLinkOnly: Bool {
        if case .linkOnly = self { return true }
        return false
    }

    var caption: String? {
        if case .linkOnly(_, let caption) = self { return caption }
        return nil
    }

    static func from(_ error: Error) -> IngestError {
        switch error {
        case let error as IngestError: return error
        case let error as MediaError:
            return error == .noAudioTrack ? .noAudio : .processingFailed
        case let error as APIError:
            if case .transport = error { return .network }
            return .aiFailure
        case let error as AIServiceError:
            switch error {
            case .noSpeech, .emptyTranscript: return .noSpeech
            case .speechPermissionDenied: return .speechPermissionDenied
            case .modelUnavailable(let reason): return .onDeviceUnavailable(reason)
            case .contentBlocked: return .contentBlocked
            case .speechUnavailable:
                return .onDeviceUnavailable("French speech recognition isn't available right now. Check your connection, or download French under Settings → General → Keyboard → Dictation Languages.")
            default: return .aiFailure
            }
        case is URLError: return .network
        default: return .processingFailed
        }
    }
}
