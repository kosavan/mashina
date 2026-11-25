import Foundation

enum ServerAddress {
    static func origin(_ raw: String) -> URLComponents? {
        guard var parts = URLComponents(string: raw),
              let scheme = parts.scheme?.lowercased(),
              let host = parts.host, !host.isEmpty, parts.user == nil, parts.password == nil,
              scheme == "https" || (scheme == "http" && privateIPv4(parts.percentEncodedHost)),
              (1...65535).contains(parts.port ?? 443) else { return nil }
        parts.scheme = scheme
        parts.host = host.lowercased()
        if parts.port == (scheme == "https" ? 443 : 80) { parts.port = nil }
        return parts
    }

    static func parse(_ raw: String) -> URL? {
        var address = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if !address.contains("://") {
            guard var candidate = URLComponents(string: "https://" + address) else { return nil }
            if privateIPv4(candidate.percentEncodedHost) {
                candidate.scheme = "http"
                if candidate.port == nil { candidate.port = 8000 }
            }
            guard let normalized = candidate.string else { return nil }
            address = normalized
        }
        guard var parts = origin(address), ["", "/"].contains(parts.percentEncodedPath),
              parts.query == nil, parts.fragment == nil else { return nil }
        parts.path = ""
        return parts.url
    }

    private static func privateIPv4(_ host: String?) -> Bool {
        guard let host else { return false }
        let parts = host.split(separator: ".", omittingEmptySubsequences: false)
        let octets = parts.compactMap { part -> Int? in
            guard let number = Int(part), (0...255).contains(number), String(number) == part else { return nil }
            return number
        }
        guard parts.count == 4, octets.count == 4 else { return false }
        return octets[0] == 10
            || (octets[0] == 172 && (16...31).contains(octets[1]))
            || (octets[0] == 192 && octets[1] == 168)
    }
}
