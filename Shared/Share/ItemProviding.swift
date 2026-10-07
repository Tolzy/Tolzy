import Foundation
import UniformTypeIdentifiers

/// The subset of `NSItemProvider` the parser needs. Abstracted so the parsing
/// rules can be unit tested with fake providers.
protocol ItemProviding {
    var registeredTypeIdentifiers: [String] { get }
    var suggestedName: String? { get }
    func hasItemConforming(to type: UTType) -> Bool
    /// Copies the provider's file for `type` into `directory` and returns the copy.
    /// The system's file is only valid during the callback, so it must be copied.
    func copyFile(of type: UTType, into directory: URL) async throws -> URL
    /// Loads an in-memory item (URL, String, Data, …) for `type`.
    func loadValue(of type: UTType) async throws -> Any?
}

enum ShareParsingError: Error {
    case missingFile
}

enum SharedFiles {
    /// Copies `source` into `directory` under a collision-free name, keeping the extension.
    static func copy(_ source: URL, into directory: URL) throws -> URL {
        let fileManager = FileManager.default
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        let ext = source.pathExtension
        let base = source.deletingPathExtension().lastPathComponent
            .replacingOccurrences(of: " ", with: "-")
            .prefix(40)
        let name = "\(UUID().uuidString.prefix(8))-\(base)" + (ext.isEmpty ? "" : ".\(ext)")
        let destination = directory.appendingPathComponent(name)
        let didAccess = source.startAccessingSecurityScopedResource()
        defer { if didAccess { source.stopAccessingSecurityScopedResource() } }
        try fileManager.copyItem(at: source, to: destination)
        return destination
    }
}
