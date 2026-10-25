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
    interface Done {
        void downloaded(long version);
        default void upToDate(long version) {}
        default void failed(String why) {}
    }

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

    long current() { return Math.max(localVersion(), bundledVersion()); }

    // Есть ли скачанное, но ещё не применённое обновление.
    boolean pending() { return new File(new File(root, "www_new"), ".complete").exists(); }

    // Применить скачанное прямо сейчас (страница после этого перезагружается).
    boolean applyNow() { if (!pending()) return false; promote(); return true; }

    private volatile boolean busy = false;

    // Готовое обновление из www_new заменяет www до загрузки страницы.
    private void promote() {
        File ready = new File(root, "www_new");
        if (!new File(ready, ".complete").exists()) { deleteTree(ready); return; }
        File live = new File(root, "www");
        deleteTree(live);
        new File(ready, ".complete").delete();
        ready.renameTo(live);
    }

    // ===== Проверка и установка по шагам: сначала спрашиваем, потом качаем с прогрессом =====
    interface Info {
        void available(long version, int files);
        void upToDate(long version);
        void downloaded(long version);
        void failed(String why);
    }
    interface Progress { void step(int percent); }

    private JSONObject offer;                                   // найденная на сервере версия (version.json)

    // Только проверка: ничего не скачивает.
    void checkOnly(Info cb) {
        final String base = ctx.getString(R.string.update_url);
        if (base.isEmpty()) { cb.failed("обновления выключены"); return; }
        if (busy) return;
        busy = true;
        new Thread(() -> {
            try {
                JSONObject v = new JSONObject(new String(get(base + "version.json?t=" + System.currentTimeMillis()), "UTF-8"));
                long version = v.getLong("version");
                if (pending()) {
                    try (InputStream in = new java.io.FileInputStream(new File(new File(root, "www_new"), "version.json"))) {
                        long have = new JSONObject(new String(readAll(in), "UTF-8")).getLong("version");
                        if (have >= version) { cb.downloaded(have); return; }
                    }
                }
                if (version <= current()) { cb.upToDate(current()); return; }
                offer = v;
                cb.available(version, v.getJSONArray("files").length());
            } catch (Exception e) {
                cb.failed("нет связи с сервером обновлений");
            } finally {
                busy = false;
            }
        }).start();
    }

    // Скачивание найденной версии в www_new с процентами; по окончании обновление готово к применению.
    void download(Info cb, Progress pr) {
        final String base = ctx.getString(R.string.update_url);
        final JSONObject v = offer;
        if (v == null) { cb.failed("сначала проверьте обновление"); return; }
        if (busy) return;
        busy = true;
        new Thread(() -> {
            try {
                long version = v.getLong("version");
                File tmp = new File(root, "www_new");
                deleteTree(tmp);
                JSONArray files = v.getJSONArray("files");
                int n = files.length();
                long last = 0;
                JSONObject newH = v.optJSONObject("hashes"), oldH = haveHashes();
                for (int i = 0; i < n; i++) {
                    String path = files.getString(i);
                    File out = new File(tmp, path);
                    out.getParentFile().mkdirs();
                    // Файл не менялся с установленной версии — копируем его, а не качаем (обновление становится маленьким).
                    if (newH != null && oldH != null && newH.has(path) && newH.optString(path).equals(oldH.optString(path, "-")) && copyHave(path, out)) {
                        pr.step((int) Math.min(99, ((i + 1) * 100.0) / n));
                        continue;
                    }
                    HttpURLConnection c = (HttpURLConnection) new URL(base + path + "?v=" + version).openConnection();
                    c.setConnectTimeout(8000); c.setReadTimeout(15000); c.setUseCaches(false);
                    if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
                    long len = Math.max(1, c.getContentLengthLong());
                    long got = 0;
                    try (InputStream in = c.getInputStream(); FileOutputStream fo = new FileOutputStream(out)) {
                        byte[] buf = new byte[16384];
                        for (int k; (k = in.read(buf)) > 0; ) {
                            fo.write(buf, 0, k); got += k;
                            long now = System.currentTimeMillis();
                            if (now - last > 120) { last = now; pr.step((int) Math.min(99, ((i + Math.min(1.0, (double) got / len)) * 100.0) / n)); }
                        }
                    }
                }
                try (FileOutputStream fo = new FileOutputStream(new File(tmp, "version.json"))) { fo.write(v.toString().getBytes("UTF-8")); }
                new File(tmp, ".complete").createNewFile();
                pr.step(100);
                cb.downloaded(version);
            } catch (Exception e) {
                cb.failed("не удалось скачать обновление");
            } finally {
                busy = false;
            }
        }).start();
    }

    // Хеши файлов установленной версии (version.json скачанной или вшитой).
    private JSONObject haveHashes() {
        try {
            InputStream in;
            File f = new File(liveDir(), "version.json");
            in = useLocal() && f.exists() ? new java.io.FileInputStream(f) : ctx.getAssets().open("www/version.json");
            try (InputStream i2 = in) { return new JSONObject(new String(readAll(i2), "UTF-8")).optJSONObject("hashes"); }
        } catch (Exception e) { return null; }
    }

    private boolean copyHave(String path, File out) {
        try {
            InputStream in;
            File src = new File(liveDir(), path);
            in = useLocal() ? (src.exists() ? new java.io.FileInputStream(src) : null) : ctx.getAssets().open("www/" + path);
            if (in == null) return false;
            try (InputStream i2 = in; FileOutputStream fo = new FileOutputStream(out)) {
                byte[] buf = new byte[16384];
                for (int k; (k = i2.read(buf)) > 0; ) fo.write(buf, 0, k);
            }
            return true;
        } catch (Exception e) { return false; }
    }

    // Старый способ (страница без окна обновления): проверить и сразу скачать.
    void check(Done done) {
        checkOnly(new Info() {
            @Override public void available(long version, int files) { download(new Info() {
                @Override public void available(long v, int f) {}
                @Override public void upToDate(long v) {}
                @Override public void downloaded(long v) { done.downloaded(v); }
                @Override public void failed(String why) { done.failed(why); }
            }, p -> {}); }
            @Override public void upToDate(long version) { done.upToDate(version); }
            @Override public void downloaded(long version) { done.downloaded(version); }
            @Override public void failed(String why) { done.failed(why); }
        });
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
