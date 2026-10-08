// InstallResultReceiver.kt — resultado de la instalacion remota
//
// El instalador de Android responde por broadcast. Aqui se traduce a algo que se
// pueda leer desde el dashboard: sin esto, una actualizacion que falla en campo
// seria invisible.
package com.spaceeye.agent.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.util.Log
import com.spaceeye.agent.network.RemoteLog

class InstallResultReceiver : BroadcastReceiver() {

    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != AppUpdater.ACCION_RESULTADO) return

        when (val estado = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -999)) {
            PackageInstaller.STATUS_SUCCESS -> {
                // Ojo: este mensaje casi nunca alcanza a salir, porque al instalarse
                // la app el sistema mata el proceso. El servicio se levanta solo y
                // la nueva version reporta su numero en la telemetria: esa es la
                // confirmacion real de que la actualizacion funciono.
                RemoteLog.info(ctx, "update", "Actualizacion instalada")
            }

            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                // El equipo no es device owner: Android exige confirmacion humana.
                // Se lanza la pantalla de instalacion por si hay alguien en sitio.
                @Suppress("DEPRECATION")
                val confirmar = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                if (confirmar != null) {
                    confirmar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    try {
                        ctx.startActivity(confirmar)
                        RemoteLog.warn(ctx, "update",
                            "La actualizacion espera confirmacion EN EL EQUIPO (" +
                                AppUpdater.estadoAutoActualizacion(ctx).motivo + ")")
                    } catch (e: Exception) {
                        RemoteLog.error(ctx, "update", "No se pudo mostrar la confirmacion: ${e.message}")
                    }
                }
            }

            else -> {
                val msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "sin detalle"
                Log.e("InstallResult", "estado=$estado msg=$msg")
                RemoteLog.error(ctx, "update", "Fallo la actualizacion (estado $estado): $msg")
            }
        }
    }
}
