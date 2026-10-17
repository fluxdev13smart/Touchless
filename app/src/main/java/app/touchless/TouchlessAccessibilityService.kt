package app.touchless

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent

/**
 * Performs the on-screen actions for recognised air gestures.
 *
 * One finger:  tap = play/pause, swipe left/right = double-tap the left/right side
 *              (seek back/forward in most video apps), swipe up/down = volume.
 * Two fingers: tap = Back, swipe = a matching swipe on screen (scroll, next/previous video).
 */
class TouchlessAccessibilityService : AccessibilityService() {

    private val main = Handler(Looper.getMainLooper())

    override fun onServiceConnected() {
        instance = this
    }

    override fun onUnbind(intent: Intent?): Boolean {
        instance = null
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit

    fun perform(gesture: Gesture) {
        main.post {
            when (gesture) {
                is Gesture.Tap ->
                    if (gesture.fingers == 1) mediaKey(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)
                    else performGlobalAction(GLOBAL_ACTION_BACK)

                is Gesture.Swipe ->
                    if (gesture.fingers == 1) oneFinger(gesture.direction)
                    else twoFingers(gesture.direction)
            }
        }
    }

    private fun oneFinger(direction: Direction) {
        val w = resources.displayMetrics.widthPixels.toFloat()
        val h = resources.displayMetrics.heightPixels.toFloat()
        when (direction) {
            Direction.RIGHT -> doubleTap(w * 0.85f, h * 0.5f)
            Direction.LEFT -> doubleTap(w * 0.15f, h * 0.5f)
            Direction.UP -> adjustVolume(AudioManager.ADJUST_RAISE)
            Direction.DOWN -> adjustVolume(AudioManager.ADJUST_LOWER)
        }
    }

    private fun twoFingers(direction: Direction) {
        val w = resources.displayMetrics.widthPixels.toFloat()
        val h = resources.displayMetrics.heightPixels.toFloat()
        when (direction) {
            Direction.UP -> swipe(w * 0.5f, h * 0.7f, w * 0.5f, h * 0.3f)
            Direction.DOWN -> swipe(w * 0.5f, h * 0.3f, w * 0.5f, h * 0.7f)
            Direction.LEFT -> swipe(w * 0.75f, h * 0.5f, w * 0.25f, h * 0.5f)
            Direction.RIGHT -> swipe(w * 0.25f, h * 0.5f, w * 0.75f, h * 0.5f)
        }
    }

    private fun swipe(x1: Float, y1: Float, x2: Float, y2: Float) {
        val path = Path().apply {
            moveTo(x1, y1)
            lineTo(x2, y2)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, 250)
        dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
    }

    private fun doubleTap(x: Float, y: Float) {
        val first = GestureDescription.StrokeDescription(Path().apply { moveTo(x, y) }, 0, 40)
        val second = GestureDescription.StrokeDescription(Path().apply { moveTo(x, y) }, 120, 40)
        dispatchGesture(
            GestureDescription.Builder().addStroke(first).addStroke(second).build(),
            null,
            null,
        )
    }

    private fun mediaKey(code: Int) {
        val audio = getSystemService(AudioManager::class.java)
        audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
        audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
    }

    private fun adjustVolume(direction: Int) {
        getSystemService(AudioManager::class.java)
            .adjustStreamVolume(AudioManager.STREAM_MUSIC, direction, AudioManager.FLAG_SHOW_UI)
    }

    companion object {
        @Volatile
        var instance: TouchlessAccessibilityService? = null
    }
}
