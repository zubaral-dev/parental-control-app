package com.parental.agent.services

import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import io.socket.client.Socket
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

class AppUsageMonitorService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var socket: Socket? = null
    private val blockedPackages = mutableSetOf<String>()
    private var currentForegroundPackage: String = ""

    private val pollRunnable = object : Runnable {
        override fun run() {
            checkCurrentAppAndLimits()
            handler.postDelayed(this, 2000) // Poll every 2 seconds
        }
    }

    override fun onCreate() {
        super.onCreate()
        handler.post(pollRunnable)
    }

    private fun checkCurrentAppAndLimits() {
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val endTime = System.currentTimeMillis()
        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
        }
        val startTime = calendar.timeInMillis

        // Detect current foreground package
        val events = usageStatsManager.queryEvents(endTime - 5000, endTime)
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                currentForegroundPackage = event.packageName
            }
        }

        // Check if current app is blocked
        if (blockedPackages.contains(currentForegroundPackage)) {
            enforceAppBlock(currentForegroundPackage)
        }

        // Aggregate daily usage stats
        val statsList = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            startTime,
            endTime
        )

        var totalScreenTimeMillis = 0L
        val appListJson = JSONArray()

        statsList?.forEach { stats ->
            if (stats.totalTimeInForeground > 60000) { // More than 1 min
                totalScreenTimeMillis += stats.totalTimeInForeground
                val appObj = JSONObject().apply {
                    put("packageName", stats.packageName)
                    put("usedMinutes", (stats.totalTimeInForeground / 60000).toInt())
                    put("isBlocked", blockedPackages.contains(stats.packageName))
                }
                appListJson.put(appObj)
            }
        }

        // Emit stats to server
        val payload = JSONObject().apply {
            put("currentApp", currentForegroundPackage)
            put("screenTimeTodayMinutes", (totalScreenTimeMillis / 60000).toInt())
            put("appLimits", appListJson)
        }
        socket?.emit("child:app_stats", payload)
    }

    private fun enforceAppBlock(packageName: String) {
        Log.w("AppUsageMonitor", "Blocking restricted package: $packageName")
        // Redirect to Android Home launcher
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(pollRunnable)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
