package com.spaceeye.agent.service

import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import com.spaceeye.agent.MainActivity
import com.spaceeye.agent.network.ApiClient
import com.spaceeye.agent.network.RemoteLog
import com.spaceeye.agent.network.SocketManager
import com.spaceeye.agent.telemetry.DeviceStatusCollector
import com.spaceeye.agent.commands.CommandHandler
import com.spaceeye.agent.pantalla.Monitor
import kotlinx.coroutines.*

class MonitorService : Service() {

    companion object {
        private const val TAG = "MonitorService"
        const val CHANNEL = "monitor_channel"
        const val NOTIF_ID = 1001

        @Volatile
        private var instance: MonitorService? = null

        fun start(ctx: Context) {
            val intent = Intent(ctx, MonitorService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }

        /**
         * Pide el tipo de FGS "camera". UNA VEZ OBTENIDO YA NO SE SUELTA.
         *
         * Android 14 solo concede la camara a un servicio si la pide mientras la app
         * esta EN PANTALLA; desde segundo plano la niega ("the app must be in the
         * eligible state"). Antes se soltaba tras cada foto y se volvia a pedir en
         * la siguiente: la primera vez salia (alguien tenia la app abierta) y
         * despues, ya en segundo plano, Android la negaba y la camara quedaba
         * "disabled by policy". En el telefono de pruebas eso dejo la vigilancia
         * ciega del 25 al 28-sep, sin que el dashboard lo dijera.
         *
         * Por eso: se pide al abrir la app (MainActivity.onResume) y en cada uso, y
         * `false` ya no la suelta. Tenerla declarada sin usarla no enciende la
         * camara ni el indicador verde: eso solo pasa cuando de verdad se abre.
         *
         * El servicio persistente arranca sin ella (dataSync), porque Android 14
         * prohibe arrancar un FGS camera desde segundo plano (causaba crash-loop).
         * Tras un reinicio del telefono hay que abrir la app una vez, salvo que sea
         * dueña del dispositivo (device owner), que esta exenta.
         */
        fun setCameraActive(active: Boolean) {
            if (!active) return
            instance?.updateForegroundType(true)
        }

        /**
         * Si el servicio logro declararse "en uso de camara".
         *
         * Importa para diagnosticar a distancia: si esto es false, Android niega
         * la camara a una app en segundo plano por diseno, y el sintoma es
         * identico a un bloqueo del sistema. Hasta ahora ese dato solo existia
         * en el log interno del telefono, que es justo lo que no se puede leer
         * desde el dashboard.
         */
        fun camaraDeclarada(): Boolean = instance?.cameraTypeActive ?: false
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var wakeLock: PowerManager.WakeLock? = null
    private var notifText = "Iniciando..."
    private var cameraTypeActive = false
    private var ultimoAvisoCamara = 0L
    private lateinit var socketManager: SocketManager
    private lateinit var statusCollector: DeviceStatusCollector
    private lateinit var commandHandler: CommandHandler
    private lateinit var apiClient: ApiClient
    private lateinit var vigilante: Monitor

    override fun onCreate() {
        super.onCreate()
        instance = this
        // Arranca SIN tipo camera (dataSync|location) para poder reiniciarse desde
        // background sin la SecurityException de Android 14.
        startForegroundWithType(camera = false)

        // WakeLock parcial: mantiene la CPU activa con la pantalla apagada/bloqueada
        // para que el heartbeat, los comandos y las capturas sigan funcionando.
        try {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SpaceEye::Monitor").apply {
                setReferenceCounted(false)
                acquire()
            }
        } catch (e: Exception) {
            Log.w(TAG, "wakelock: ${e.message}")
        }

        RemoteLog.info(applicationContext, "service", "MonitorService iniciado")
        // Re-arma el latido de auto-recuperacion por si se perdio.
        com.spaceeye.agent.SpaceEyeApp.scheduleHeartbeat(applicationContext)

        socketManager = SocketManager(applicationContext)
        statusCollector = DeviceStatusCollector(applicationContext)
        commandHandler = CommandHandler(applicationContext, scope, socketManager)
        apiClient = ApiClient(applicationContext)

        socketManager.onCommand = { cmd -> commandHandler.handle(cmd) }
        socketManager.onCameraControl = { control -> commandHandler.handleCameraControl(control) }
        socketManager.connect()

        // Vigilancia de la pantalla (creativos y fallas): en su propio bucle,
        // porque una vuelta dura minutos y no puede frenar el latido. Si esta
        // apagada en el dashboard solo pregunta una vez por hora.
        vigilante = Monitor(applicationContext, apiClient, commandHandler)
        scope.launch { vigilante.correr() }

        // Heartbeat loop: collect status and report to backend every 60s
        scope.launch {
            while (isActive) {
                try {
                    // Sin llave (el servidor rechazo la anterior): darse de alta otra
                    // vez y reconectar el canal de ordenes con la llave nueva.
                    reAltaSiHaceFalta()
                    val status = statusCollector.collect()
                    updateNotification("Online · Bateria ${status.batteryPct}%")

                    // Report status via HTTP to backend. El resumen de la ultima
                    // vuelta de vigilancia viaja pegado aqui; si el reporte no
                    // sale, se guarda para el siguiente en vez de perderse.
                    val resumen = vigilante.tomarPendiente()
                    val ok = withContext(Dispatchers.IO) {
                        apiClient.reportStatus(status, resumen)
                    }
                    if (!ok && resumen != null) vigilante.devolver(resumen)
                    // Si el servidor acaba de rechazar la llave, se da de alta ya y
                    // no hasta el siguiente latido.
                    reAltaSiHaceFalta()
                } catch (e: Exception) {
                    Log.e(TAG, "Heartbeat error: ${e.message}")
                    updateNotification("Reintentando...")
                }
                delay(60_000)
            }
        }
    }

    /** Sin llave valida: darse de alta otra vez y reconectar el canal de ordenes. */
    private suspend fun reAltaSiHaceFalta() {
        if (apiClient.tieneLlave()) return
        val ok = withContext(Dispatchers.IO) { apiClient.registrar() }
        if (ok) {
            RemoteLog.info(applicationContext, "service", "Equipo dado de alta de nuevo en el servidor")
            socketManager.disconnect()
            socketManager.connect()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY
    override fun onBind(intent: Intent?): IBinder? = null

    // Si el usuario quita la app de "recientes", el sistema mata el servicio.
    // Agendamos un reinicio para mantener el servicio activo (operacion desatendida).
    override fun onTaskRemoved(rootIntent: Intent?) {
        RemoteLog.warn(applicationContext, "service", "App quitada de recientes — reprogramando reinicio")
        com.spaceeye.agent.SpaceEyeApp.scheduleRestart(applicationContext, 1500L)
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        instance = null
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {}
        scope.cancel()
        socketManager.disconnect()
        // Al destruirse, agenda un reinicio para maximizar la disponibilidad.
        com.spaceeye.agent.SpaceEyeApp.scheduleRestart(applicationContext, 2000L)
        super.onDestroy()
    }

    /**
     * (Re)entra en primer plano con los tipos adecuados. Sin `camera` el arranque
     * funciona desde background; con `camera` habilita el acceso a la camara para
     * transmitir/capturar. Best-effort: si Android lo rechaza, cae a dataSync.
     */
    private fun startForegroundWithType(camera: Boolean) {
        cameraTypeActive = camera
        val notif = buildNotification(notifText)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Base = dataSync (NO es un tipo "while-in-use", asi que si se puede
            // arrancar desde background en Android 14). camera se agrega solo al
            // transmitir/capturar, cuando el servicio ya esta en primer plano.
            var type = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            if (camera) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
            try {
                startForeground(NOTIF_ID, notif, type)
            } catch (e: Exception) {
                Log.w(TAG, "startForeground(type=$type) fallo: ${e.message}")
                // Que esto no se quede solo en el logcat del telefono: si la
                // promocion a "camara" falla, TODAS las capturas van a fallar
                // despues y sin este aviso el motivo era invisible a distancia.
                if (camera) {
                    cameraTypeActive = false
                    // Una vez por hora: en modo continuo se reintenta en cada vuelta y
                    // repetir el aviso cada 4 minutos solo gastaria datos.
                    val ahora = System.currentTimeMillis()
                    if (ahora - ultimoAvisoCamara > 60 * 60_000L) RemoteLog.warn(
                        applicationContext, "camera",
                        "El servicio no pudo declararse en uso de camara (${e.message}); Android va a negar las capturas en segundo plano. Abre la app en el celular una vez para concederla"
                    ).also { ultimoAvisoCamara = ahora }
                }
                try {
                    startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
                } catch (_: Exception) {}
            }
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    fun updateForegroundType(camera: Boolean) {
        if (camera == cameraTypeActive) return
        try {
            startForegroundWithType(camera)
        } catch (e: Exception) {
            Log.w(TAG, "updateForegroundType($camera): ${e.message}")
        }
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
        notifText = text
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, buildNotification(text))
    }
}
