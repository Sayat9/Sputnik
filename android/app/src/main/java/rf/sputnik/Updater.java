package rf.sputnik;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

// Обновление без переустановки APK.
// По адресу R.string.update_url лежат version.json ({"version": N, "files": [...]}) и сами файлы приложения.
// Если N больше текущей версии, файлы скачиваются в files/www_new и при следующем запуске
// становятся files/www. Без интернета приложение работает на последней скачанной (или вшитой) версии.
class Updater {
    interface Done { void downloaded(long version); }

    private final Context ctx;
    private final File root;

    Updater(Context ctx) {
        this.ctx = ctx;
        this.root = ctx.getFilesDir();
        promote();
    }

    File liveDir() { File d = new File(root, "www"); d.mkdirs(); return d; }

    long bundledVersion() {
        try (InputStream in = ctx.getAssets().open("www/version.json")) {
            return new JSONObject(new String(readAll(in), "UTF-8")).getLong("version");
        } catch (Exception e) { return 0; }
    }

    long localVersion() {
        File f = new File(liveDir(), "version.json");
        if (!f.exists()) return 0;
        try (InputStream in = new java.io.FileInputStream(f)) {
            return new JSONObject(new String(readAll(in), "UTF-8")).getLong("version");
        } catch (Exception e) { return 0; }
    }

    // Скачанная версия используется, только если она новее вшитой (после установки нового APK вшитая может быть свежее).
    boolean useLocal() { return localVersion() > bundledVersion(); }

    private long current() { return Math.max(localVersion(), bundledVersion()); }

    // Готовое обновление из www_new заменяет www до загрузки страницы.
    private void promote() {
        File ready = new File(root, "www_new");
        if (!new File(ready, ".complete").exists()) { deleteTree(ready); return; }
        File live = new File(root, "www");
        deleteTree(live);
        new File(ready, ".complete").delete();
        ready.renameTo(live);
    }

    void check(Done done) {
        final String base = ctx.getString(R.string.update_url);
        if (base.isEmpty()) return;
        new Thread(() -> {
            try {
                JSONObject v = new JSONObject(new String(get(base + "version.json"), "UTF-8"));
                long version = v.getLong("version");
                if (version <= current()) return;
                File tmp = new File(root, "www_new");
                deleteTree(tmp);
                JSONArray files = v.getJSONArray("files");
                for (int i = 0; i < files.length(); i++) {
                    String path = files.getString(i);
                    File out = new File(tmp, path);
                    out.getParentFile().mkdirs();
                    try (FileOutputStream fo = new FileOutputStream(out)) { fo.write(get(base + path)); }
                }
                try (FileOutputStream fo = new FileOutputStream(new File(tmp, "version.json"))) { fo.write(v.toString().getBytes("UTF-8")); }
                new File(tmp, ".complete").createNewFile();
                done.downloaded(version);
            } catch (Exception ignored) {
                // Нет сети или сервер недоступен — просто работаем на текущей версии.
            }
        }).start();
    }

    private static byte[] get(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(15000);
        c.setUseCaches(false);
        if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
        try (InputStream in = c.getInputStream()) { return readAll(in); }
    }

    private static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        for (int n; (n = in.read(buf)) > 0; ) b.write(buf, 0, n);
        return b.toByteArray();
    }

    private static void deleteTree(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        f.delete();
    }
}
