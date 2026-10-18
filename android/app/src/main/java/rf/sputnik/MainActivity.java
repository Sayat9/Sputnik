package rf.sputnik;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
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

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Updater updater = new Updater(this);
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

        // Проверка обновления в фоне: новое применяется при следующем запуске.
        updater.check(version -> runOnUiThread(() -> Toast.makeText(this,
                "Скачано обновление " + version + ". Перезапусти приложение, чтобы его применить.",
                Toast.LENGTH_LONG).show()));
    }

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
