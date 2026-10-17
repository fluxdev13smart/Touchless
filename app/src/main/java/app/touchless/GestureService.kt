package app.touchless

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.Build
import android.os.SystemClock
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Foreground service that watches the front camera, tracks one hand on-device
 * and forwards recognised gestures to [TouchlessAccessibilityService].
 */
class GestureService : LifecycleService() {

    private var landmarker: HandLandmarker? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private lateinit var analysisExecutor: ExecutorService

    private val engine = HandGestureEngine(
        sensitivity = { sensitivity },
        onGesture = { gesture -> TouchlessAccessibilityService.instance?.perform(gesture) },
    )

    override fun onCreate() {
        super.onCreate()
        analysisExecutor = Executors.newSingleThreadExecutor()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)

        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            stopSelf()
            return START_NOT_STICKY
        }

        startInForeground()

        if (landmarker == null) {
            try {
                landmarker = createLandmarker()
            } catch (e: Exception) {
                Log.e(TAG, "Could not load the hand tracking model", e)
                stopSelf()
                return START_NOT_STICKY
            }
            startCamera()
        }
        running = true
        return START_NOT_STICKY
    }

    private fun createLandmarker(): HandLandmarker {
        val base = BaseOptions.builder().setModelAssetPath(MODEL_ASSET).build()
        val options = HandLandmarker.HandLandmarkerOptions.builder()
            .setBaseOptions(base)
            .setNumHands(1)
            .setRunningMode(RunningMode.LIVE_STREAM)
            .setResultListener { result: HandLandmarkerResult, _: MPImage -> onResult(result) }
            .setErrorListener { e -> Log.e(TAG, "Hand tracking error", e) }
            .build()
        return HandLandmarker.createFromOptions(this, options)
    }

    private fun onResult(result: HandLandmarkerResult) {
        val hands = result.landmarks()
        if (hands.isEmpty()) {
            engine.onNoHand()
            return
        }
        val hand = hands[0]
        if (hand.size < 21) return
        val xs = FloatArray(21) { hand[it].x() }
        val ys = FloatArray(21) { hand[it].y() }
        engine.onHand(xs, ys, SystemClock.uptimeMillis())
    }

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            try {
                val provider = future.get()
                cameraProvider = provider
                val analysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                    .build()
                analysis.setAnalyzer(analysisExecutor) { proxy -> analyze(proxy) }
                provider.unbindAll()
                provider.bindToLifecycle(this, CameraSelector.DEFAULT_FRONT_CAMERA, analysis)
            } catch (e: Exception) {
                Log.e(TAG, "Could not start the camera", e)
                stopSelf()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun analyze(proxy: ImageProxy) {
        try {
            val detector = landmarker ?: return
            val bitmap = Bitmap.createBitmap(proxy.width, proxy.height, Bitmap.Config.ARGB_8888)
            bitmap.copyPixelsFromBuffer(proxy.planes[0].buffer)
            val matrix = Matrix().apply {
                postRotate(proxy.imageInfo.rotationDegrees.toFloat())
                postScale(-1f, 1f) // mirror the selfie camera so +x is the user's right
            }
            val upright = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            detector.detectAsync(BitmapImageBuilder(upright).build(), SystemClock.uptimeMillis())
        } catch (e: Exception) {
            Log.e(TAG, "Frame analysis failed", e)
        } finally {
            proxy.close()
        }
    }

    private fun startInForeground() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Touchless", NotificationManager.IMPORTANCE_LOW)
        )
        val stopIntent = PendingIntent.getService(
            this,
            0,
            Intent(this, GestureService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val openIntent = PendingIntent.getActivity(
            this,
            1,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentTitle("Touchless is on")
            .setContentText("Watching for air gestures")
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopIntent)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    override fun onDestroy() {
        running = false
        try {
            cameraProvider?.unbindAll()
        } catch (_: Exception) {
        }
        landmarker?.close()
        landmarker = null
        analysisExecutor.shutdown()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "Touchless"
        private const val MODEL_ASSET = "hand_landmarker.task"
        private const val CHANNEL_ID = "touchless"
        private const val NOTIFICATION_ID = 1
        const val ACTION_STOP = "app.touchless.STOP"

        @Volatile
        var running = false

        /** 0..100. Higher means smaller movements trigger gestures. */
        @Volatile
        var sensitivity = 50
    }
}
