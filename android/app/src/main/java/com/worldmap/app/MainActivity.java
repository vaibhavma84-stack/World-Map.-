package com.worldmap.app;

import android.Manifest;
import android.app.Activity;
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
