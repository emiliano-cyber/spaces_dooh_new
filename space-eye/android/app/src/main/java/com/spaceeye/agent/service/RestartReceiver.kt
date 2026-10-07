package com.spaceeye.agent.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.spaceeye.agent.network.RemoteLog
import com.spaceeye.agent.network.TokenStore

/**
 * Reinicia el MonitorService cuando lo dispara AlarmManager (tras un crash o al
 * quitar la app de recientes). Solo actua si el dispositivo ya esta emparejado.
 */
class RestartReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_RESTART = "com.spaceeye.agent.action.RESTART"
        const val ACTION_HEARTBEAT = "com.spaceeye.agent.action.HEARTBEAT"
        private const val TAG = "RestartReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != ACTION_RESTART && action != ACTION_HEARTBEAT) return

        if (TokenStore(context).getDeviceToken() != null) {
            // El reinicio explicito (crash / quitar de recientes) se reporta; el
            // latido periodico NO, para no saturar los registros.
            if (action == ACTION_RESTART) {
                Log.i(TAG, "Reiniciando MonitorService")
                RemoteLog.info(context, "service", "Servicio reiniciado (RestartReceiver)")
            }
            try {
                MonitorService.start(context)
            } catch (e: Exception) {
                Log.e(TAG, "Fallo al reiniciar el servicio: ${e.message}")
            }
        }

        // El latido siempre reprograma el siguiente (cadena auto-perpetuante).
        if (action == ACTION_HEARTBEAT) {
            com.spaceeye.agent.SpaceEyeApp.scheduleHeartbeat(context)
        }
    }
}
