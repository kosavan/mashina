import UIKit
import WebKit

private func message(_ english: String, _ russian: String) -> String {
    Locale.preferredLanguages.first?.hasPrefix("ru") == true ? russian : english
}

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let scene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: scene)
        window.rootViewController = MashinaController()
        window.makeKeyAndVisible()
        self.window = window
    }
}

final class HealthRedirectPolicy: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

final class MashinaController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private let background = UIColor(red: 21 / 255, green: 24 / 255, blue: 22 / 255, alpha: 1)
    private let accent = UIColor(red: 209 / 255, green: 247 / 255, blue: 110 / 255, alpha: 1)
    private let content = UIView()
    private let status = UIStackView()
    private let statusLabel = UILabel()
    private let statusButton = UIButton(type: .system)
    private let health = URLSession(configuration: .ephemeral, delegate: HealthRedirectPolicy(),
                                    delegateQueue: nil)
    private var web: WKWebView?
    private var server = UserDefaults.standard.string(forKey: "server").flatMap { MashinaController.address($0) }
    private var checking = false
    private var pageWasVisible = false
    private var statusAction: (() -> Void)?
    private var downloads: [ObjectIdentifier: URL] = [:]

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = background
        overrideUserInterfaceStyle = .dark
        content.directionalLayoutMargins = .zero

        let title = UILabel()
        title.text = "MASHINA"
        title.textColor = accent
        title.font = .preferredFont(forTextStyle: .headline)
        title.adjustsFontForContentSizeCategory = true
        title.accessibilityTraits.insert(.header)

        let settings = UIButton(type: .system)
        settings.setTitle(message("Server", "Сервер"), for: .normal)
        settings.tintColor = accent
        settings.addAction(UIAction { [weak self] _ in self?.editServer() }, for: .touchUpInside)
        settings.widthAnchor.constraint(greaterThanOrEqualToConstant: 64).isActive = true

        let bar = UIStackView(arrangedSubviews: [title, settings])
        bar.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true
        bar.isLayoutMarginsRelativeArrangement = true
        bar.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 8)
        let layout = UIStackView(arrangedSubviews: [bar, content])
        layout.axis = .vertical
        attach(layout, to: view.safeAreaLayoutGuide)

        status.axis = .vertical
        status.alignment = .center
        status.distribution = .equalCentering
        status.spacing = 16
        status.backgroundColor = background
        status.isLayoutMarginsRelativeArrangement = true
        status.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 24, leading: 24, bottom: 24, trailing: 24)
        statusLabel.textAlignment = .center
        statusLabel.font = .preferredFont(forTextStyle: .body)
        statusLabel.adjustsFontForContentSizeCategory = true
        statusLabel.numberOfLines = 0
        statusButton.tintColor = accent
        statusButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        statusButton.addAction(UIAction { [weak self] _ in self?.statusAction?() }, for: .touchUpInside)
        let upper = UIView()
        let lower = UIView()
        [upper, statusLabel, statusButton, lower].forEach(status.addArrangedSubview)
        upper.heightAnchor.constraint(equalTo: lower.heightAnchor).isActive = true
        attach(status, to: content.layoutMarginsGuide)

        if server == nil {
            showStatus(message("Enter the HTTPS address of your MASHINA server.",
                               "Введите HTTPS-адрес вашего сервера MASHINA."),
                       button: message("Connect", "Подключиться")) { [weak self] in self?.editServer() }
        } else {
            openServer()
        }
    }

    private func attach(_ child: UIView, to guide: UILayoutGuide) {
        guide.owningView?.addSubview(child)
        child.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            child.topAnchor.constraint(equalTo: guide.topAnchor),
            child.bottomAnchor.constraint(equalTo: guide.bottomAnchor),
            child.leadingAnchor.constraint(equalTo: guide.leadingAnchor),
            child.trailingAnchor.constraint(equalTo: guide.trailingAnchor),
        ])
    }

    static func origin(_ raw: String) -> URLComponents? {
        guard var parts = URLComponents(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
              parts.scheme?.lowercased() == "https",
              let host = parts.host, !host.isEmpty, parts.user == nil, parts.password == nil,
              (1...65535).contains(parts.port ?? 443) else { return nil }
        parts.scheme = "https"
        parts.host = host.lowercased()
        if parts.port == 443 { parts.port = nil }
        return parts
    }

    static func address(_ raw: String) -> URL? {
        guard var parts = origin(raw), ["", "/"].contains(parts.percentEncodedPath),
              parts.query == nil, parts.fragment == nil else { return nil }
        parts.path = ""
        return parts.url
    }

    private func isCurrentOrigin(_ url: URL) -> Bool {
        guard var parts = Self.origin(url.absoluteString) else { return false }
        parts.path = ""
        parts.query = nil
        parts.fragment = nil
        return parts.url == server
    }

    private func showStatus(_ text: String, button: String? = nil, action: (() -> Void)? = nil) {
        statusLabel.text = text
        statusButton.setTitle(button, for: .normal)
        statusButton.isHidden = button == nil
        statusAction = action
        status.isHidden = false
        content.bringSubviewToFront(status)
        UIAccessibility.post(notification: .layoutChanged, argument: statusLabel)
    }

    private func editServer(prefill: String? = nil, error: String? = nil) {
        guard !checking, presentedViewController == nil else { return }
        let alert = UIAlertController(title: message("Connect to MASHINA", "Подключение к MASHINA"),
            message: error ?? message("Enter the HTTPS address of your MASHINA server.",
                                      "Введите HTTPS-адрес вашего сервера MASHINA."), preferredStyle: .alert)
        alert.addTextField { field in
            field.text = prefill ?? self.server?.absoluteString
            field.placeholder = "https://mashina.example.org"
            field.keyboardType = .URL
            field.autocapitalizationType = .none
            field.autocorrectionType = .no
        }
        alert.addAction(UIAlertAction(title: message("Cancel", "Отмена"), style: .cancel))
        alert.addAction(UIAlertAction(title: message("Connect", "Подключиться"), style: .default) {
            [weak self, weak alert] _ in
            guard let self, let address = alert?.textFields?.first?.text else { return }
            self.checkServer(address)
        })
        present(alert, animated: true)
    }

    private func checkServer(_ input: String) {
        checking = true
        pageWasVisible = !status.isHidden
        showStatus(message("Checking server…", "Проверяем сервер…"))
        guard let candidate = Self.address(input) else {
            finishCheck(input, candidate: nil, error: message(
                "Enter an HTTPS server address without a path or credentials.",
                "Введите HTTPS-адрес без пути и учётных данных."))
            return
        }
        let endpoint = candidate.appendingPathComponent("api").appendingPathComponent("v1")
            .appendingPathComponent("health")
        var request = URLRequest(url: endpoint)
        request.timeoutInterval = 8
        health.dataTask(with: request) { [weak self] data, response, error in
            let object = data.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]
            let valid = error == nil && (response as? HTTPURLResponse)?.statusCode == 200
                && object?["status"] as? String == "ok"
                && !(object?["version"] as? String ?? "").isEmpty
                && !(object?["schema"] as? String ?? "").isEmpty
            DispatchQueue.main.async {
                self?.finishCheck(input, candidate: valid ? candidate : nil, error: message(
                    "Could not verify MASHINA. Check the address and certificate.",
                    "Не удалось проверить MASHINA. Проверьте адрес и сертификат сервера."))
            }
        }.resume()
    }

    private func finishCheck(_ input: String, candidate: URL?, error: String) {
        checking = false
        if let candidate {
            server = candidate
            UserDefaults.standard.set(candidate.absoluteString, forKey: "server")
            openServer()
        } else {
            if pageWasVisible {
                status.isHidden = true
                let alert = UIAlertController(title: error, message: nil, preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "OK", style: .default))
                present(alert, animated: true)
            } else {
                showStatus(error, button: message("Change address", "Изменить адрес")) { [weak self] in
                    self?.editServer(prefill: input, error: error)
                }
            }
        }
    }

    private func openServer() {
        guard let server else { return }
        web?.stopLoading()
        web?.removeFromSuperview()
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let page = WKWebView(frame: .zero, configuration: configuration)
        page.navigationDelegate = self
        page.uiDelegate = self
        page.allowsBackForwardNavigationGestures = true
        page.isOpaque = false
        page.backgroundColor = background
        web = page
        attach(page, to: content.layoutMarginsGuide)
        showStatus(message("Opening MASHINA…", "Открываем MASHINA…"))
        page.load(URLRequest(url: server))
    }

    private func pageFailed(_ page: WKWebView) {
        guard page === web, !checking else { return }
        showStatus(message("Could not open MASHINA. Check the connection and try again.",
                           "Не удалось открыть MASHINA. Проверьте подключение и попробуйте снова."),
                   button: message("Try again", "Попробовать снова")) { [weak self] in self?.openServer() }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if webView === web, !checking { status.isHidden = true }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { pageFailed(webView) }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { pageFailed(webView) }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        pageFailed(webView)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload, isCurrentOrigin(url)
            || (url.scheme == "blob" && URL(string: String(url.absoluteString.dropFirst(5))).map(isCurrentOrigin) == true) {
            decisionHandler(.download)
        } else if isCurrentOrigin(url) {
            decisionHandler(.allow)
        } else if action.targetFrame?.isMainFrame == false,
                  ["https", "blob", "about"].contains(url.scheme ?? "") {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
            if action.navigationType == .linkActivated, action.targetFrame?.isMainFrame != false,
               url.scheme == "https" {
                UIApplication.shared.open(url)
            } else if action.targetFrame?.isMainFrame == true {
                pageFailed(webView)
            }
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, isCurrentOrigin(url) {
            webView.load(navigationAction.request)
        }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if response.isForMainFrame, let url = response.response.url, !isCurrentOrigin(url),
           url.scheme != "blob" {
            decisionHandler(.cancel)
            pageFailed(webView)
        } else if let http = response.response as? HTTPURLResponse, http.statusCode >= 400,
           response.isForMainFrame {
            decisionHandler(.cancel)
            pageFailed(webView)
        } else if let http = response.response as? HTTPURLResponse,
                  http.value(forHTTPHeaderField: "Content-Disposition")?.lowercased().hasPrefix("attachment") == true
                  || !response.canShowMIMEType {
            decisionHandler(.download)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest,
                  decisionHandler: @escaping (WKDownload.RedirectPolicy) -> Void) {
        decisionHandler(request.url.map(isCurrentOrigin) == true ? .allow : .cancel)
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
            let name = (suggestedFilename as NSString).lastPathComponent
            let url = folder.appendingPathComponent(["", ".", "..", "/"].contains(name) ? "MASHINA-download" : name)
            downloads[ObjectIdentifier(download)] = url
            completionHandler(url)
        } catch {
            completionHandler(nil)
        }
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
        let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        share.popoverPresentationController?.sourceView = view
        share.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        share.completionWithItemsHandler = { _, _, _, _ in self.removeDownload(url) }
        if presentedViewController == nil { present(share, animated: true) }
        else { removeDownload(url) }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let url = downloads.removeValue(forKey: ObjectIdentifier(download)) { removeDownload(url) }
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(title: message("Download failed", "Не удалось скачать файл"),
                                      message: nil, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    private func removeDownload(_ url: URL) {
        try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    }
}
