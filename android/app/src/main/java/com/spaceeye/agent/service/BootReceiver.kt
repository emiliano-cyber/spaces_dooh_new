// BootReceiver.kt — Vuelve a levantar el agente tras reiniciar el equipo O tras
// actualizar la propia app.
//
// Lo segundo es imprescindible desde que existe la actualizacion remota: al
// instalar una version nueva, Android MATA el proceso y no lo vuelve a lanzar
// solo. Sin escuchar ACTION_MY_PACKAGE_REPLACED, cada actualizacion dejaria al
// equipo mudo hasta que alguien lo reiniciara.
package com.spaceeye.agent.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.spaceeye.agent.network.RemoteLog
import com.spaceeye.agent.network.TokenStore

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val porActualizacion = intent.action == Intent.ACTION_MY_PACKAGE_REPLACED
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON" ||
            porActualizacion) {
            val token = TokenStore(context).getDeviceToken()
            if (token != null) {
                RemoteLog.info(context, "boot",
                    if (porActualizacion) "App actualizada — arrancando agente de nuevo"
                    else "Dispositivo reiniciado — arrancando agente")
                MonitorService.start(context)
                // Re-asegura el watchdog periodico y el latido tras reiniciar el equipo.
                WatchdogWorker.schedule(context)
                com.spaceeye.agent.SpaceEyeApp.scheduleHeartbeat(context)
            }
        }
    }
}
