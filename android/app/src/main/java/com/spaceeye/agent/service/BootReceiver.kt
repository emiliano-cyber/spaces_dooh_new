// BootReceiver.kt — Restarts service after device reboot
package com.spaceeye.agent.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.spaceeye.agent.network.TokenStore

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            val token = TokenStore(context).getDeviceToken()
            if (token != null) {
                MonitorService.start(context)
            }
        }
    }
}
