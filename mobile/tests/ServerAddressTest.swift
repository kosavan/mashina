import Foundation

@main
struct ServerAddressTest {
    static func main() throws {
        let cases = try String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8)
            .split(whereSeparator: \.isNewline)
        for test in cases {
            let entry = test.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
            let expected = entry[1] == "-" ? nil : entry[1]
            let actual = ServerAddress.parse(entry[0])?.absoluteString
            precondition(actual == expected, "\(entry[0]) expected \(entry[1]), got \(actual ?? "-")")
            if let actual, var request = ServerAddress.origin(actual + "/api/v1/health") {
                request.path = ""
                precondition(request.url?.absoluteString == actual)
            } else if actual != nil {
                preconditionFailure("Expected a valid request origin")
            }
        }
        print("iOS server address cases passed: \(cases.count)")
    }
}
