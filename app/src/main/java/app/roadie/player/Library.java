package app.roadie.player;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;

/** Finds the songs (and any .lrc lyrics files beside them) inside the folder the person picked. */
final class Library {

    static final class Item {
        int id;
        Uri uri;      // set when the file comes from the system folder picker
        File file;    // set when the file comes from a plain storage scan
        String name;
        String cat;
        String path;
        String mime;
        long size;
        long mod;
        int lrc = -1;

        /** Opens the file and jumps to byte offset {@code start}. */
        InputStream open(Context c, long start) throws IOException {
            InputStream in;
            if (file != null) {
                in = new FileInputStream(file);
            } else {
                in = c.getContentResolver().openInputStream(uri);
                if (in == null) throw new IOException("Cannot open " + name);
            }
            long left = start;
            while (left > 0) {
                long n = in.skip(left);
                if (n <= 0) {
                    if (in.read() < 0) break;
                    n = 1;
                }
                left -= n;
            }
            return in;
        }
    }

    private static volatile List<Item> items = new ArrayList<>();
    private static volatile List<Item> lyrics = new ArrayList<>();

    static Item get(int id) {
        List<Item> l = items;
        return (id >= 0 && id < l.size()) ? l.get(id) : null;
    }

    static Item getLyrics(int id) {
        List<Item> l = lyrics;
        return (id >= 0 && id < l.size()) ? l.get(id) : null;
    }

    private static final String[] EXT = {".mp3", ".m4a", ".m4b", ".aac", ".flac", ".wav", ".ogg", ".oga", ".opus", ".weba"};
    private static final int MAX_DEPTH = 8;

    private static boolean isAudio(String name, String mime) {
        if (name.startsWith(".")) return false;
        if (mime != null && mime.startsWith("audio/")) return true;
        String n = name.toLowerCase(Locale.ROOT);
        for (String e : EXT) if (n.endsWith(e)) return true;
        return false;
    }

    private static boolean isLrc(String name) {
        return !name.startsWith(".") && name.toLowerCase(Locale.ROOT).endsWith(".lrc");
    }

    private static String baseName(String name) {
        int i = name.lastIndexOf('.');
        return (i > 0 ? name.substring(0, i) : name).toLowerCase(Locale.ROOT);
    }

    private static String mimeFor(String name, String mime) {
        String n = name.toLowerCase(Locale.ROOT);
        if (n.endsWith(".mp3")) return "audio/mpeg";
        if (n.endsWith(".m4a") || n.endsWith(".m4b")) return "audio/mp4";
        if (n.endsWith(".aac")) return "audio/aac";
        if (n.endsWith(".flac")) return "audio/flac";
        if (n.endsWith(".wav")) return "audio/wav";
        if (n.endsWith(".ogg") || n.endsWith(".oga") || n.endsWith(".opus")) return "audio/ogg";
        if (n.endsWith(".weba")) return "audio/webm";
        return (mime != null && mime.startsWith("audio/")) ? mime : "audio/mpeg";
    }

    // ---------- folder picked with the system picker ----------

    static String scanTree(Context c, Uri tree) throws Exception {
        ArrayList<Item> out = new ArrayList<>();
        ArrayList<Item> lrcs = new ArrayList<>();
        String rootId = DocumentsContract.getTreeDocumentId(tree);
        String rootName = displayName(c, DocumentsContract.buildDocumentUriUsingTree(tree, rootId));
        if (rootName == null || rootName.isEmpty()) rootName = "Music";
        walk(c, tree, rootId, rootName, rootName, 0, out, lrcs);
        return finish(out, lrcs);
    }

