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
import com.spaceeye.agent.network.TokenStore
import com.spaceeye.agent.service.MonitorService

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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
                MainScreen()
            }
        }

        requestBatteryExemption()
    }

    override fun onResume() {
        super.onResume()
        enableKioskIfProvisioned()
    }

    private fun checkAndStart() {
        val tokenStore = TokenStore(this)
        val token = tokenStore.getDeviceToken()
        if (token != null) {
            MonitorService.start(this)
        } else {
            // Sin token: primera ejecucion -> registrar el device (SetupActivity
            // hace el POST /api/device/register y arranca MonitorService al terminar).
            startActivity(Intent(this, SetupActivity::class.java))
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
        }
    }
}
