package com.spaceeye.agent.service

import android.content.Context
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.spaceeye.agent.network.TokenStore
import java.util.concurrent.TimeUnit

/**
 * Watchdog: cada ~15 min (minimo que permite WorkManager) verifica que el
 * servicio deba estar corriendo y lo reactiva. WorkManager persiste sus tareas
 * a traves de reinicios y muertes del proceso, por lo que es una red de
 * seguridad robusta para operacion desatendida.
 *
 * Limitacion: en Android 12+ arrancar un foreground service desde segundo plano
 * puede lanzar ForegroundServiceStartNotAllowedException; se captura y se
 * depende del reinicio por START_STICKY / boot. Ver docs/ANDROID_RESILIENCE.md.
 */
class WatchdogWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {

    override fun doWork(): Result {
        if (TokenStore(applicationContext).getDeviceToken() != null) {
            try {
                MonitorService.start(applicationContext)
            } catch (e: Exception) {
                Log.w(TAG, "No se pudo (re)iniciar el servicio desde el watchdog: ${e.message}")
            }
        }
        return Result.success()
    }

    companion object {
        private const val TAG = "WatchdogWorker"
        private const val NAME = "space_eye_watchdog"

        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<WatchdogWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(ctx)
                .enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
