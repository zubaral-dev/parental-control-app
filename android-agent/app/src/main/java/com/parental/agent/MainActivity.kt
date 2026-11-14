package com.parental.agent

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.parental.agent.services.CameraStreamService
import com.parental.agent.services.LocationTrackingService
import com.parental.agent.services.AppUsageMonitorService

/**
 * Main Setup Activity for Child Companion APK.
 * Configures Cloud Server URL, requests background permissions, and starts 24/7 foreground services.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var etServerUrl: EditText
    private lateinit var btnStartProtection: Button
    private lateinit var tvStatus: TextView

    companion object {
        private const val PERMISSION_REQUEST_CODE = 101
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        etServerUrl = findViewById(R.id.etServerUrl)
        btnStartProtection = findViewById(R.id.btnStartProtection)
        tvStatus = findViewById(R.id.tvStatus)

        // Default to cloud server or local
        val prefs = getSharedPreferences("parental_prefs", Context.MODE_PRIVATE)
        val savedUrl = prefs.getString("server_url", "https://airparental-backend.onrender.com")
        etServerUrl.setText(savedUrl)

        btnStartProtection.setOnClickListener {
            val url = etServerUrl.text.toString().trim()
            if (url.isEmpty()) {
                Toast.makeText(this, "Masukkan URL Server Backend!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            prefs.edit().putString("server_url", url).apply()
            requestRequiredPermissions()
        }
    }

    private fun requestRequiredPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            permissions.add(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        ActivityCompat.requestPermissions(this, permissions.toTypedArray(), PERMISSION_REQUEST_CODE)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST_CODE) {
            requestBatteryOptimizationExemption()
            startBackgroundServices()
        }
    }

    /**
     * Prevents Android OS (Doze mode) from killing the service in the background.
     */
    private fun requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            }
        }
    }

    /**
     * Starts persistent foreground services for location, app limits, and camera.
     */
    private fun startBackgroundServices() {
        // 1. Persistent Location Tracking Service
        val locationIntent = Intent(this, LocationTrackingService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(locationIntent)
        } else {
            startService(locationIntent)
        }

        // 2. App Usage Monitor Service
        val usageIntent = Intent(this, AppUsageMonitorService::class.java)
        startService(usageIntent)

        // 3. Camera Service
        val cameraIntent = Intent(this, CameraStreamService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(cameraIntent)
        } else {
            startService(cameraIntent)
        }

        tvStatus.text = "Layanan Perlindungan Aktif di Latar Belakang (24/7)"
        Toast.makeText(this, "Perlindungan Anak Berhasil Diaktifkan!", Toast.LENGTH_LONG).show()
    }
}
