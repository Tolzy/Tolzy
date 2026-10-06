import Foundation

/// Where the FrenchLens backend lives. The client never holds AI provider
/// keys: it only talks to the backend, which owns them.
struct APIConfiguration: Equatable {
    static let environmentKey = "FRENCHLENS_API_BASE_URL"
    static let infoPlistKey = "FLBackendBaseURL"

    var baseURL: URL?
    var timeout: TimeInterval = 90

    var isConfigured: Bool { baseURL != nil }

    /// Resolution order: process environment (Xcode scheme / CI), then
    /// Info.plist (populated from `Config/FrenchLens.xcconfig`).
    static func current(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        bundle: Bundle = .main
    ) -> APIConfiguration {
        let candidates = [
            environment[environmentKey],
            bundle.object(forInfoDictionaryKey: infoPlistKey) as? String
        ]
        let url = candidates
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty && !$0.contains("$(") }
            .flatMap(URL.init(string:))
            .flatMap { URLExtractor.isWebURL($0) ? $0 : nil }
        return APIConfiguration(baseURL: url)
    }
}
