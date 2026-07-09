package com.spaceeye.agent.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.spaceeye.agent.network.TokenStore

/**
 * Reinicia el MonitorService cuando lo dispara AlarmManager (tras un crash o al
 * quitar la app de recientes). Solo actua si el dispositivo ya esta emparejado.
 */
class RestartReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_RESTART = "com.spaceeye.agent.action.RESTART"
        private const val TAG = "RestartReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_RESTART) return
        if (TokenStore(context).getDeviceToken() != null) {
            Log.i(TAG, "Reiniciando MonitorService")
            try {
                MonitorService.start(context)
            } catch (e: Exception) {
                Log.e(TAG, "Fallo al reiniciar el servicio: ${e.message}")
            }
        }
    }
}
