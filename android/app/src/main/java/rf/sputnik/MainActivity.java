package rf.sputnik;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;

// Обёртка: приложение — это index.html во встроенном WebView.
// Страница грузится с адреса https://appassets.androidplatform.net, чтобы localStorage (сохранения) жил постоянно.
// /assets/www/ — версия, вшитая в APK; /local/ — скачанное обновление (см. Updater), если оно новее.
public class MainActivity extends Activity {
    private static final String HOST = "https://appassets.androidplatform.net";
    private WebView web;
    private Updater updater;

    // Мост для страницы: window.SputnikApp.checkUpdate() / applyUpdate() / version().
    // Ответы приходят в window.sputnikUpdate(status, version), status: downloaded | latest | error.
    private class Bridge {
        @JavascriptInterface public String mode() { return getString(R.string.app_mode); }          // "master" | "player": клиент игрока для онлайн-партии
        // Онлайн-партия: пока комната открыта, сервис держит приложение живым в фоне (при закрытии окна останавливается сам).
        @JavascriptInterface public boolean keepAlive(boolean on) {
            runOnUiThread(() -> {
                Intent i = new Intent(MainActivity.this, KeepAliveService.class);
                if (on) {
                    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 11);
                    try { if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i); } catch (Exception e) { }
                } else stopService(i);
            });
            return true;
        }
        @JavascriptInterface public String version() { return String.valueOf(updater.current()); }
        @JavascriptInterface public boolean pending() { return updater.pending(); }
        @JavascriptInterface public void checkUpdate() { updater.check(reporter()); }          // старый способ: проверить и сразу скачать
        // Новый способ: checkOnly → страница спрашивает пользователя → startDownload с прогрессом (window.sputnikUpdate / sputnikProgress).
        @JavascriptInterface public boolean steps() { return true; }
        @JavascriptInterface public String status() { return lastStatus; }          // что нашла проверка при запуске: "available:<версия>" | "downloaded:<версия>" | ""
        @JavascriptInterface public void checkOnly() { updater.checkOnly(infoReporter()); }
        @JavascriptInterface public void startDownload() { updater.download(infoReporter(), p -> runOnUiThread(() -> web.evaluateJavascript("window.sputnikProgress && window.sputnikProgress(" + p + ")", null))); }
        @JavascriptInterface public void applyUpdate() {
            runOnUiThread(() -> { if (updater.applyNow()) { lastStatus = ""; web.loadUrl(HOST + "/local/index.html"); } });
        }
    }

    private Updater.Done reporter() {
        return new Updater.Done() {
            @Override public void downloaded(long v) { tell("downloaded", v); }
            @Override public void upToDate(long v) { tell("latest", v); }
            @Override public void failed(String why) { tell("error", 0); }
        };
    }

    private Updater.Info infoReporter() {
        return new Updater.Info() {
            @Override public void available(long v, int files) { tell("available", v); }
            @Override public void upToDate(long v) { tell("latest", v); }
            @Override public void downloaded(long v) { tell("downloaded", v); }
            @Override public void failed(String why) { tell("error", 0); }
        };
    }

    private volatile String lastStatus = "";

    private void tell(String status, long version) {
        if (status.equals("available") || status.equals("downloaded")) lastStatus = status + ":" + version; else if (status.equals("latest")) lastStatus = "";
        runOnUiThread(() -> web.evaluateJavascript(
                "window.sputnikUpdate && window.sputnikUpdate('" + status + "', " + version + ")", null));
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        updater = new Updater(this);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .addPathHandler("/local/", new WebViewAssetLoader.InternalStoragePathHandler(this, updater.liveDir()))
                .build();
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setTextZoom(100);
        web.setBackgroundColor(0xFF120E09);
        web.addJavascriptInterface(new Bridge(), "SputnikApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                return !"appassets.androidplatform.net".equals(u.getHost());
            }
        });
        setContentView(web);
        String home = HOST + (updater.useLocal() ? "/local/index.html" : "/assets/www/index.html");
        if (state != null) web.restoreState(state); else web.loadUrl(home);

        // Проверка обновления при запуске: только узнаём; страница спросит, устанавливать ли.
        updater.checkOnly(infoReporter());
    }

    @Override
    protected void onPause() { super.onPause(); web.resumeTimers(); }          // свёрнутая страница продолжает работать: связь с комнатой не должна замирать

    @Override
    protected void onResume() { super.onResume(); web.resumeTimers(); }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    // Кнопка «Назад» листает историю экранов приложения, на первом экране — выходит.
    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
