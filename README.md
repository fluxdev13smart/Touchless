# Touchless

Control your Android phone with air gestures. The front camera tracks your hand (on-device, using MediaPipe Hand Landmarker) and an accessibility service performs the matching action on screen. Nothing is recorded or sent anywhere.

## Gestures

| Pose | Gesture | Action |
| --- | --- | --- |
| One finger (index) | Push toward the screen | Play / pause |
| One finger | Swipe left / right | Double-tap the left / right side (rewind / fast-forward in most video apps) |
| One finger | Swipe up / down | Volume up / down |
| Two fingers (index + middle) | Push toward the screen | Back |
| Two fingers | Swipe up / down | Swipe on screen (scroll, next / previous video) |
| Two fingers | Swipe left / right | Swipe sideways on screen |

Hold your hand roughly 30-80 cm from the front camera. Use the sensitivity slider in the app to tune it.

## Get the APK

The APK is built in the cloud by GitHub Actions on every push to `main`.

1. Open the **Releases** page of this repository.
2. Download `Touchless.apk` from the **Touchless (latest build)** release.
3. Open it on your phone and allow installs from your browser or file manager when asked.

### If Play Protect says "App blocked to protect your device"

In some countries Google Play Protect blocks any app that declares an accessibility service when it is installed from a browser or file manager (apps from the Play Store are not affected). Touchless needs the accessibility service to tap and swipe, so the options are:

- Install from a computer with `adb install Touchless.apk` (USB debugging on). This is not a browser or file-manager install.
- Try turning off "Scan apps with Play Protect" in the Play Store (profile > Play Protect > settings), install, then turn it back on.
- Publish the app through Google Play (a closed or internal testing track also works).

On Android 13+ you may also have to open Settings > Apps > Touchless > three dots > **Allow restricted settings** before the accessibility switch can be turned on.

## First run

1. Open Touchless and tap **Open accessibility settings**, find Touchless under installed apps and switch it on.
2. Back in the app, tap **Turn on** and allow the camera and notification permissions.
3. Open YouTube (or any app) and make a gesture.

## Build it yourself

Requires JDK 17, the Android SDK and Gradle 8.7.

```
curl -fL -o app/src/main/assets/hand_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
gradle assembleDebug
```

The APK ends up in `app/build/outputs/apk/debug/`.

## Notes

- Gesture detection is heuristic (finger pose plus movement distance and speed), so expect to tune the slider.
- Android only lets the camera run while a notification is showing, which is why a "Touchless is on" notification appears.
- Like Spatial Touch, Touchless uses its accessibility service to see which app is open. The camera only runs while a supported app (Instagram, TikTok, YouTube, Netflix, Prime Video, Disney+, Hotstar, Hulu, Facebook, Snapchat) is on screen. Tick "Work in every app" to use it everywhere.
- You still turn Touchless on once from the app; Android does not let a background service start the camera by itself.
- In Instagram Reels and TikTok, a one-finger push goes to the next video and a two-finger push goes to the previous one.
