import Foundation
import UniformTypeIdentifiers
@testable import FrenchLens

/// Simulates what a host app (Instagram, Photos, Safari…) puts in an NSItemProvider.
final class FakeItemProvider: ItemProviding {
    var registeredTypeIdentifiers: [String]
    var suggestedName: String?
    /// Type identifier → file contents available via `copyFile`.
    var files: [String: Data]
    /// Type identifier → in-memory item available via `loadValue`.
    var values: [String: Any]

    init(types: [UTType], files: [UTType: Data] = [:], values: [UTType: Any] = [:], suggestedName: String? = nil) {
        registeredTypeIdentifiers = types.map(\.identifier)
        self.files = Dictionary(uniqueKeysWithValues: files.map { ($0.key.identifier, $0.value) })
        self.values = Dictionary(uniqueKeysWithValues: values.map { ($0.key.identifier, $0.value) })
        self.suggestedName = suggestedName
    }

    func hasItemConforming(to type: UTType) -> Bool {
        registeredTypeIdentifiers.contains { UTType($0)?.conforms(to: type) == true }
    }

    func copyFile(of type: UTType, into directory: URL) async throws -> URL {
        guard let (identifier, data) = files.first(where: { UTType($0.key)?.conforms(to: type) == true }) else {
            throw ShareParsingError.missingFile
        }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let ext = UTType(identifier)?.preferredFilenameExtension ?? "bin"
        let url = directory.appendingPathComponent("fake-\(UUID().uuidString).\(ext)")
        try data.write(to: url)
        return url
    }

    func loadValue(of type: UTType) async throws -> Any? {
        values.first { UTType($0.key)?.conforms(to: type) == true }?.value
    }
}

enum TestFiles {
    static func temporaryDirectory() -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("FrenchLensTests-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
}
