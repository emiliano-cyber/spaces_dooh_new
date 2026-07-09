// MainActivity.kt — Entry point, checks pairing and starts service
package com.spaceeye.agent

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
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
