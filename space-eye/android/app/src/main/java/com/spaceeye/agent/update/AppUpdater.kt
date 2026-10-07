// AppUpdater.kt — actualizacion remota de la propia app
//
// Los equipos viven en espectaculares: mandar a alguien a reinstalar el APK cuesta
// un viaje por sitio. Esto permite actualizarlos desde el dashboard.
//
// Dos escenarios, mismo codigo:
//   - Si la app es DEVICE OWNER (equipo provisionado en modo kiosco), la
//     instalacion es SILENCIOSA: nadie toca el telefono.
//   - Si no lo es, Android exige confirmacion: se lanza la pantalla de
//     instalacion y alguien en sitio da un toque. Se reporta como tal para que en
//     el dashboard se sepa que quedo pendiente.
//
// La app se reinicia sola al terminar: el instalador mata el proceso y el
// MonitorService vuelve por su cuenta (START_STICKY + AlarmManager).
package com.spaceeye.agent.update

import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log
import com.spaceeye.agent.BuildConfig
import com.spaceeye.agent.network.RemoteLog
import java.security.MessageDigest

class AppUpdater(private val ctx: Context) {

    companion object {
        private const val TAG = "AppUpdater"
        const val ACCION_RESULTADO = "com.spaceeye.agent.INSTALL_RESULT"

        /** Si es device owner, puede instalar sin que nadie toque la pantalla. */
        fun esDeviceOwner(ctx: Context): Boolean = try {
            val dpm = ctx.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            dpm.isDeviceOwnerApp(ctx.packageName)
        } catch (e: Exception) {
            false
        }
    }

    sealed class Resultado {
        object Silenciosa : Resultado()                 // instalando sin intervencion
        object EsperandoToque : Resultado()             // hace falta confirmar en el equipo
        data class Fallo(val motivo: String) : Resultado()
    }

    /**
     * Descarga el APK e inicia la instalacion.
     *
     * @param url         de donde bajarlo (el mismo /space-eye.apk que ya se publica)
     * @param sha256      huella esperada; si no coincide, NO se instala. Es la unica
     *                    defensa real: el APK viaja por HTTP en claro.
     * @param versionCode version que se espera instalar, para no reinstalar la misma.
     */
    fun actualizar(url: String, sha256: String?, versionCode: Int?): Resultado {
        if (versionCode != null && versionCode <= BuildConfig.VERSION_CODE) {
            return Resultado.Fallo("ya tiene la version $versionCode o superior")
        }

        val bytes = try {
            descargar(url)
        } catch (e: Exception) {
            RemoteLog.error(ctx, "update", "No se pudo descargar la actualizacion: ${e.message}")
            return Resultado.Fallo("descarga fallida: ${e.message}")
        }

        if (bytes.size < 1_000_000) {
            return Resultado.Fallo("el archivo descargado es demasiado chico (${bytes.size} bytes)")
        }

        if (!sha256.isNullOrBlank()) {
            val real = huella(bytes)
            if (!real.equals(sha256, ignoreCase = true)) {
                RemoteLog.error(ctx, "update", "Huella del APK no coincide; se cancela la instalacion")
                return Resultado.Fallo("huella no coincide (esperada $sha256, obtenida $real)")
            }
        }

        return instalar(bytes)
    }

    private fun descargar(url: String): ByteArray {
        val con = (java.net.URL(url).openConnection() as java.net.HttpURLConnection).apply {
            connectTimeout = 30_000
            readTimeout = 120_000
            instanceFollowRedirects = true
        }
        try {
            if (con.responseCode !in 200..299) throw RuntimeException("HTTP ${con.responseCode}")
            return con.inputStream.use { it.readBytes() }
        } finally {
            con.disconnect()
        }
    }

    private fun huella(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes)
            .joinToString("") { "%02x".format(it) }

    private fun instalar(apk: ByteArray): Resultado {
        val pi = ctx.packageManager.packageInstaller
        var sessionId = -1
        return try {
            val params = PackageInstaller.SessionParams(
                PackageInstaller.SessionParams.MODE_FULL_INSTALL
            ).apply {
                setAppPackageName(ctx.packageName)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    // Sin esto el sistema puede posponer la instalacion hasta que el
                    // equipo este "inactivo", y estos nunca lo estan.
                    setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
                }
            }
            sessionId = pi.createSession(params)

            pi.openSession(sessionId).use { session ->
                session.openWrite("space-eye", 0, apk.size.toLong()).use { out ->
                    out.write(apk)
                    session.fsync(out)
                }

                val intent = Intent(ACCION_RESULTADO).setPackage(ctx.packageName)
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                    (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_MUTABLE else 0)
                val pending = PendingIntent.getBroadcast(ctx, sessionId, intent, flags)
                session.commit(pending.intentSender)
            }

            val owner = esDeviceOwner(ctx)
            RemoteLog.info(ctx, "update",
                "Instalando actualizacion (${apk.size / 1024 / 1024} MB, " +
                    if (owner) "silenciosa)" else "requiere confirmacion en el equipo)")
            if (owner) Resultado.Silenciosa else Resultado.EsperandoToque
        } catch (e: Exception) {
            Log.e(TAG, "instalacion fallida: ${e.message}", e)
            if (sessionId >= 0) try { pi.abandonSession(sessionId) } catch (_: Exception) {}
            RemoteLog.error(ctx, "update", "Fallo la instalacion: ${e.message}")
            Resultado.Fallo(e.message ?: "error desconocido")
        }
    }
}
