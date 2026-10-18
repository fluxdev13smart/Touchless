package app.roadie.player;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.content.pm.PackageManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    private static final int REQ_TREE = 7001;
    private static final int REQ_STORAGE = 7002;
    private static final int REQ_NOTIF = 7003;

    private WebView web;
    private LocalServer server;
    private String token;
    private SharedPreferences sp;
    private volatile String libJson = "[]";
    private MediaSession session;

    private static final long ACTIONS = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_SKIP_TO_NEXT
            | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SEEK_TO | PlaybackState.ACTION_STOP;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        sp = getSharedPreferences("roadie", MODE_PRIVATE);
        SecureRandom rnd = new SecureRandom();
        token = Long.toHexString(rnd.nextLong()) + Long.toHexString(rnd.nextLong());

        try {
            server = new LocalServer(this, token);
            server.start();
        } catch (Exception e) {
            Toast.makeText(this, "Roadie could not start its audio server.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        web = new WebView(this);
        web.setBackgroundColor(0xFF0C0C0F);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.addJavascriptInterface(new Bridge(), "RoadieNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return !url.startsWith("http://127.0.0.1:");
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        if (Build.VERSION.SDK_INT >= 26) {
            web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }

        initSession();
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
        }
        web.loadUrl("http://127.0.0.1:" + server.port + "/index.html");
    }

    // ---------------------------------------------------------------
    // JavaScript bridge (called from the player page)

    public class Bridge {
        @JavascriptInterface
        public String info() {
            return "{\"token\":\"" + token + "\",\"port\":" + server.port + ",\"v\":1}";
        }

        @JavascriptInterface
        public void pickFolder() {
            runOnUiThread(MainActivity.this::launchPicker);
        }

        @JavascriptInterface
        public void loadSaved() {
            new Thread(MainActivity.this::loadSavedInternal, "roadie-load").start();
        }

        @JavascriptInterface
        public String getLibrary() {
            return libJson;
        }

        @JavascriptInterface
        public void nowPlaying(final String title, final String artist, final String album,
                               final boolean playing, final double pos, final double dur, final boolean keepAwake) {
            runOnUiThread(() -> applyNow(title, artist, album, playing, pos, dur, keepAwake));
        }
    }

    private void js(final String script) {
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript(script, null);
        });
    }

    // ---------------------------------------------------------------
    // Folder picking and scanning

    private void launchPicker() {
        try {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
            startActivityForResult(i, REQ_TREE);
        } catch (ActivityNotFoundException noPicker) {
            fallbackScan();
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_TREE) return;
        if (res != RESULT_OK || data == null || data.getData() == null) {
            js("window.__roadieLibrary&&window.__roadieLibrary(false)");
            return;
        }
        final Uri tree = data.getData();
        try {
            getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
        }
        sp.edit().putString("tree", tree.toString()).putBoolean("fallback", false).apply();
        scanTreeAsync(tree);
    }

    private void scanTreeAsync(final Uri tree) {
        new Thread(() -> {
            try {
                libJson = Library.scanTree(this, tree);
                js("window.__roadieLibrary&&window.__roadieLibrary(true)");
            } catch (Exception e) {
                js("window.__roadieError&&window.__roadieError('Could not read that folder.')");
                js("window.__roadieLibrary&&window.__roadieLibrary(false)");
            }
        }, "roadie-scan").start();
    }

    private void loadSavedInternal() {
        String t = sp.getString("tree", null);
        if (t != null) {
            Uri u = Uri.parse(t);
            boolean ok = false;
            for (UriPermission p : getContentResolver().getPersistedUriPermissions()) {
                if (p.getUri().equals(u) && p.isReadPermission()) ok = true;
            }
            if (ok) {
                scanTreeAsync(u);
                return;
            }
        } else if (sp.getBoolean("fallback", false) && hasStoragePermission()) {
            scanFallbackAsync();
            return;
        }
        js("window.__roadieLibrary&&window.__roadieLibrary(false)");
    }

    // Devices without a system folder picker: scan the Music folder and any USB or SD storage.

    private String storagePermission() {
        return Build.VERSION.SDK_INT >= 33 ? Manifest.permission.READ_MEDIA_AUDIO : Manifest.permission.READ_EXTERNAL_STORAGE;
    }

    private boolean hasStoragePermission() {
        return Build.VERSION.SDK_INT < 23 || checkSelfPermission(storagePermission()) == PackageManager.PERMISSION_GRANTED;
    }

    private void fallbackScan() {
        if (!hasStoragePermission()) {
            requestPermissions(new String[]{storagePermission()}, REQ_STORAGE);
            return;
        }
        scanFallbackAsync();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code == REQ_STORAGE) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) scanFallbackAsync();
            else js("window.__roadieError&&window.__roadieError('Roadie needs storage access to find your music.')");
        }
    }

    private void scanFallbackAsync() {
        new Thread(() -> {
            try {
                List<File> roots = new ArrayList<>();
                File ext = Environment.getExternalStorageDirectory();
                File music = new File(ext, "Music");
                roots.add(music.isDirectory() ? music : ext);
                File[] storages = new File("/storage").listFiles();
                if (storages != null) {
                    for (File f : storages) {
                        String n = f.getName();
                        if (n.equals("emulated") || n.equals("self")) continue;
                        File m = new File(f, "Music");
                        roots.add(m.isDirectory() ? m : f);
                    }
                }
                libJson = Library.scanFiles(roots);
                sp.edit().remove("tree").putBoolean("fallback", true).apply();
                js("window.__roadieLibrary&&window.__roadieLibrary(true)");
            } catch (Exception e) {
                js("window.__roadieError&&window.__roadieError('Could not read your storage.')");
                js("window.__roadieLibrary&&window.__roadieLibrary(false)");
            }
        }, "roadie-scan").start();
    }

    // ---------------------------------------------------------------
    // Media session: steering-wheel buttons, Bluetooth and the lock screen

    private void initSession() {
        session = new MediaSession(this, "Roadie");
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { js("window.__roadieKey&&__roadieKey('play')"); }
            @Override public void onPause() { js("window.__roadieKey&&__roadieKey('pause')"); }
            @Override public void onStop() { js("window.__roadieKey&&__roadieKey('pause')"); }
            @Override public void onSkipToNext() { js("window.__roadieKey&&__roadieKey('next')"); }
            @Override public void onSkipToPrevious() { js("window.__roadieKey&&__roadieKey('prev')"); }
            @Override public void onSeekTo(long pos) { js("window.__roadieKey&&__roadieKey('seek'," + (pos / 1000.0) + ")"); }
        });
        session.setPlaybackState(new PlaybackState.Builder()
                .setActions(ACTIONS)
                .setState(PlaybackState.STATE_PAUSED, 0, 0f)
                .build());
        session.setActive(true);
    }

    private void applyNow(String title, String artist, String album, boolean playing, double pos, double dur, boolean keepAwake) {
        if (session != null) {
            session.setMetadata(new MediaMetadata.Builder()
                    .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                    .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                    .putString(MediaMetadata.METADATA_KEY_ALBUM, album)
                    .putLong(MediaMetadata.METADATA_KEY_DURATION, (long) (dur * 1000))
                    .build());
            session.setPlaybackState(new PlaybackState.Builder()
                    .setActions(ACTIONS)
                    .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, (long) (pos * 1000), playing ? 1f : 0f)
                    .build());
            if (!session.isActive()) session.setActive(true);
        }
        PlaybackService.sync(this, playing, title, artist);
        if (playing && keepAwake) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getAction() == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0) {
            String k = null;
            switch (e.getKeyCode()) {
                case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                case KeyEvent.KEYCODE_HEADSETHOOK: k = "toggle"; break;
                case KeyEvent.KEYCODE_MEDIA_PLAY: k = "play"; break;
                case KeyEvent.KEYCODE_MEDIA_PAUSE:
                case KeyEvent.KEYCODE_MEDIA_STOP: k = "pause"; break;
                case KeyEvent.KEYCODE_MEDIA_NEXT: k = "next"; break;
                case KeyEvent.KEYCODE_MEDIA_PREVIOUS: k = "prev"; break;
                default: break;
            }
            if (k != null) {
                js("window.__roadieKey&&__roadieKey('" + k + "')");
                return true;
            }
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("(window.__roadieBack&&window.__roadieBack())?1:0", value -> {
            // Nothing to close: send the app to the background so the music keeps playing.
            if (!"1".equals(value)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onDestroy() {
        if (session != null) session.release();
        if (server != null) server.stop();
        PlaybackService.sync(this, false, "", "");
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
