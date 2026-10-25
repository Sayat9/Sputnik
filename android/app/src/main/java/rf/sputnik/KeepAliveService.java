package rf.sputnik;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

// Держит приложение живым в фоне, пока идёт онлайн-партия: страница не замирает при сворачивании, связь не рвётся.
// Запускается и останавливается страницей (SputnikApp.keepAlive); при закрытии окна из списка приложений останавливается сам.
public class KeepAliveService extends Service {
    private static final String CHANNEL = "online";
    private PowerManager.WakeLock wake;
    private WifiManager.WifiLock wifi;

    @Override public IBinder onBind(Intent i) { return null; }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Онлайн-партия", NotificationManager.IMPORTANCE_LOW));
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        Notification n = b.setSmallIcon(R.mipmap.ic_launcher).setContentTitle(getString(R.string.app_name)).setContentText("Онлайн-партия: связь держится в фоне")
                .setContentIntent(pi).setOngoing(true).build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(7, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC); else startForeground(7, n);
        try {
            if (wake == null) { wake = ((PowerManager) getSystemService(Context.POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "rf.sputnik:online"); wake.setReferenceCounted(false); }
            if (!wake.isHeld()) wake.acquire();
            if (wifi == null) { wifi = ((WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE)).createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "rf.sputnik:online"); wifi.setReferenceCounted(false); }
            if (!wifi.isHeld()) wifi.acquire();
        } catch (Exception e) { /* без блокировок связь всё равно держится сервисом */ }
        return START_STICKY;
    }

    @Override public void onTaskRemoved(Intent root) { stopSelf(); super.onTaskRemoved(root); }          // окно закрыли — связь не нужна

    @Override public void onDestroy() {
        try { if (wake != null && wake.isHeld()) wake.release(); if (wifi != null && wifi.isHeld()) wifi.release(); } catch (Exception e) { }
        super.onDestroy();
    }
}
