// TokenStore.kt — Encrypted token storage
package com.spaceeye.agent.network

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

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

    fun saveDeviceToken(token: String) {
        prefs.edit().putString("device_token", token).apply()
    }

    fun getDeviceToken(): String? = prefs.getString("device_token", null)

    fun saveDeviceUid(uid: String) {
        prefs.edit().putString("device_uid", uid).apply()
    }

    fun getOrCreateDeviceUid(): String {
        val existing = prefs.getString("device_uid", null)
        if (existing != null) return existing
        val uid = java.util.UUID.randomUUID().toString().replace("-", "")
        saveDeviceUid(uid)
        return uid
    }
}
