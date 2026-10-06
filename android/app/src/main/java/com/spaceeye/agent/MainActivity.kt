// MainActivity.kt — Entry point, checks pairing and starts service
package com.spaceeye.agent

import android.Manifest
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import com.spaceeye.agent.network.RemoteLog
import com.spaceeye.agent.service.KioskAdminReceiver
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.spaceeye.agent.network.ApiClient
import com.spaceeye.agent.network.TokenStore
import com.spaceeye.agent.service.MonitorService
import com.spaceeye.agent.vinculacion.PantallaVincular
import com.spaceeye.agent.vinculacion.Vinculacion
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {

    private val permissions = arrayOf(
        Manifest.permission.CAMERA,
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
    )

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        if (results.values.all { it }) {
            checkAndStart()
        }
    }

    // Telefono nuevo (sin servidor): en vez del agente se muestra la pantalla de
    // vincular. Ver TokenStore.servidorActivo.
    private var necesitaVincular by mutableStateOf(false)
    private var avisoVincular by mutableStateOf<String?>(null)
    private var enlace by mutableStateOf<Vinculacion.Datos?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        necesitaVincular = TokenStore(this).servidorActivo() == null
        leerEnlace(intent)

        // Permite que la app se muestre y encienda la pantalla aun bloqueada
        // (util para kiosco / recuperacion desatendida).
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        if (permissions.all { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }) {
            checkAndStart()
        } else {
            permissionLauncher.launch(permissions)
        }

        setContent {
            MaterialTheme {
                if (necesitaVincular) {
                    PantallaVincular(enlace, avisoVincular, BuildConfig.VERSION_NAME) { servidor, codigo ->
                        vincular(servidor, codigo)
                    }
                } else {
                    MainScreen()
                }
            }
        }

        requestBatteryExemption()
    }

    override fun onResume() {
        super.onResume()
        enableKioskIfProvisioned()
        // Con la app en pantalla es el UNICO momento en que Android 14 concede la
        // camara al servicio para usarla despues en segundo plano. Ver
        // MonitorService.setCameraActive.
        MonitorService.setCameraActive(true)
        // Si el servicio apenas esta arrancando, todavia no existe: se repite en
        // un momento, con la app aun en pantalla.
        window.decorView.postDelayed({ MonitorService.setCameraActive(true) }, 2000)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        leerEnlace(intent)
    }

    /**
     * La app se abrio con el enlace del QR (spaceeye://vincular?...), p. ej. desde
     * la camara normal del telefono. Solo se usa si el telefono aun no esta
     * vinculado: un enlace cualquiera no debe poder mudar a otro servidor un
     * equipo que ya trabaja.
     */
    private fun leerEnlace(intent: Intent?) {
        val texto = intent?.data?.toString() ?: return
        val datos = Vinculacion.leerEnlace(texto)
        when {
            !necesitaVincular -> Log.w("MainActivity", "enlace de vinculacion ignorado: el telefono ya esta vinculado")
            datos == null -> avisoVincular = "Ese enlace no es un código válido de SPACE OS."
            else -> enlace = datos
        }
    }

    /** Alta con el codigo de SPACE OS. null si salio bien; si no, que decirle al instalador. */
    private suspend fun vincular(servidor: String, codigo: String): String? {
        val r = withContext(Dispatchers.IO) { ApiClient(applicationContext).vincular(servidor, codigo) }
        if (r == ApiClient.Alta.LISTO) {
            RemoteLog.info(applicationContext, "service", "Telefono vinculado a $servidor")
            necesitaVincular = false
            avisoVincular = null
            enlace = null
            arrancarServicio()
            return null
        }
        return when (r) {
            ApiClient.Alta.CODIGO_INVALIDO ->
                "El código no sirve (venció, ya se usó o se canceló). Genera otro en SPACE OS."
            ApiClient.Alta.VINCULACION_REQUERIDA ->
                "El servidor pide un código de vinculación. Genera uno en SPACE OS."
            ApiClient.Alta.DEMASIADOS_INTENTOS ->
                "Demasiados intentos seguidos. Espera unos minutos y vuelve a intentar."
            ApiClient.Alta.SIN_HTTPS ->
                "La dirección del servidor debe empezar con https://"
            ApiClient.Alta.SIN_RED ->
                "No se pudo conectar con el servidor. Revisa que el teléfono tenga internet y la dirección del servidor, y vuelve a intentar."
            else -> "El servidor no pudo vincular el teléfono. Vuelve a intentar en un momento."
        }
    }

    private fun arrancarServicio() {
        MonitorService.start(this)
        // Igual que en onResume: con la app en pantalla Android concede la camara
        // al servicio, que apenas esta arrancando.
        window.decorView.postDelayed({ MonitorService.setCameraActive(true) }, 2000)
    }

    private fun checkAndStart() {
        val tokenStore = TokenStore(this)
        if (tokenStore.servidorActivo() == null) {
            necesitaVincular = true
            return
        }
        if (tokenStore.getDeviceToken() != null) {
            MonitorService.start(this)
            return
        }
        // Tiene servidor pero no llave (el servidor la rechazo): re-alta sin
        // codigo, el equipo ya es conocido alli. Antes lo hacia SetupActivity.
        lifecycleScope.launch {
            val r = withContext(Dispatchers.IO) { ApiClient(applicationContext).alta() }
            when (r) {
                ApiClient.Alta.CODIGO_INVALIDO, ApiClient.Alta.VINCULACION_REQUERIDA -> {
                    // Lo borraron del servidor: sin un codigo nuevo no hay manera.
                    avisoVincular = "El servidor ya no reconoce este teléfono. Vincúlalo de nuevo con un código de SPACE OS."
                    necesitaVincular = true
                }
                // Listo, o sin red: el servicio reintenta la alta en cada latido.
                else -> MonitorService.start(applicationContext)
            }
        }
    }

    /** Pide excluir la app de la optimizacion de bateria (clave para no morir en Doze). */
    private fun requestBatteryExemption() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                startActivity(
                    Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:$packageName")
                    )
                )
            }
        } catch (e: Exception) {
            Log.w("MainActivity", "battery exemption: ${e.message}")
        }
    }

    /**
     * Activa el modo kiosco (Lock Task) SOLO si el equipo fue aprovisionado como
     * device owner (kiosco real, sin salida). Si no lo esta, no hace nada, para
     * no molestar con el "screen pinning" debil. Ver docs/ANDROID_RESILIENCE.md.
     */
    private fun enableKioskIfProvisioned() {
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (dpm.isDeviceOwnerApp(packageName)) {
                val admin = ComponentName(this, KioskAdminReceiver::class.java)
                dpm.setLockTaskPackages(admin, arrayOf(packageName))
            }
            if (dpm.isLockTaskPermitted(packageName)) {
                val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                if (am.lockTaskModeState == ActivityManager.LOCK_TASK_MODE_NONE) {
                    startLockTask()
                }
            }
        } catch (e: Exception) {
            Log.w("MainActivity", "kiosk: ${e.message}")
        }
    }
}

@Composable
fun MainScreen() {
    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("SPACE EYE", style = MaterialTheme.typography.headlineMedium)
            Spacer(modifier = Modifier.height(8.dp))
            Text("Agente de monitoreo activo", style = MaterialTheme.typography.bodyMedium)
            Spacer(modifier = Modifier.height(4.dp))
            Text("v${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.bodySmall)
        }
    }
}
