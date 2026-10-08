// AppUpdater.kt — actualizacion remota de la propia app
//
// Los equipos viven en espectaculares: mandar a alguien a reinstalar el APK cuesta
// un viaje por sitio. Esto permite actualizarlos desde el dashboard.
//
// Tres escenarios, mismo codigo:
//   - DEVICE OWNER (modo kiosco): instalacion SILENCIOSA.
//   - Android 12+ con el permiso UPDATE_PACKAGES_WITHOUT_USER_ACTION (desde la
//     0.16.4): la app se actualiza A SI MISMA sin que nadie confirme. Las
//     versiones anteriores no lo declaraban, asi que el paso a la 0.16.4 aun
//     pide un toque; de ahi en adelante, solas.
//   - Si no (Android 11 o antes, o "Instalar apps desconocidas" apagado),
//     Android exige confirmacion: se lanza la pantalla de instalacion y alguien
//     en sitio da un toque. Cada estado reporta cual de los tres aplica
//     (estadoAutoActualizacion) para que el panel lo diga.
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

        /**
         * Si la PROXIMA actualizacion se instalara sola, y si no, por que. Se
         * reporta en cada estado para que el panel diga que telefonos se
         * actualizan solos y cuales necesitan a alguien en sitio.
         */
        fun estadoAutoActualizacion(ctx: Context): AutoActualizacion {
            val pm = ctx.packageManager
            val instalador = try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
                    pm.getInstallSourceInfo(ctx.packageName).installingPackageName
                else @Suppress("DEPRECATION") pm.getInstallerPackageName(ctx.packageName)
            } catch (e: Exception) { null }
            val dueno = try {
                if (Build.VERSION.SDK_INT >= 34) pm.getInstallSourceInfo(ctx.packageName).updateOwnerPackageName else null
            } catch (e: Exception) { null }
            val permiso = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                ctx.checkSelfPermission("android.permission.UPDATE_PACKAGES_WITHOUT_USER_ACTION") ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
            val puedeInstalar = try { pm.canRequestPackageInstalls() } catch (e: Exception) { false }
            val motivo = decidir(esDeviceOwner(ctx), Build.VERSION.SDK_INT, permiso, puedeInstalar, dueno, ctx.packageName)
            return AutoActualizacion(motivo, instalador, Build.VERSION.SDK_INT)
        }

        /**
         * Las reglas de Android para instalar SIN confirmacion, en orden. Puro
         * (sin Android) para poder probarlo. "sola" y "kiosco" son las buenas.
         */
        fun decidir(
            deviceOwner: Boolean,
            sdk: Int,
            permisoSinToque: Boolean,
            puedeInstalar: Boolean,
            duenoDeActualizaciones: String?,
            paquete: String,
        ): String = when {
            deviceOwner -> "kiosco"
            // Antes de Android 12 no existe la instalacion sin toque fuera de kiosco.
            sdk < 31 -> "android_viejo"
            // La version instalada no declara el permiso (las anteriores a 0.16.4).
            !permisoSinToque -> "sin_permiso"
            // "Instalar apps desconocidas" apagado para Space Eye en Ajustes.
            !puedeInstalar -> "sin_instalar_apps"
            // Android 14: si otra tienda se quedo con las actualizaciones, pide toque.
            duenoDeActualizaciones != null && duenoDeActualizaciones != paquete -> "otro_dueno"
            else -> "sola"
        }

        /** Si es device owner, puede instalar sin que nadie toque la pantalla. */
        fun esDeviceOwner(ctx: Context): Boolean = try {
            val dpm = ctx.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            dpm.isDeviceOwnerApp(ctx.packageName)
        } catch (e: Exception) {
            false
        }
    }

    /** motivo: "kiosco" | "sola" | "android_viejo" | "sin_permiso" | "sin_instalar_apps" | "otro_dueno". */
    data class AutoActualizacion(val motivo: String, val instalador: String?, val sdk: Int) {
        val sola: Boolean get() = motivo == "kiosco" || motivo == "sola"
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
