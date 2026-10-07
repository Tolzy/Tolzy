import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Whether this iPhone can build lessons itself with Apple Intelligence.
enum OnDeviceCapability {
    enum Status: Equatable {
        case available
        case appleIntelligenceOff
        case modelNotReady
        case deviceNotEligible
        /// iOS older than 26 (no Foundation Models framework).
        case unsupportedOS
    }

    static var isSupportedOS: Bool {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) { return true }
        #endif
        return false
    }

    static var status: Status {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            if case .unavailable(let reason) = SystemLanguageModel.default.availability {
                return status(for: reason)
            }
            return .available
        }
        #endif
        return .unsupportedOS
    }

    #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    static func status(for reason: SystemLanguageModel.Availability.UnavailableReason) -> Status {
        switch reason {
        case .deviceNotEligible: return .deviceNotEligible
        case .appleIntelligenceNotEnabled: return .appleIntelligenceOff
        case .modelNotReady: return .modelNotReady
        @unknown default: return .modelNotReady
        }
    }
    #endif

    /// What to tell the learner, and what to do about it.
    static func message(for status: Status) -> String {
        switch status {
        case .available:
            "Lessons are built on this iPhone with Apple Intelligence. Nothing leaves your device."
        case .appleIntelligenceOff:
            "Turn on Apple Intelligence in Settings → Apple Intelligence & Siri, then try again."
        case .modelNotReady:
            "Apple Intelligence is still getting ready (it downloads after you turn it on). Try again in a few minutes."
        case .deviceNotEligible:
            "This device doesn't support Apple Intelligence. Use sample lessons in Settings instead."
        case .unsupportedOS:
            "Building lessons on your iPhone needs iOS 26 or later."
        }
    }
}
