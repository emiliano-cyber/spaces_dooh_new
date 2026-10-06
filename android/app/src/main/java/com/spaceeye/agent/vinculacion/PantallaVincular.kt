// PantallaVincular.kt — Primera pantalla de un telefono nuevo: escanear o teclear el codigo de SPACE OS
package com.spaceeye.agent.vinculacion

import android.Manifest
import android.content.pm.PackageManager
import android.util.Size
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.ReaderException
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

/**
 * Para instaladores, no para tecnicos: un boton para escanear el QR que muestra
 * SPACE OS y, si la camara no ayuda, el codigo tecleado. La direccion del
 * servidor solo hace falta al teclear; el QR ya la trae.
 *
 * @param enlace   datos que llegaron por el enlace spaceeye:// (la camara normal
 *                 del telefono abrio la app con el QR): se vincula de inmediato.
 * @param aviso    mensaje con que se abre la pantalla (p. ej. el servidor ya no
 *                 reconoce al telefono).
 * @param vincular hace el alta; devuelve null si salio bien o el mensaje de error.
 */
@Composable
fun PantallaVincular(
    enlace: Vinculacion.Datos?,
    aviso: String?,
    version: String,
    vincular: suspend (servidor: String, codigo: String) -> String?,
) {
    val ctx = LocalContext.current
    val alcance = rememberCoroutineScope()
    var codigo by remember { mutableStateOf("") }
    var servidor by remember { mutableStateOf("") }
    var escaneando by remember { mutableStateOf(false) }
    var trabajando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(aviso) }

    fun intentar(datos: Vinculacion.Datos) {
        if (trabajando) return
        codigo = Vinculacion.formatearCodigo(datos.codigo)
        servidor = datos.servidor
        trabajando = true
        error = null
        alcance.launch {
            error = vincular(datos.servidor, datos.codigo)
            trabajando = false
        }
    }

    fun intentarTecleado() {
        // Si pegaron el enlace completo en el campo del codigo, tambien sirve.
        Vinculacion.leerEnlace(codigo)?.let { intentar(it); return }
        val c = Vinculacion.normalizarCodigo(codigo)
        if (c == null) {
            error = "El código debe tener 8 letras y números, como ABCD-2345."
            return
        }
        val s = Vinculacion.normalizarServidor(servidor)
        if (s == null) {
            error = "Escribe la dirección del servidor (aparece en SPACE OS junto al código)."
            return
        }
        intentar(Vinculacion.Datos(s, c))
    }

    LaunchedEffect(enlace) { enlace?.let { intentar(it) } }

    val pedirCamara = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) escaneando = true
        else error = "Sin permiso de cámara no se puede escanear. Escribe el código abajo."
    }

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.verticalScroll(rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Vincular este teléfono", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(8.dp))
            Text(
                "En SPACE OS entra a \"Agregar dispositivo\" y escanea el código QR que aparece.",
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(Modifier.height(16.dp))

            if (escaneando) {
                EscanerQr(
                    modifier = Modifier.fillMaxWidth().height(320.dp),
                    alLeer = { texto ->
                        escaneando = false
                        val datos = Vinculacion.leerEnlace(texto)
                        if (datos == null) error = "Ese código QR no es de SPACE OS. Escanea el que aparece en \"Agregar dispositivo\"."
                        else intentar(datos)
                    },
                )
                Spacer(Modifier.height(8.dp))
                Text("Apunta la cámara al código QR", style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = { escaneando = false }, modifier = Modifier.fillMaxWidth()) {
                    Text("Cancelar")
                }
            } else {
                Button(
                    onClick = {
                        error = null
                        val permitido = ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) ==
                            PackageManager.PERMISSION_GRANTED
                        if (permitido) escaneando = true else pedirCamara.launch(Manifest.permission.CAMERA)
                    },
                    enabled = !trabajando,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Escanear código QR") }
            }

            Spacer(Modifier.height(24.dp))
            Text("o escribe el código", style = MaterialTheme.typography.titleSmall)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = codigo,
                onValueChange = { codigo = it },
                label = { Text("Código (ej. ABCD-2345)") },
                singleLine = true,
                enabled = !trabajando,
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Characters,
                    keyboardType = KeyboardType.Ascii,
                    imeAction = ImeAction.Next,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = servidor,
                onValueChange = { servidor = it },
                label = { Text("Dirección del servidor") },
                placeholder = { Text("eyes.tuempresa.com") },
                singleLine = true,
                enabled = !trabajando,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Done),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { intentarTecleado() },
                enabled = !trabajando,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Vincular") }

            Spacer(Modifier.height(16.dp))
            if (trabajando) {
                CircularProgressIndicator()
                Spacer(Modifier.height(8.dp))
                Text("Vinculando…", style = MaterialTheme.typography.bodyMedium)
            }
            error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyLarge)
            }
            Spacer(Modifier.height(24.dp))
            Text("v$version", style = MaterialTheme.typography.bodySmall)
        }
    }
}

