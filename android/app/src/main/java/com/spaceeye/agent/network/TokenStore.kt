// TokenStore.kt — Encrypted token storage
package com.spaceeye.agent.network

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.spaceeye.agent.BuildConfig
import com.spaceeye.agent.vinculacion.Vinculacion

class TokenStore(private val ctx: Context) {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(ctx)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            ctx, "space_eye_secure",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * El servidor al que habla este telefono, o null si es nuevo y hay que
     * vincularlo (ver Vinculacion.decidirServidor).
     *
     * Un equipo de la flota anterior a la 0.16.0 no tiene "servidor" guardado pero
     * si su llave: se le anota aqui, una sola vez, el servidor compilado. Desde
     * entonces queda fijo aunque la llave se olvide por un 401, para que la re-alta
     * vaya al mismo lugar y el telefono no caiga en la pantalla de vincular.
     */
    fun servidorActivo(): String? {
        val guardado = prefs.getString("servidor", null)
        val elegido = Vinculacion.decidirServidor(
            guardado, guardado == null && yaFuncionabaAntes(), BuildConfig.SERVER_URL
        )
        if (guardado == null && elegido != null) prefs.edit().putString("servidor", elegido).apply()
        return elegido
    }

    /**
     * Si el telefono ya trabajaba con una version anterior. La llave es la senal
     * principal, pero un 401 la borra y la re-alta pudo no haber salido aun justo
     * cuando llego la actualizacion: entonces se reconoce por lo que el servicio
     * deja al correr (la carpeta de vigilancia y el registro de consumo de datos),
     * que un telefono recien instalado no tiene porque el servicio no arranca
     * hasta vincularse. Asi ningun equipo de la flota cae en la pantalla de
     * vincular, que obligaria a ir a sitio.
     */
    private fun yaFuncionabaAntes(): Boolean =
        prefs.contains("device_token") ||
            java.io.File(ctx.filesDir, "pantalla").exists() ||
            java.io.File(ctx.filesDir.parentFile, "shared_prefs/space_eye_data_usage.xml").exists()

    /** Vinculacion exitosa: servidor y llave se guardan juntos, nunca uno sin el otro. */
    fun guardarVinculacion(servidor: String, token: String) {
        prefs.edit().putString("servidor", servidor)
            .putString("device_token", token)
            .putString("device_token_server", servidor).commit()
    }

    fun saveDeviceToken(token: String) {
        // Se anota de que servidor es: si el equipo se vincula a otra instancia, no
        // debe presentarse alli con la llave de la anterior.
        prefs.edit().putString("device_token", token)
            .putString("device_token_server", servidorActivo()).apply()
    }

    fun getDeviceToken(): String? {
        val activo = servidorActivo() ?: return null
        val servidor = prefs.getString("device_token_server", null)
        if (servidor != null && servidor != activo) return null
        return prefs.getString("device_token", null)
    }

    /**
     * El servidor ya no reconoce la llave: se olvida para darse de alta otra vez.
     * El servidor NO se olvida: la re-alta va al mismo (sin codigo, el equipo ya
     * es conocido alli).
     */
    fun clearDeviceToken() {
        prefs.edit().remove("device_token").remove("device_token_server").apply()
    }

    fun saveDeviceUid(uid: String) {
        prefs.edit().putString("device_uid", uid).apply()
    }

    @android.annotation.SuppressLint("HardwareIds")
    fun getOrCreateDeviceUid(): String {
        // ANDROID_ID es estable entre reinstalaciones (mismo equipo + firma de la
        // app), asi el dispositivo NO se duplica al reinstalar. Fallback: UUID.
        val androidId = try {
            android.provider.Settings.Secure.getString(
                ctx.contentResolver, android.provider.Settings.Secure.ANDROID_ID
            )
        } catch (_: Exception) { null }
        if (!androidId.isNullOrBlank() && androidId.length >= 8 && androidId != "9774d56d682e549c") {
            return "android-$androidId"
        }
        val existing = prefs.getString("device_uid", null)
        if (existing != null) return existing
        val uid = java.util.UUID.randomUUID().toString().replace("-", "")
        saveDeviceUid(uid)
        return uid
    }
}
