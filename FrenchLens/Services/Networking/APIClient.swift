import Foundation

enum APIError: Error, Equatable {
    case notConfigured
    case transport(URLError.Code)
    case http(status: Int, message: String?)
    case decoding(String)
}

/// A small JSON + multipart client for the FrenchLens backend.
struct APIClient {
    let configuration: APIConfiguration
    var session: URLSession = .shared

    func post<Body: Encodable, Response: Decodable>(_ path: String, body: Body) async throws -> Response {
        var request = try makeRequest(path)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try Self.encoder.encode(body)
        return try await send(request)
    }

    func upload<Response: Decodable>(
        _ path: String,
        fileURL: URL,
        mimeType: String,
        fields: [String: String]
    ) async throws -> Response {
        var request = try makeRequest(path)
        request.httpMethod = "POST"
        let boundary = "FrenchLens-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        let body = try MultipartBody(boundary: boundary)
            .adding(fields: fields)
            .adding(fileAt: fileURL, name: "file", mimeType: mimeType)
            .finalized()
        do {
            let (data, response) = try await session.upload(for: request, from: body)
            return try decode(data, response)
        } catch let error as URLError {
            throw APIError.transport(error.code)
        }
    }

    // MARK: - Internals

    private func makeRequest(_ path: String) throws -> URLRequest {
        guard let baseURL = configuration.baseURL else { throw APIError.notConfigured }
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.timeoutInterval = configuration.timeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(Self.userAgent, forHTTPHeaderField: "X-FrenchLens-Client")
        return request
    }

    private func send<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        do {
            let (data, response) = try await session.data(for: request)
            return try decode(data, response)
        } catch let error as URLError {
            throw APIError.transport(error.code)
        }
    }

    private func decode<Response: Decodable>(_ data: Data, _ response: URLResponse) throws -> Response {
        guard let http = response as? HTTPURLResponse else { throw APIError.http(status: -1, message: nil) }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw APIError.http(status: http.statusCode, message: message)
        }
        do {
            return try Self.decoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    private static let userAgent: String = {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
        return "FrenchLens-iOS/\(version)"
    }()

    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}

/// Builds a `multipart/form-data` body.
struct MultipartBody {
    let boundary: String
    private var data = Data()

    init(boundary: String) {
        self.boundary = boundary
    }

    func adding(fields: [String: String]) -> MultipartBody {
        var copy = self
        for (name, value) in fields.sorted(by: { $0.key < $1.key }) {
            copy.append("--\(boundary)\r\n")
            copy.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
            copy.append("\(value)\r\n")
        }
        return copy
    }

    func adding(fileAt url: URL, name: String, mimeType: String) throws -> MultipartBody {
        var copy = self
        copy.append("--\(boundary)\r\n")
        copy.append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(url.lastPathComponent)\"\r\n")
        copy.append("Content-Type: \(mimeType)\r\n\r\n")
        copy.data.append(try Data(contentsOf: url))
        copy.append("\r\n")
        return copy
    }

    func finalized() -> Data {
        var copy = self
        copy.append("--\(boundary)--\r\n")
        return copy.data
    }

    private mutating func append(_ string: String) {
        data.append(Data(string.utf8))
    }
}