    private static String displayName(Context c, Uri doc) {
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(doc, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null);
            if (cur != null && cur.moveToFirst()) return cur.getString(0);
        } catch (Exception ignored) {
        } finally {
            if (cur != null) cur.close();
        }
        return null;
    }

    private static void walk(Context c, Uri tree, String docId, String path, String cat, int depth,
                             ArrayList<Item> out, ArrayList<Item> lrcs) {
        if (depth > MAX_DEPTH) return;
        Uri kids = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId);
        ArrayList<String[]> dirs = new ArrayList<>();
        ArrayList<Item> here = new ArrayList<>();
        HashMap<String, Item> lrcHere = new HashMap<>();
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(kids, new String[]{
                    DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_MIME_TYPE,
                    DocumentsContract.Document.COLUMN_SIZE,
                    DocumentsContract.Document.COLUMN_LAST_MODIFIED}, null, null, null);
            if (cur == null) return;
            while (cur.moveToNext()) {
                String id = cur.getString(0);
                String name = cur.getString(1);
                String mime = cur.getString(2);
                long size = cur.isNull(3) ? 0 : cur.getLong(3);
                long mod = cur.isNull(4) ? 0 : cur.getLong(4);
                if (name == null) continue;
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    if (!name.startsWith(".")) dirs.add(new String[]{id, name});
                } else if (isAudio(name, mime)) {
                    Item it = new Item();
                    it.uri = DocumentsContract.buildDocumentUriUsingTree(tree, id);
                    it.name = name;
                    it.cat = cat;
                    it.path = path + "/" + name;
                    it.mime = mimeFor(name, mime);
                    it.size = size;
                    it.mod = mod;
                    here.add(it);
                } else if (isLrc(name)) {
                    Item it = new Item();
                    it.uri = DocumentsContract.buildDocumentUriUsingTree(tree, id);
                    it.name = name;
                    it.mime = "text/plain";
                    it.size = size;
                    lrcHere.put(baseName(name), it);
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (cur != null) cur.close();
        }
        for (Item it : here) {
            Item l = lrcHere.get(baseName(it.name));
            if (l != null) {
                it.lrc = lrcs.size();
                lrcs.add(l);
            }
            out.add(it);
        }
        for (String[] d : dirs) {
            walk(c, tree, d[0], path + "/" + d[1], depth == 0 ? d[1] : cat, depth + 1, out, lrcs);
        }
    }

    // ---------- plain storage scan (devices with no folder picker) ----------

    static String scanFiles(List<File> roots) throws Exception {
        ArrayList<Item> out = new ArrayList<>();
        ArrayList<Item> lrcs = new ArrayList<>();
        for (File r : roots) {
            if (r != null && r.isDirectory()) walkFiles(r, r.getName(), r.getName(), 0, out, lrcs);
        }
        return finish(out, lrcs);
    }

    private static void walkFiles(File dir, String path, String cat, int depth, ArrayList<Item> out, ArrayList<Item> lrcs) {
        if (depth > MAX_DEPTH) return;
        File[] kids = dir.listFiles();
        if (kids == null) return;
        ArrayList<Item> here = new ArrayList<>();
        HashMap<String, Item> lrcHere = new HashMap<>();
        for (File f : kids) {
            String name = f.getName();
            if (name.startsWith(".")) continue;
            if (f.isDirectory()) {
                walkFiles(f, path + "/" + name, depth == 0 ? name : cat, depth + 1, out, lrcs);
            } else if (isAudio(name, null)) {
                Item it = new Item();
                it.file = f;
                it.name = name;
                it.cat = cat;
                it.path = path + "/" + name;
                it.mime = mimeFor(name, null);
                it.size = f.length();
                it.mod = f.lastModified();
                here.add(it);
            } else if (isLrc(name)) {
                Item it = new Item();
                it.file = f;
                it.name = name;
                it.mime = "text/plain";
                it.size = f.length();
                lrcHere.put(baseName(name), it);
            }
        }
        for (Item it : here) {
            Item l = lrcHere.get(baseName(it.name));
            if (l != null) {
                it.lrc = lrcs.size();
                lrcs.add(l);
            }
            out.add(it);
        }
    }

    private static String finish(ArrayList<Item> out, ArrayList<Item> lrcs) throws Exception {
        JSONArray arr = new JSONArray();
        for (int i = 0; i < out.size(); i++) {
            Item it = out.get(i);
            it.id = i;
            JSONObject o = new JSONObject();
            o.put("i", i);
            o.put("name", it.name);
            o.put("cat", it.cat);
            o.put("path", it.path);
            o.put("size", it.size);
            o.put("mod", it.mod);
            o.put("lrc", it.lrc);
            o.put("type", it.mime);
            arr.put(o);
        }
        items = out;
        lyrics = lrcs;
        return arr.toString();
    }
}