/**
 * Vista previa + lectura del QR con CameraX. La camara se suelta en cuanto se
 * lee un codigo (antes de avisar) y al salir de la pantalla: el servicio de
 * monitoreo, que es el dueño de la camara en el resto de la vida del equipo,
 * arranca hasta despues de vincular y la encuentra libre.
 */
@Composable
private fun EscanerQr(modifier: Modifier, alLeer: (String) -> Unit) {
    val ctx = LocalContext.current
    val dueno = LocalLifecycleOwner.current
    val alLeerActual by rememberUpdatedState(alLeer)
    val vista = remember { PreviewView(ctx) }

    DisposableEffect(dueno) {
        val hilo = Executors.newSingleThreadExecutor()
        val principal = ContextCompat.getMainExecutor(ctx)
        val futuro = ProcessCameraProvider.getInstance(ctx)
        var proveedor: ProcessCameraProvider? = null
        val previa = Preview.Builder().build()
        @Suppress("DEPRECATION")
        val analisis = ImageAnalysis.Builder()
            .setTargetResolution(Size(1280, 720))
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
        var soltada = false
        fun soltar() {
            if (soltada) return
            soltada = true
            try { proveedor?.unbind(previa, analisis) } catch (_: Exception) {}
        }

        analisis.setAnalyzer(hilo, LectorQr { texto ->
            principal.execute {
                if (soltada) return@execute
                soltar()
                alLeerActual(texto)
            }
        })
        futuro.addListener({
            if (soltada) return@addListener
            try {
                val p = futuro.get()
                proveedor = p
                previa.setSurfaceProvider(vista.surfaceProvider)
                p.bindToLifecycle(dueno, CameraSelector.DEFAULT_BACK_CAMERA, previa, analisis)
            } catch (e: Exception) {
                android.util.Log.e("PantallaVincular", "no se pudo abrir la camara: ${e.message}")
            }
        }, principal)

        onDispose {
            soltar()
            analisis.clearAnalyzer()
            hilo.shutdown()
        }
    }

    AndroidView(factory = { vista }, modifier = modifier)
}

/** Busca un QR en cada cuadro (solo el plano de brillo, que es lo que lee ZXing). */
private class LectorQr(private val alLeer: (String) -> Unit) : ImageAnalysis.Analyzer {
    private val lector = QRCodeReader()
    private val pistas = mapOf(
        DecodeHintType.TRY_HARDER to true,
        DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE),
    )
    @Volatile private var leido = false

    override fun analyze(imagen: ImageProxy) {
        try {
            if (leido) return
            val plano = imagen.planes[0]
            val buffer = plano.buffer.apply { rewind() }
            val paso = plano.rowStride
            val alto = imagen.height
            // El renglon puede venir con relleno (rowStride > ancho): se copia tal
            // cual y se le dice a ZXing el ancho real del recorte.
            val datos = ByteArray(paso * alto)
            buffer.get(datos, 0, minOf(buffer.remaining(), datos.size))
            val fuente = PlanarYUVLuminanceSource(datos, paso, alto, 0, 0, imagen.width, alto, false)
            val texto = try {
                lector.decode(BinaryBitmap(HybridBinarizer(fuente)), pistas).text
            } catch (_: ReaderException) {
                null
            } finally {
                lector.reset()
            }
            if (texto != null) {
                leido = true
                alLeer(texto)
            }
        } catch (e: Exception) {
            android.util.Log.w("PantallaVincular", "cuadro no leido: ${e.message}")
        } finally {
            imagen.close()
        }
    }
}
