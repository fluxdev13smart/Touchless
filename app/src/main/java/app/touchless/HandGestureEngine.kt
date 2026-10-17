package app.touchless

import kotlin.math.abs
import kotlin.math.hypot

enum class Direction { LEFT, RIGHT, UP, DOWN }

sealed interface Gesture {
    /** An air "push" toward the camera with [fingers] fingers raised. */
    data class Tap(val fingers: Int) : Gesture

    /** A quick hand movement with [fingers] fingers raised. Direction is from the user's point of view. */
    data class Swipe(val fingers: Int, val direction: Direction) : Gesture
}

/**
 * Turns a stream of hand landmarks into discrete gestures.
 *
 * Poses: one finger (index) or two fingers (index + middle) raised. Anything else is ignored.
 * - Swipe: the fingertip travels far enough, fast enough, along one axis.
 * - Tap: the hand gets noticeably bigger in the image (it moved toward the camera).
 *
 * Landmark coordinates must be normalized (0..1) and mirrored so +x is the user's right.
 */
class HandGestureEngine(
    private val sensitivity: () -> Int,
    private val onGesture: (Gesture) -> Unit,
) {
    private class Sample(val t: Long, val x: Float, val y: Float, val size: Float, val fingers: Int)

    private val history = ArrayDeque<Sample>()
    private var cooldownUntil = 0L

    fun onNoHand() {
        history.clear()
    }

    fun onHand(xs: FloatArray, ys: FloatArray, nowMs: Long) {
        val fingers = countFingers(xs, ys)
        if (fingers == 0 || nowMs < cooldownUntil) {
            history.clear()
            return
        }

        val size = dist(xs, ys, 0, 9)
        if (size <= 0f) return

        val px: Float
        val py: Float
        if (fingers == 1) {
            px = xs[8]
            py = ys[8]
        } else {
            px = (xs[8] + xs[12]) / 2f
            py = (ys[8] + ys[12]) / 2f
        }

        if (history.isNotEmpty() && history.last().fingers != fingers) history.clear()
        history.addLast(Sample(nowMs, px, py, size, fingers))
        while (history.isNotEmpty() && history.first().t < nowMs - WINDOW_MS) history.removeFirst()

        val first = history.first()
        val last = history.last()
        if (last.t - first.t < MIN_SPAN_MS) return

        val s = sensitivity().coerceIn(0, 100) / 100f
        val swipeThreshold = 0.30f - 0.15f * s
        val tapGrowth = 0.30f - 0.15f * s

        val dx = last.x - first.x
        val dy = last.y - first.y
        val ax = abs(dx)
        val ay = abs(dy)
        val growth = last.size / first.size

        if (growth >= 1f + tapGrowth && maxOf(ax, ay) < swipeThreshold * 0.6f) {
            fire(Gesture.Tap(fingers), nowMs)
            return
        }

        if (maxOf(ax, ay) >= swipeThreshold && abs(growth - 1f) < 0.25f) {
            val direction = when {
                ax >= ay * 1.6f -> if (dx > 0) Direction.RIGHT else Direction.LEFT
                ay >= ax * 1.6f -> if (dy > 0) Direction.DOWN else Direction.UP
                else -> return
            }
            fire(Gesture.Swipe(fingers, direction), nowMs)
        }
    }

    private fun fire(gesture: Gesture, nowMs: Long) {
        cooldownUntil = nowMs + COOLDOWN_MS
        history.clear()
        onGesture(gesture)
    }

    /** Returns 1 (index only), 2 (index + middle) or 0 (any other pose). */
    private fun countFingers(xs: FloatArray, ys: FloatArray): Int {
        val index = extended(xs, ys, 8, 6)
        val middle = extended(xs, ys, 12, 10)
        val ring = extended(xs, ys, 16, 14)
        val pinky = extended(xs, ys, 20, 18)
        return when {
            index && !middle && !ring && !pinky -> 1
            index && middle && !ring && !pinky -> 2
            else -> 0
        }
    }

    private fun extended(xs: FloatArray, ys: FloatArray, tip: Int, pip: Int): Boolean =
        dist(xs, ys, 0, tip) > dist(xs, ys, 0, pip) * 1.15f

    private fun dist(xs: FloatArray, ys: FloatArray, a: Int, b: Int): Float =
        hypot(xs[a] - xs[b], ys[a] - ys[b])

    private companion object {
        const val WINDOW_MS = 500L
        const val MIN_SPAN_MS = 100L
        const val COOLDOWN_MS = 900L
    }
}
