// ScheduleManager.kt — WorkManager-based schedule execution
package com.spaceeye.agent.scheduler

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class ScheduleManager(private val ctx: Context) {

    fun schedulePeriodicCapture(intervalMinutes: Long) {
        val request = PeriodicWorkRequestBuilder<CaptureWorker>(
            intervalMinutes, TimeUnit.MINUTES,
            5, TimeUnit.MINUTES // flex interval
        )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .addTag("periodic_capture")
            .build()

        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
            "space_eye_capture",
            ExistingPeriodicWorkPolicy.REPLACE,
            request
        )
    }

    fun cancelAll() {
        WorkManager.getInstance(ctx).cancelAllWorkByTag("periodic_capture")
    }
}

class CaptureWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            // Trigger photo capture via MonitorService
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
