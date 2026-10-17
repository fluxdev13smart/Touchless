package app.touchless

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat

class MainActivity : Activity() {

    private lateinit var accessibilityStatus: TextView
    private lateinit var toggle: Button

    private val prefs by lazy { getSharedPreferences("touchless", MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        GestureService.sensitivity = prefs.getInt(KEY_SENSITIVITY, 50)

        val pad = dp(20)
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad * 2, pad, pad)
        }

        column.addView(text("Touchless", 30f, bold = true))
        column.addView(text("Control your phone with air gestures. Your camera is processed on the device and nothing is saved or sent anywhere.", 15f, top = 8))

        column.addView(text("1. Allow Touchless to tap and swipe for you", 17f, bold = true, top = 28))
        accessibilityStatus = text("", 15f, top = 4)
        column.addView(accessibilityStatus)
        column.addView(Button(this).apply {
            text = "Open accessibility settings"
            setOnClickListener { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
        })

        column.addView(text("2. Turn it on", 17f, bold = true, top = 20))
        toggle = Button(this).apply { setOnClickListener { onToggle() } }
        column.addView(toggle)

        column.addView(text("Sensitivity", 17f, bold = true, top = 20))
        column.addView(SeekBar(this).apply {
            max = 100
            progress = GestureService.sensitivity
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(bar: SeekBar, value: Int, fromUser: Boolean) {
                    GestureService.sensitivity = value
                    prefs.edit().putInt(KEY_SENSITIVITY, value).apply()
                }

                override fun onStartTrackingTouch(bar: SeekBar) = Unit
                override fun onStopTrackingTouch(bar: SeekBar) = Unit
            })
        })
        column.addView(text("Higher reacts to smaller movements. Lower avoids accidental triggers.", 13f))

        column.addView(text("Gestures", 17f, bold = true, top = 24))
        column.addView(
            text(
                "Hold your hand 30-80 cm from the front camera.\n\n" +
                    "One finger up (index):\n" +
                    "  - Push toward the screen: play / pause\n" +
                    "  - Swipe left / right: rewind / fast-forward (double-tap)\n" +
                    "  - Swipe up / down: volume\n\n" +
                    "Two fingers up (index + middle):\n" +
                    "  - Push toward the screen: Back\n" +
                    "  - Swipe up / down: scroll or next / previous video\n" +
                    "  - Swipe left / right: swipe sideways",
                15f,
                top = 4,
            )
        )

        setContentView(ScrollView(this).apply { addView(column) })
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun refresh() {
        val enabled = TouchlessAccessibilityService.instance != null
        accessibilityStatus.text = if (enabled) {
            "Enabled."
        } else {
            "Not enabled yet. Open the settings below, find Touchless under installed apps and switch it on."
        }
        toggle.text = if (GestureService.running) "Turn off" else "Turn on"
    }

    private fun onToggle() {
        if (GestureService.running) {
            stopService(Intent(this, GestureService::class.java))
            window.decorView.postDelayed({ refresh() }, 300)
            return
        }
        if (TouchlessAccessibilityService.instance == null) {
            Toast.makeText(this, "Enable Touchless in accessibility settings first", Toast.LENGTH_LONG).show()
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            return
        }
        val missing = requiredPermissions().filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            requestPermissions(missing.toTypedArray(), REQUEST_PERMISSIONS)
            return
        }
        startGestureService()
    }

    private fun startGestureService() {
        ContextCompat.startForegroundService(this, Intent(this, GestureService::class.java))
        window.decorView.postDelayed({ refresh() }, 500)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_PERMISSIONS) return
        val cameraGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        if (cameraGranted) {
            startGestureService()
        } else {
            Toast.makeText(this, "Camera permission is needed to see your gestures", Toast.LENGTH_LONG).show()
        }
    }

    private fun requiredPermissions(): List<String> {
        val list = mutableListOf(Manifest.permission.CAMERA)
        if (Build.VERSION.SDK_INT >= 33) list += Manifest.permission.POST_NOTIFICATIONS
        return list
    }

    private fun text(value: String, size: Float, bold: Boolean = false, top: Int = 0): TextView =
        TextView(this).apply {
            text = value
            textSize = size
            if (bold) setTypeface(typeface, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = dp(top) }
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private companion object {
        const val KEY_SENSITIVITY = "sensitivity"
        const val REQUEST_PERMISSIONS = 1
    }
}
