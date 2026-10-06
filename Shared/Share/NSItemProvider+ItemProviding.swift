import Foundation
import UniformTypeIdentifiers

/// The real provider, as handed over by the Share Sheet.
extension NSItemProvider: ItemProviding {
    func hasItemConforming(to type: UTType) -> Bool {
        hasItemConformingToTypeIdentifier(type.identifier)
    }

    func copyFile(of type: UTType, into directory: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            _ = loadFileRepresentation(forTypeIdentifier: type.identifier) { url, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let url else {
                    continuation.resume(throwing: ShareParsingError.missingFile)
                    return
                }
                do {
                    continuation.resume(returning: try SharedFiles.copy(url, into: directory))
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    func loadValue(of type: UTType) async throws -> Any? {
        try await withCheckedThrowingContinuation { continuation in
            loadItem(forTypeIdentifier: type.identifier, options: nil) { item, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: item)
                }
            }
        }
    }
}
