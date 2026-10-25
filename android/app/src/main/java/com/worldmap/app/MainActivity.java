package com.worldmap.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.provider.MediaStore;
import java.io.OutputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentLinkedQueue;
import android.database.Cursor;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import android.content.res.AssetFileDescriptor;

import java.io.FileInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * The map, held inside the app: its pages and data are served from the APK's
 * own assets, so it works with no signal at all.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/index.html";
    private static final int ASK_LOCATION = 1;

    private WebView web;
    private WebViewAssetLoader assets;
    private String geoOrigin;
    private GeolocationPermissions.Callback geoCallback;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        web.setBackgroundColor(0xFFB7D7EC);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.addJavascriptInterface(new Updater(), "WorldMapApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String path = url.getPath();
                if (HOST.equals(url.getHost()) && path != null && path.endsWith(".pmtiles")) {
                    return pieceOf(path.substring("/assets/".length()), request.getRequestHeaders());
                }
                return assets.shouldInterceptRequest(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (HOST.equals(url.getHost())) return false;
                // Links out of the app open in the phone's browser.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException e) {
                    // Nothing to open it with; stay on the map.
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                    return;
                }
                geoOrigin = origin;
                geoCallback = callback;
                requestPermissions(new String[] {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION }, ASK_LOCATION);
            }
        });

        if (saved != null) web.restoreState(saved);
        else web.loadUrl(START);
    }

    /**
     * The world coastline file is read a piece at a time (an HTTP range):
     * answer with just those bytes, straight from the APK (stored uncompressed).
     */
    private WebResourceResponse pieceOf(String asset, Map<String, String> headers) {
        try {
            AssetFileDescriptor fd = getAssets().openFd(asset);
            long total = fd.getLength();
            long start = 0, end = total - 1;
            String range = null;
            for (Map.Entry<String, String> h : headers.entrySet()) {
                if ("range".equalsIgnoreCase(h.getKey())) range = h.getValue();
            }
            if (range != null && range.startsWith("bytes=")) {
                String[] se = range.substring(6).split("-", 2);
                start = Long.parseLong(se[0].trim());
                if (se.length > 1 && !se[1].trim().isEmpty()) end = Math.min(Long.parseLong(se[1].trim()), total - 1);
            }
            final long length = end - start + 1;
            FileInputStream in = fd.createInputStream();
            long toSkip = start;
            while (toSkip > 0) {
                long skipped = in.skip(toSkip);
                if (skipped <= 0) break;
                toSkip -= skipped;
            }
            InputStream body = new FilterInputStream(in) {
                long left = length;
                @Override public int read() throws IOException {
                    if (left <= 0) return -1;
                    int b = super.read();
                    if (b >= 0) left--;
                    return b;
                }
                @Override public int read(byte[] buf, int off, int len) throws IOException {
                    if (left <= 0) return -1;
                    int n = super.read(buf, off, (int) Math.min(len, left));
                    if (n > 0) left -= n;
                    return n;
                }
            };
            Map<String, String> out = new HashMap<>();
            out.put("Accept-Ranges", "bytes");
            out.put("Content-Length", String.valueOf(length));
            out.put("Content-Range", "bytes " + start + "-" + end + "/" + total);
            out.put("Access-Control-Allow-Origin", "*");
            return new WebResourceResponse("application/octet-stream", null,
                    range != null ? 206 : 200, range != null ? "Partial Content" : "OK", out, body);
        } catch (IOException | NumberFormatException e) {
            return null; // not in this build: the map keeps Natural Earth's coast
        }
    }

    /**
     * Updates from inside the app: the page finds the newest APK on GitHub,
     * this downloads it with the phone's download manager (resumes if the
     * signal drops, works on mobile data) and opens Android's installer.
     */
    private long downloadId = -1;
    private final ConcurrentLinkedQueue<String> aisLines = new ConcurrentLinkedQueue<>();
    private volatile int aisGeneration = 0;
    private volatile String aisState = "Off";
    private volatile java.io.Closeable aisSocket;

    private void offer(String line) {
        if (line.startsWith("!") || line.startsWith("$")) {
            aisLines.offer(line);
            while (aisLines.size() > 20000) aisLines.poll();
        }
    }

    private class Updater {
        @JavascriptInterface
        public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (PackageManager.NameNotFoundException e) {
                return "";
            }
        }

        @JavascriptInterface
        public void download(String url, String name) {
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (downloadId >= 0) dm.remove(downloadId);
            java.io.File old = new java.io.File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), name);
            if (old.exists()) old.delete();
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url))
                    .setTitle("World Map update")
                    .setDescription(name)
                    .setMimeType("application/vnd.android.package-archive")
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(true)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                    .setDestinationInExternalFilesDir(MainActivity.this, Environment.DIRECTORY_DOWNLOADS, name);
            downloadId = dm.enqueue(r);
        }

        /** "running 45", "done", "failed", or "none". */
        @JavascriptInterface
        public String progress() {
            if (downloadId < 0) return "none";
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            try (Cursor c = dm.query(new DownloadManager.Query().setFilterById(downloadId))) {
                if (c == null || !c.moveToFirst()) return "failed";
                int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                if (status == DownloadManager.STATUS_SUCCESSFUL) return "done";
                if (status == DownloadManager.STATUS_FAILED) return "failed";
                long got = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                long total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                return "running " + (total > 0 ? (got * 100 / total) : 0);
            }
        }

        /** Saves a picture of the map in Pictures/World Map and offers to share it. */
        @JavascriptInterface
        public String shareImage(String base64) {
            try {
                byte[] png = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
                ContentValues v = new ContentValues();
                v.put(MediaStore.Images.Media.DISPLAY_NAME, "World Map " + System.currentTimeMillis() + ".png");
                v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                if (Build.VERSION.SDK_INT >= 29) v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/World Map");
                Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return "failed";
                try (OutputStream o = getContentResolver().openOutputStream(uri)) { o.write(png); }
                Intent send = new Intent(Intent.ACTION_SEND).setType("image/png")
                        .putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(Intent.createChooser(send, "Share the map").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                return "ok";
            } catch (Exception e) {
                return "failed";
            }
        }

        // ---- The ship's AIS: NMEA sentences from the bridge network (TCP or UDP).
        @JavascriptInterface
        public void aisConnect(String host, int port, boolean udp) {
            aisDisconnect();
            final int generation = ++aisGeneration;
            aisState = "Connecting to " + (udp ? "UDP port " + port : host + ":" + port) + "…";
            Thread t = new Thread(() -> {
                while (generation == aisGeneration) {
                    try {
                        if (udp) {
                            try (DatagramSocket ds = new DatagramSocket(port)) {
                                aisSocket = ds;
                                ds.setSoTimeout(5000);
                                aisState = "Listening on UDP port " + port;
                                byte[] buf = new byte[4096];
                                while (generation == aisGeneration) {
                                    DatagramPacket pk = new DatagramPacket(buf, buf.length);
                                    try { ds.receive(pk); } catch (java.net.SocketTimeoutException e) { continue; }
                                    for (String line : new String(pk.getData(), 0, pk.getLength(), StandardCharsets.US_ASCII).split("[\\r\\n]+")) offer(line);
                                }
                            }
                        } else {
                            try (Socket sock = new Socket()) {
                                aisSocket = sock;
                                sock.connect(new InetSocketAddress(host, port), 8000);
                                sock.setSoTimeout(60000);
                                aisState = "Connected to " + host + ":" + port;
                                BufferedReader in = new BufferedReader(new InputStreamReader(sock.getInputStream(), StandardCharsets.US_ASCII));
                                String line;
                                while (generation == aisGeneration && (line = in.readLine()) != null) offer(line);
                            }
                        }
                    } catch (Exception e) {
                        if (generation != aisGeneration) break;
                        aisState = "No connection (" + e.getClass().getSimpleName() + "); trying again";
                        try { Thread.sleep(5000); } catch (InterruptedException ie) { break; }
                    }
                }
            });
            t.setDaemon(true);
            t.start();
        }

        @JavascriptInterface
        public void aisDisconnect() {
            aisGeneration++;
            try { if (aisSocket != null) aisSocket.close(); } catch (Exception e) { /* closed */ }
            aisSocket = null;
            aisState = "Off";
            aisLines.clear();
        }

        /** The sentences received since the last call, one per line. */
        @JavascriptInterface
        public String aisRead() {
            StringBuilder b = new StringBuilder();
            String line;
            while ((line = aisLines.poll()) != null) b.append(line).append('\n');
            return b.toString();
        }

        @JavascriptInterface
        public String aisState() { return aisState; }

        /** Opens the installer; first asks to allow installs from this app if needed. */
        @JavascriptInterface
        public String install() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
                return "allow";
            }
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            Uri apk = dm.getUriForDownloadedFile(downloadId);
            if (apk == null) return "missing";
            Intent i = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(apk, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                startActivity(i);
                return "ok";
            } catch (ActivityNotFoundException e) {
                return "missing";
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        if (code != ASK_LOCATION || geoCallback == null) return;
        boolean granted = false;
        for (int r : results) granted |= r == PackageManager.PERMISSION_GRANTED;
        geoCallback.invoke(geoOrigin, granted, false);
        geoCallback = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
