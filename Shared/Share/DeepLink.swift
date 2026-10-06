import Foundation

/// `frenchlens://` routes shared by the app, the extension and notifications.
enum DeepLink: Equatable {
    /// Process the payload with this id from the App Group inbox.
    case ingest(UUID)
    /// Open a stored lesson.
    case lesson(UUID)
    case home

    static let scheme = "frenchlens"

    init?(url: URL) {
        guard url.scheme?.lowercased() == Self.scheme else { return nil }
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let id = components?.queryItems?.first { $0.name == "id" }?.value.flatMap(UUID.init(uuidString:))
        switch url.host?.lowercased() {
        case "ingest":
            guard let id else { return nil }
            self = .ingest(id)
        case "lesson":
            guard let id else { return nil }
            self = .lesson(id)
        case "home", nil, "":
            self = .home
        default:
            return nil
        }
    }

    var url: URL {
        var components = URLComponents()
        components.scheme = Self.scheme
        switch self {
        case .ingest(let id):
            components.host = "ingest"
            components.queryItems = [URLQueryItem(name: "id", value: id.uuidString)]
        case .lesson(let id):
            components.host = "lesson"
            components.queryItems = [URLQueryItem(name: "id", value: id.uuidString)]
        case .home:
            components.host = "home"
        }
        return components.url!
    }
}
