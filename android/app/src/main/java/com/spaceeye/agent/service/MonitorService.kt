package com.spaceeye.agent.service

import android.app.*
import android.content.*
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import com.spaceeye.agent.MainActivity
import com.spaceeye.agent.network.ApiClient
import com.spaceeye.agent.network.SocketManager
import com.spaceeye.agent.telemetry.DeviceStatusCollector
import com.spaceeye.agent.commands.CommandHandler
import kotlinx.coroutines.*

class MonitorService : Service() {

    companion object {
        private const val TAG = "MonitorService"
        const val CHANNEL = "monitor_channel"
        const val NOTIF_ID = 1001

        fun start(ctx: Context) {
            val intent = Intent(ctx, MonitorService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var socketManager: SocketManager
    private lateinit var statusCollector: DeviceStatusCollector
    private lateinit var commandHandler: CommandHandler
    private lateinit var apiClient: ApiClient

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIF_ID, buildNotification("Iniciando..."))

        socketManager = SocketManager(applicationContext)
        statusCollector = DeviceStatusCollector(applicationContext)
        commandHandler = CommandHandler(applicationContext, scope, socketManager)
        apiClient = ApiClient(applicationContext)

        socketManager.onCommand = { cmd -> commandHandler.handle(cmd) }
        socketManager.connect()

        // Heartbeat loop: collect status and report to backend every 60s
        scope.launch {
            while (isActive) {
                try {
                    val status = statusCollector.collect()
                    updateNotification("Online · Bateria ${status.batteryPct}%")

                    // Report status via HTTP to backend
                    withContext(Dispatchers.IO) {
                        apiClient.reportStatus(status)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Heartbeat error: ${e.message}")
                    updateNotification("Reintentando...")
                }
                delay(60_000)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        socketManager.disconnect()
        super.onDestroy()
    }

    private fun buildNotification(text: String): Notification {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "Monitor", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val pi = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle("SPACE EYE")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, buildNotification(text))
    }
}
