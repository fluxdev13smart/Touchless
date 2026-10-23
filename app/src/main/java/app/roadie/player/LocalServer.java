package app.roadie.player;

import android.content.Context;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * A tiny web server that only listens on this device (127.0.0.1).
 * It serves the player page and streams songs with proper byte-range support,
 * so seeking works and the Web Audio equaliser is allowed to process the sound
 * (the page and the audio share one origin).
 */
final class LocalServer {

    private static final int PREFERRED_PORT = 38417; // fixed, so saved settings survive restarts

    private final Context ctx;
    private final String token;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private ServerSocket server;
    int port;

    LocalServer(Context ctx, String token) {
        this.ctx = ctx.getApplicationContext();
        this.token = token;
    }

    void start() throws IOException {
        InetAddress lo = InetAddress.getByName("127.0.0.1");
        try {
            server = new ServerSocket(PREFERRED_PORT, 50, lo);
        } catch (IOException busy) {
            server = new ServerSocket(0, 50, lo);
        }
        port = server.getLocalPort();
        Thread t = new Thread(() -> {
            while (!server.isClosed()) {
                try {
                    final Socket s = server.accept();
                    pool.execute(() -> handle(s));
                } catch (IOException e) {
                    if (server.isClosed()) break;
                }
            }
        }, "roadie-server");
        t.setDaemon(true);
        t.start();
    }

    void stop() {
        try {
            if (server != null) server.close();
        } catch (IOException ignored) {
        }
        pool.shutdownNow();
    }

    // ---------------------------------------------------------------

    private void handle(Socket s) {
        try {
            s.setSoTimeout(30000);
            InputStream in = new BufferedInputStream(s.getInputStream());
            OutputStream out = new BufferedOutputStream(s.getOutputStream(), 65536);
            String req = readLine(in);
            if (req == null || req.isEmpty()) return;
            String[] p = req.split(" ");
            if (p.length < 2) return;
            String method = p[0];
            String target = p[1];
            Map<String, String> h = new HashMap<>();
            String line;
            while ((line = readLine(in)) != null && !line.isEmpty()) {
                int i = line.indexOf(':');
                if (i > 0) h.put(line.substring(0, i).trim().toLowerCase(Locale.ROOT), line.substring(i + 1).trim());
            }
            int q = target.indexOf('?');
            String path = q >= 0 ? target.substring(0, q) : target;
            path = URLDecoder.decode(path.replace("+", "%2B"), "UTF-8");
            boolean head = "HEAD".equals(method);
            if (!"GET".equals(method) && !head) {
                simple(out, 405, "Method Not Allowed");
            } else if (path.startsWith("/m/")) {
                media(head, path, h.get("range"), out, false);
            } else if (path.startsWith("/l/")) {
                media(head, path, h.get("range"), out, true);
            } else {
                asset(head, path, out);
            }
            out.flush();
        } catch (Exception ignored) {
            // the player closes connections whenever it seeks or skips; that is normal
        } finally {
            try {
                s.close();
            } catch (IOException ignored) {
            }
        }
    }

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') b.write(c);
            if (b.size() > 8192) throw new IOException("line too long");
        }
        if (c == -1 && b.size() == 0) return null;
        return b.toString("UTF-8");
    }

    private void simple(OutputStream out, int code, String msg) throws IOException {
        byte[] body = (msg + "\n").getBytes(StandardCharsets.UTF_8);
        String hdr = "HTTP/1.1 " + code + " " + msg + "\r\nContent-Type: text/plain\r\nContent-Length: " + body.length + "\r\nConnection: close\r\n\r\n";
        out.write(hdr.getBytes(StandardCharsets.ISO_8859_1));
        out.write(body);
    }

    // ---------- page and fonts ----------

    private void asset(boolean head, String path, OutputStream out) throws IOException {
        if (path.equals("/")) path = "/index.html";
        if (path.contains("..")) {
            simple(out, 400, "Bad Request");
            return;
        }
        byte[] data;
        try (InputStream in = ctx.getAssets().open("www" + path)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            data = b.toByteArray();
        } catch (IOException missing) {
            simple(out, 404, "Not Found");
            return;
        }
        String hdr = "HTTP/1.1 200 OK\r\nContent-Type: " + mimeOf(path) + "\r\nContent-Length: " + data.length
                + "\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n";
        out.write(hdr.getBytes(StandardCharsets.ISO_8859_1));
        if (!head) out.write(data);
    }

    private static String mimeOf(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html; charset=utf-8";
        if (p.endsWith(".css")) return "text/css; charset=utf-8";
        if (p.endsWith(".js")) return "text/javascript; charset=utf-8";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    // ---------- songs ----------

    private void media(boolean head, String path, String range, OutputStream out, boolean lyrics) throws IOException {
        // /m/<token>/<id>  (song)   /l/<token>/<id>  (lyrics file)
        String[] parts = path.split("/");
        if (parts.length < 4 || !token.equals(parts[2])) {
            simple(out, 403, "Forbidden");
            return;
        }
        int id;
        try {
            id = Integer.parseInt(parts[3]);
        } catch (NumberFormatException e) {
            simple(out, 400, "Bad Request");
            return;
        }
        Library.Item it = lyrics ? Library.getLyrics(id) : Library.get(id);
        if (it == null) {
            simple(out, 404, "Not Found");
            return;
        }
        long total = it.size;
        if (total <= 0) {
            simple(out, 404, "Unknown size");
            return;
        }
        long start = 0, end = total - 1;
        boolean partial = false;
        if (range != null && range.startsWith("bytes=")) {
            String r = range.substring(6).split(",")[0].trim();
            int dash = r.indexOf('-');
            try {
                if (dash == 0) {
                    long n = Long.parseLong(r.substring(1));
                    start = Math.max(0, total - n);
                } else if (dash > 0) {
                    start = Long.parseLong(r.substring(0, dash));
                    if (dash < r.length() - 1) end = Math.min(total - 1, Long.parseLong(r.substring(dash + 1)));
                }
                partial = true;
            } catch (NumberFormatException ignored) {
                start = 0;
                end = total - 1;
                partial = false;
            }
        }
        if (start >= total || start > end) {
            String hdr = "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */" + total + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
            out.write(hdr.getBytes(StandardCharsets.ISO_8859_1));
            return;
        }
        long len = end - start + 1;
        StringBuilder sb = new StringBuilder();
        sb.append(partial ? "HTTP/1.1 206 Partial Content\r\n" : "HTTP/1.1 200 OK\r\n");
        sb.append("Content-Type: ").append(it.mime).append("\r\n");
        sb.append("Accept-Ranges: bytes\r\n");
        sb.append("Content-Length: ").append(len).append("\r\n");
        if (partial) sb.append("Content-Range: bytes ").append(start).append('-').append(end).append('/').append(total).append("\r\n");
        sb.append("Cache-Control: private, max-age=0\r\nConnection: close\r\n\r\n");
        out.write(sb.toString().getBytes(StandardCharsets.ISO_8859_1));
        if (head) return;
        try (InputStream in = it.open(ctx, start)) {
            byte[] buf = new byte[65536];
            long left = len;
            while (left > 0) {
                int n = in.read(buf, 0, (int) Math.min(buf.length, left));
                if (n < 0) break;
                out.write(buf, 0, n);
                left -= n;
            }
        }
    }
}
