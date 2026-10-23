# Roadie

A dark, Spotify-style music player for a car tablet. Pick one main folder; every folder inside it
becomes a category (Rock, Chill, Arabic…). Roadie has its own **10-band equaliser** that really
shapes the sound, so it works even when the car's own EQ is locked.

- Browse like Retro Music Player: **Folders** (your main-folder categories), Songs, Albums, Artists, Genres and Playlists, plus a "For you" home with last added, recently played and favourites
- Cover art is read from your songs, and the full-screen player takes its colours from the cover
- Slide animation between songs (buttons or swipe) and 8 Now Playing looks: Blur, Card, Vinyl, Full, Adaptive, Circle, Classic, Minimal
- Live visuals while playing (Halo, Skyline, Warp, Waves, Rings, or Auto to rotate them)
- Weather effects over the player: snow, rain, storm, stars, fireflies, petals, leaves, embers, bubbles, aurora
- Synced lyrics from `.lrc` files next to the songs (or lyrics inside the tags), queue with play next / add to queue, playlists, favourites, sleep timer, playback speed
- Steering-wheel / Bluetooth buttons, keeps playing when another app is in front
- Remembers your folder, so it opens straight to your music next time

## Get the APK

1. Open the **Releases** page of this repo and download **Roadie.apk**
   (or open **Actions → Build Roadie APK → latest run → Artifacts**).
2. Copy it to the tablet, open it, and allow installs from your browser or file manager when asked.
3. Open **Roadie**, tap **Choose folder**, and pick your main music folder.

The APK is rebuilt on every push to `main`. To rebuild by hand: **Actions → Build Roadie APK → Run workflow**.

## Needs

- Android 5.0 or newer, with an up-to-date **Android System WebView** (Chrome 111+ looks best; older versions fall back gracefully)
- A system folder picker. If the device has none, Roadie scans the `Music` folder and any USB or SD card instead

## Project layout

| Path | What it is |
| --- | --- |
| `app/src/main/assets/www/` | The player: `index.html`, `app.css`, and `core`, `audio`, `views`, `player`, `fx`, `main` scripts |
| `app/src/main/java/app/roadie/player/` | Folder access, the on-device audio server, media keys |
| `branding/` | Logo (1024 and 512 px) |
| `.github/workflows/build-apk.yml` | Builds and publishes the APK |

## About the signing key

`app/roadie.keystore` signs the APK so that new builds install over old ones. It is a personal
sideload key, not a store key. Keep the repo private, or replace the key before sharing the app.
