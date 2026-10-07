import Foundation

/// A file-based queue in the App Group container.
///
/// Layout:
///
///     <App Group>/Inbox/<payload-id>/payload.json
///     <App Group>/Inbox/<payload-id>/<copied media files>
///
/// The Share Extension writes; the main app reads, processes and deletes.
struct ShareInbox {
    static let payloadFileName = "payload.json"

    let rootURL: URL
    private let fileManager = FileManager.default

    init(rootURL: URL) {
        self.rootURL = rootURL
    }

    /// The inbox inside the App Group, or `nil` if the group is unavailable.
    static func appGroup() -> ShareInbox? {
        AppGroup.containerURL.map { ShareInbox(rootURL: $0.appendingPathComponent("Inbox", isDirectory: true)) }
    }

    func directory(for id: UUID) -> URL {
        rootURL.appendingPathComponent(id.uuidString, isDirectory: true)
    }

    @discardableResult
    func makeDirectory(for id: UUID) throws -> URL {
        let url = directory(for: id)
        try fileManager.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    func fileURL(named fileName: String, in id: UUID) -> URL {
        directory(for: id).appendingPathComponent(fileName)
    }

    func save(_ payload: SharedPayload) throws {
        let directory = try makeDirectory(for: payload.id)
        let data = try Self.encoder.encode(payload)
        try data.write(to: directory.appendingPathComponent(Self.payloadFileName), options: .atomic)
    }

    func load(id: UUID) throws -> SharedPayload {
        let data = try Data(contentsOf: fileURL(named: Self.payloadFileName, in: id))
        return try Self.decoder.decode(SharedPayload.self, from: data)
    }

    /// Payloads waiting to be processed, oldest first.
    func pendingPayloads() -> [SharedPayload] {
        guard let entries = try? fileManager.contentsOfDirectory(at: rootURL, includingPropertiesForKeys: nil) else {
            return []
        }
        return entries
            .compactMap { UUID(uuidString: $0.lastPathComponent) }
            .compactMap { try? load(id: $0) }
            .sorted { $0.createdAt < $1.createdAt }
    }

    func remove(id: UUID) {
        try? fileManager.removeItem(at: directory(for: id))
    }

    func removeAll() {
        try? fileManager.removeItem(at: rootURL)
    }

    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }()

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}
