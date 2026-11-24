package ru.mashina.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.net.URI;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;

public final class MainActivity extends Activity {
    private static final int BACKGROUND = Color.rgb(21, 24, 22);
    private static final int LIME = Color.rgb(209, 247, 110);
    private static final int PICK_FILE = 1;
    private static final int SAVE_FILE = 2;
    private final ExecutorService networkTasks = Executors.newFixedThreadPool(2);
    private WebView web;
    private FrameLayout content;
    private LinearLayout messagePanel;
    private String server;
    private ValueCallback<Uri[]> filePicker;
    private Download pendingDownload;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        server = getPreferences(MODE_PRIVATE).getString("server", null);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(BACKGROUND);
        layout.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                var safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                var keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, Math.max(safe.bottom, keyboard.bottom));
            }
            return insets;
        });
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);

        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(16), 0, dp(8), 0);
        TextView title = new TextView(this);
        title.setText(R.string.app_name);
        title.setTextColor(LIME);
        title.setTextSize(17);
        title.setTypeface(null, Typeface.BOLD);
        bar.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
        Button settings = button(R.string.server, this::editServer);
        bar.addView(settings);
        layout.addView(bar, new LinearLayout.LayoutParams(-1, dp(48)));
        content = new FrameLayout(this);
        layout.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(layout);

        if (server == null) {
            showMessage(R.string.connect_help, R.string.connect, this::editServer);
        } else {
            openServer();
        }
        if (state != null) {
            String url = state.getString("downloadUrl");
            if (url != null) {
                pendingDownload = new Download(url, state.getString("downloadAgent"));
            }
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private Button button(int label, Runnable action) {
        Button button = new Button(this, null, android.R.attr.borderlessButtonStyle);
        button.setText(label);
        button.setTextColor(LIME);
        button.setAllCaps(false);
        button.setOnClickListener(view -> action.run());
        return button;
    }

    private void clearMessage() {
        if (messagePanel != null) content.removeView(messagePanel);
        messagePanel = null;
    }

    private void showMessage(int message, int actionLabel, Runnable action) {
        clearMessage();
        messagePanel = new LinearLayout(this);
        messagePanel.setOrientation(LinearLayout.VERTICAL);
        messagePanel.setGravity(Gravity.CENTER);
        messagePanel.setBackgroundColor(BACKGROUND);
        messagePanel.setPadding(dp(32), dp(20), dp(32), dp(20));
        TextView label = new TextView(this);
        label.setText(message);
        label.setTextSize(17);
        label.setTextColor(Color.WHITE);
        label.setGravity(Gravity.CENTER);
        label.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        messagePanel.addView(label);
        if (action != null) messagePanel.addView(button(actionLabel, action));
        content.addView(messagePanel, new FrameLayout.LayoutParams(-1, -1));
    }

    static String origin(String input) {
        try {
            URI url = URI.create(input.trim());
            String host = url.getHost();
            if (!"https".equalsIgnoreCase(url.getScheme()) || host == null
                    || url.getRawUserInfo() != null || url.getPort() == 0 || url.getPort() > 65535) {
                return null;
            }
            int port = url.getPort();
            return "https://" + host.toLowerCase(Locale.ROOT)
                    + (port == -1 || port == 443 ? "" : ":" + port);
        } catch (IllegalArgumentException invalid) {
            return null;
        }
    }

    static String serverAddress(String input) {
        String origin = origin(input);
        if (origin == null) return null;
        URI url = URI.create(input.trim());
        return (url.getRawPath().isEmpty() || url.getRawPath().equals("/"))
                && url.getRawQuery() == null && url.getRawFragment() == null ? origin : null;
    }

    private void editServer() {
        EditText address = new EditText(this);
        address.setSingleLine(true);
        address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        address.setHint("https://mashina.example.org");
        address.setText(server);
        FrameLayout field = new FrameLayout(this);
        field.setPadding(dp(24), 0, dp(24), 0);
        field.addView(address);
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(R.string.connect_title)
                .setMessage(R.string.connect_help)
                .setView(field)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(R.string.connect, null)
                .create();
        dialog.show();
        Button confirm = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
        confirm.setOnClickListener(view -> {
            String candidate = serverAddress(address.getText().toString());
            if (candidate == null) {
                address.setError(getString(R.string.bad_address));
                return;
            }
            confirm.setEnabled(false);
            confirm.setText(R.string.connecting);
            address.setEnabled(false);
            networkTasks.submit(() -> {
                boolean valid = isMashina(candidate);
                runOnUiThread(() -> {
                    if (isDestroyed() || !dialog.isShowing()) return;
                    confirm.setEnabled(true);
                    confirm.setText(R.string.connect);
                    address.setEnabled(true);
                    if (!valid) {
                        address.setError(getString(R.string.server_failed));
                        return;
                    }
                    dialog.dismiss();
                    server = candidate;
                    getPreferences(MODE_PRIVATE).edit().putString("server", server).apply();
                    openServer();
                });
            });
        });
    }

    private boolean isMashina(String candidate) {
        HttpsURLConnection request = null;
        try {
            request = (HttpsURLConnection) URI.create(candidate + "/api/v1/health")
                    .toURL().openConnection();
            request.setConnectTimeout(8000);
            request.setReadTimeout(8000);
            request.setInstanceFollowRedirects(false);
            if (request.getResponseCode() != 200) return false;
            try (var stream = request.getInputStream()) {
                byte[] body = new byte[4097];
                int size = 0;
                while (size < body.length) {
                    int count = stream.read(body, size, body.length - size);
                    if (count == -1) break;
                    size += count;
                }
                if (size == body.length) return false;
                JSONObject health = new JSONObject(new String(body, 0, size, java.nio.charset.StandardCharsets.UTF_8));
                return "ok".equals(health.optString("status"))
                        && !health.optString("version").isEmpty() && !health.optString("schema").isEmpty();
            }
        } catch (Exception failed) {
            return false;
        } finally {
            if (request != null) request.disconnect();
        }
    }

    private void openServer() {
        closeWebView();
        showMessage(R.string.loading, 0, null);
        web = new WebView(this);
        web.setBackgroundColor(BACKGROUND);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new MashinaWebClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (filePicker != null) filePicker.onReceiveValue(null);
                filePicker = callback;
                try {
                    startActivityForResult(params.createIntent(), PICK_FILE);
                } catch (ActivityNotFoundException missing) {
                    filePicker = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, R.string.no_picker, Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, length) ->
                offerDownload(url, agent, disposition, mime));
        content.addView(web, 0, new FrameLayout.LayoutParams(-1, -1));
        web.loadUrl(server + "/");
    }

    private final class MashinaWebClient extends WebViewClient {
        private boolean failed;

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String target = origin(request.getUrl().toString());
            if (!request.isForMainFrame()) return false;
            if (server.equals(target)) return false;
            if (request.isForMainFrame() && request.hasGesture() && target != null) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                } catch (ActivityNotFoundException missing) {
                    showMessage(R.string.page_failed, R.string.retry, MainActivity.this::openServer);
                }
            } else if (request.isForMainFrame() && !request.hasGesture()) {
                fail(view);
            }
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            if (!server.equals(origin(url))) {
                view.stopLoading();
                fail(view);
                return;
            }
            failed = false;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (view == web && !failed && server.equals(origin(url))) clearMessage();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) fail(view);
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request,
                WebResourceResponse response) {
            if (request.isForMainFrame()) fail(view);
        }

        private void fail(WebView view) {
            if (view != web) return;
            failed = true;
            showMessage(R.string.page_failed, R.string.retry, MainActivity.this::openServer);
        }
    }

    private static final class Download {
        final String url;
        final String userAgent;
        Download(String url, String userAgent) {
            this.url = url;
            this.userAgent = userAgent;
        }
    }

    private void offerDownload(String url, String agent, String disposition, String mime) {
        if (!server.equals(origin(url))) {
            Toast.makeText(this, R.string.download_unavailable, Toast.LENGTH_LONG).show();
            return;
        }
        if (pendingDownload != null) return;
        pendingDownload = new Download(url, agent);
        Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(mime == null ? "application/octet-stream" : mime)
                .putExtra(Intent.EXTRA_TITLE, URLUtil.guessFileName(url, disposition, mime));
        try {
            startActivityForResult(save, SAVE_FILE);
        } catch (ActivityNotFoundException missing) {
            pendingDownload = null;
            Toast.makeText(this, R.string.no_picker, Toast.LENGTH_LONG).show();
        }
    }

    private void saveDownload(Download download, Uri destination) {
        HttpsURLConnection request = null;
        try {
            request = (HttpsURLConnection) URI.create(download.url).toURL().openConnection();
            request.setInstanceFollowRedirects(false);
            request.setConnectTimeout(15000);
            request.setReadTimeout(30000);
            String cookie = CookieManager.getInstance().getCookie(download.url);
            if (cookie != null) request.setRequestProperty("Cookie", cookie);
            if (download.userAgent != null) request.setRequestProperty("User-Agent", download.userAgent);
            if (request.getResponseCode() != 200 || request.getHeaderField("Content-Disposition") == null) {
                throw new java.io.IOException("Expected a successful attachment response");
            }
            try (var input = request.getInputStream();
                    var output = getContentResolver().openOutputStream(destination, "wt")) {
                if (output == null) throw new java.io.IOException("Could not open destination");
                byte[] buffer = new byte[64 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            }
            runOnUiThread(() -> Toast.makeText(this, R.string.download_saved, Toast.LENGTH_LONG).show());
        } catch (Exception failed) {
            try {
                DocumentsContract.deleteDocument(getContentResolver(), destination);
            } catch (Exception cleanupFailed) {
                // Some document providers do not permit deletion.
            }
            runOnUiThread(() -> Toast.makeText(this, R.string.download_failed, Toast.LENGTH_LONG).show());
        } finally {
            if (request != null) request.disconnect();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        if (pendingDownload == null) return;
        state.putString("downloadUrl", pendingDownload.url);
        state.putString("downloadAgent", pendingDownload.userAgent);
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == SAVE_FILE) {
            Download download = pendingDownload;
            pendingDownload = null;
            Uri destination = data == null ? null : data.getData();
            if (result == RESULT_OK && download != null && destination != null
                    && server != null && server.equals(origin(download.url))) {
                networkTasks.submit(() -> saveDownload(download, destination));
            }
            return;
        }
        if (request != PICK_FILE || filePicker == null) return;
        filePicker.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
        filePicker = null;
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private void closeWebView() {
        if (filePicker != null) {
            filePicker.onReceiveValue(null);
            filePicker = null;
        }
        if (web == null) return;
        content.removeView(web);
        web.destroy();
        web = null;
    }

    @Override
    protected void onDestroy() {
        closeWebView();
        networkTasks.shutdownNow();
        super.onDestroy();
    }
}
