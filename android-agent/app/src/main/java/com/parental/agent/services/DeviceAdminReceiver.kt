package com.parental.agent.services

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

class DeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Toast.makeText(context, "Perlindungan Administrator Perangkat Diaktifkan", Toast.LENGTH_SHORT).show()
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        return "Peringatan: Mematikan administrator akan mematikan fitur perlindungan keselamatan anak!"
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Toast.makeText(context, "Perlindungan Administrator Perangkat Dinonaktifkan", Toast.LENGTH_SHORT).show()
    }
}
