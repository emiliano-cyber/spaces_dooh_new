package com.spaceeye.agent.network

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.hardware.camera2.CaptureRequest
import android.media.ExifInterface
import android.util.Log
import android.util.Size
import android.view.Surface
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import androidx.annotation.OptIn
import androidx.camera.camera2.interop.Camera2CameraControl
import androidx.camera.camera2.interop.CaptureRequestOptions
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.Camera
import androidx.camera.core.CameraControl
import androidx.camera.core.CameraInfo
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import android.os.Handler
import android.os.Looper
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.SurfaceOrientedMeteringPointFactory
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import org.json.JSONObject
import org.webrtc.*

/**
 * Streaming WebRTC alimentado por CameraX.
 *
 * A diferencia del capturador de org.webrtc (caja negra), CameraX expone un
 * CameraControl, lo que permite el modulo de control manual: zoom, enfoque por
 * toque, bloqueo de foco, exposicion y balance de blancos. Los frames de CameraX
 * se puentean a WebRTC via un SurfaceTextureHelper.
 */
class WebRTCClient(private val ctx: Context) : LifecycleOwner {

    companion object {
        private const val TAG = "WebRTCClient"
        // La foto se captura en ROTATION_0 (pixeles crudos del sensor = lo que
        // muestra el stream), asi que no se necesita correccion de base. Solo se
        // aplica la rotacion manual del visor encima.
        private const val PHOTO_ROTATION_CORRECTION = 0
        private val ICE_SERVERS = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
        )
    }

    // LifecycleOwner propio para poder usar CameraX desde un Service.
    private val lifecycleRegistry = LifecycleRegistry(this)
    override val lifecycle: Lifecycle get() = lifecycleRegistry

    private var factory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var eglBase: EglBase? = null

    // CameraX
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var cameraControl: CameraControl? = null
    private var cameraInfo: CameraInfo? = null
    private var previewSurface: Surface? = null
    private var imageCapture: ImageCapture? = null

    private var socketEmitter: ((String, JSONObject) -> Unit)? = null
    private var currentSessionId: String? = null

    // --- Diagnostico de la señalizacion -------------------------------------
    //
    // Todo lo de aqui abajo SOLO OBSERVA Y REPORTA: no cambia el orden ni las
    // condiciones de la negociacion. Existe porque MAGNOCENTRO (21-ago-2026) se
    // quedo sin vista en vivo y desde el servidor era imposible saber por que: la
    // app abria la camara y despues callaba. Los fallos de esta parte se
    // escribian solo en el logcat del telefono, que en un sitio en la calle no
    // lee nadie. Y dos caminos -el `?.invoke` del emisor- ni siquiera eso.
    //
    // RemoteLog viaja por HTTP con el token del equipo, o sea que llega al
    // dashboard AUNQUE el canal de señalizacion este roto, que es justo el caso
    // que hay que diagnosticar.
    // @Volatile no es adorno: los candidatos llegan por el hilo de señalizacion de
    // WebRTC y el parte se lee desde el hilo principal. Sin esto el parte podria
    // no ver el contador ya incrementado y acusar de fallo a un equipo que esta
    // transmitiendo perfectamente -justo el ruido que no queremos introducir.
    @Volatile private var ofertaEnviada = false
    @Volatile private var candidatosEnviados = 0
    private val vigilante = Handler(Looper.getMainLooper())
    private var reporteProgramado: Runnable? = null

    // Cuanto se espera antes de dar el parte. Los candidatos host salen en
    // milisegundos; los relay por TURN pueden tardar unos segundos.
    private val ESPERA_DIAGNOSTICO_MS = 12000L

    /**
     * Manda un evento por el canal de señalizacion, o deja constancia de que no
     * se pudo. Antes era `socketEmitter?.invoke(...)`: si el emisor era nulo, la
     * oferta o el candidato se perdian en silencio absoluto.
     */
    private fun emitirSeñal(evento: String, datos: JSONObject) {
        val emisor = socketEmitter
        if (emisor == null) {
            RemoteLog.error(ctx, "stream",
                "No se pudo enviar '$evento': el canal de señalizacion no está enlazado.")
            return
        }
        try {
            emisor.invoke(evento, datos)
        } catch (e: Exception) {
            RemoteLog.error(ctx, "stream", "Falló el envío de '$evento': ${e.message}")
        }
    }

    /** Programa el parte de diagnostico del intento en curso. */
    private fun vigilarNegociacion() {
        cancelarVigilancia()
        val r = Runnable { reportarNegociacion() }
        reporteProgramado = r
        vigilante.postDelayed(r, ESPERA_DIAGNOSTICO_MS)
    }

    private fun cancelarVigilancia() {
        reporteProgramado?.let { vigilante.removeCallbacks(it) }
        reporteProgramado = null
    }

    /**
     * Dice al dashboard si la negociacion arranco de verdad. Si salio bien no
     * dice nada: el visor ya muestra imagen y no hace falta ensuciar el
     * historial del equipo.
     */
    private fun reportarNegociacion() {
        if (ofertaEnviada && candidatosEnviados > 0) return

        // Leer el estado toca objetos nativos que otro hilo pudo haber liberado.
        // Un diagnostico JAMAS debe tumbar al agente: si no se puede leer, se
        // reporta sin el detalle.
        val estado = try {
            val pc = peerConnection
            if (pc == null) "sin conexión creada"
            else "señalización=${pc.signalingState()}, recolección=${pc.iceGatheringState()}, " +
                 "conexión=${pc.iceConnectionState()}"
        } catch (e: Exception) {
            "estado no legible (${e.javaClass.simpleName})"
        }

        val que = if (!ofertaEnviada) "no llegó a enviar su oferta de video"
                  else "envió la oferta pero no produjo ninguna dirección de red"

        try {
            RemoteLog.error(ctx, "stream",
                "La vista en vivo no arrancó: el equipo $que " +
                "($estado; candidatos=$candidatosEnviados; ${captureWidth}x$captureHeight, lente=$lente).")
        } catch (e: Exception) {
            Log.w(TAG, "no se pudo reportar el diagnostico: ${e.message}")
        }
    }

    // 16:9 por defecto para que la vista en vivo (recuadro 16:9) se llene sin
    // barras negras cuando el celular esta en horizontal.
    private var captureWidth = 1280
    private var captureHeight = 720

    // Encuadre fijo del sitio, configurado desde el dashboard: que lente usar
    // ("main" o "wide") y cuanto zoom aplicar al abrir. Llega en el payload de las
    // ordenes; lo que se fija aqui es lo que veran la vista en vivo y las fotos.
    private var lente: String = "main"
    private var zoomInicial: Float = 0f

    // ICE servers efectivos (por defecto solo STUN; el backend puede inyectar TURN).
    private var iceServers: List<PeerConnection.IceServer> = ICE_SERVERS

    fun setIceServers(list: List<PeerConnection.IceServer>) {
        if (list.isNotEmpty()) iceServers = list
    }

    private val mainExecutor by lazy { ContextCompat.getMainExecutor(ctx) }

    fun initialize() {
        eglBase = EglBase.create()

        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(ctx)
                .setEnableInternalTracer(false)
                .createInitializationOptions()
        )

        factory = PeerConnectionFactory.builder()
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase!!.eglBaseContext))
            .setVideoEncoderFactory(
                DefaultVideoEncoderFactory(eglBase!!.eglBaseContext, true, true)
            )
            .createPeerConnectionFactory()

        Log.d(TAG, "PeerConnectionFactory initialized")
    }

    fun startStreaming(sessionId: String, emitter: (String, JSONObject) -> Unit) {
        if (factory == null) initialize()

        currentSessionId = sessionId
        socketEmitter = emitter

        // Arranca el parte de este intento. Solo observa; no condiciona nada.
        ofertaEnviada = false
        candidatosEnviados = 0
        vigilarNegociacion()

        // Fuente de video WebRTC alimentada por el SurfaceTextureHelper.
        surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", eglBase!!.eglBaseContext)
        videoSource = factory!!.createVideoSource(false)
        videoSource!!.capturerObserver.onCapturerStarted(true)
        var frameCount = 0
        surfaceTextureHelper!!.startListening { frame ->
            if (frameCount++ % 30 == 0) {
                Log.d(TAG, "camera frame #$frameCount ${frame.rotatedWidth}x${frame.rotatedHeight} rot=${frame.rotation}")
            }
            videoSource!!.capturerObserver.onFrameCaptured(frame)
        }

        videoTrack = factory!!.createVideoTrack("video_track", videoSource).apply {
            setEnabled(true)
        }

        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        peerConnection = factory!!.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate) {
                val json = JSONObject().apply {
                    put("session_id", currentSessionId)
                    put("candidate", JSONObject().apply {
                        put("sdpMid", candidate.sdpMid)
                        put("sdpMLineIndex", candidate.sdpMLineIndex)
                        put("candidate", candidate.sdp)
                    })
                }
                candidatosEnviados++
                emitirSeñal("webrtc_ice_candidate", json)
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                Log.d(TAG, "ICE connection state: $state")
            }
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(dc: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {}
        }) ?: run {
            Log.e(TAG, "Failed to create PeerConnection")
            RemoteLog.error(ctx, "stream",
                "No se pudo crear la conexión de video en el equipo (WebRTC rechazó la configuración).")
            return
        }

        peerConnection!!.addTrack(videoTrack)

        // Abrir la camara con CameraX en el hilo principal.
        mainExecutor.execute { bindCameraX() }

        createOfferAndSend()
    }

    /**
     * Lente que debe usar el sitio: "main" (principal) o "wide" (el gran angular
     * 0.5x). El gran angular es una camara FISICA distinta, no se llega con zoom.
     *
     * Se resuelve por id con Camera2 y se filtra el selector de CameraX para que
     * la vista en vivo y la foto usen exactamente el mismo lente: si no, lo que
     * ves al encuadrar no seria lo que despues recibes.
     */
    private fun selectorDeLente(): CameraSelector {
        if (lente != "wide") return CameraSelector.DEFAULT_BACK_CAMERA
        return try {
            val cm = ctx.getSystemService(android.content.Context.CAMERA_SERVICE)
                as android.hardware.camera2.CameraManager
            val id = com.spaceeye.agent.camera.PhotoCapture.elegirCamara(cm, "wide")
                ?: return CameraSelector.DEFAULT_BACK_CAMERA
            CameraSelector.Builder()
                .requireLensFacing(CameraSelector.LENS_FACING_BACK)
                .addCameraFilter { infos ->
                    infos.filter {
                        androidx.camera.camera2.interop.Camera2CameraInfo.from(it).cameraId == id
                    }.ifEmpty { infos }  // si no aparece, mejor la principal que fallar
                }
                .build()
        } catch (e: Exception) {
            Log.w(TAG, "no pude seleccionar el gran angular: ${e.message}")
            CameraSelector.DEFAULT_BACK_CAMERA
        }
    }

    /**
     * Como se pide la resolucion de la camara. Definido UNA sola vez porque lo
     * comparten la vista en vivo y la foto: si cada uno pidiera lo suyo, el stream
     * y la foto encuadrarian distinto.
     */
    private fun resolucion43() = ResolutionSelector.Builder()
        .setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
        .build()

    /**
     * El use case de foto, con la MISMA configuracion venga de donde venga la
     * captura.
     *
     * Esto existe porque habia dos formas distintas de tomar una foto y daban
     * resultados distintos: con la vista en vivo abierta salia bien, y sin ella
     * salia desenfocada, con otro encuadre y peor calidad. Ahora la foto se toma
     * siempre por aqui.
     */
    private fun construirImageCapture() = ImageCapture.Builder()
        .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
        .setResolutionSelector(resolucion43())
        .setTargetRotation(Surface.ROTATION_0)  // pixeles crudos = igual al stream
        .build()

    /**
     * Abre la camara EXACTAMENTE como la vista en vivo: mismo lente, mismo zoom,
     * vista previa + foto en la misma sesion, las dos en 4:3. La usan los TRES
     * caminos -la vista en vivo, la foto sin vista en vivo y la vigilancia de la
     * pantalla- para que una foto salga igual la tome quien la tome.
     *
     * La vista previa va a un SurfaceTextureHelper. En la vista en vivo es el que
     * alimenta a WebRTC; en los otros dos casos es uno propio que descarta los
     * cuadros: no se transmite nada, pero la camara corre igual que en la vista en
     * vivo, y con ella el enfoque, la exposicion y el balance de blancos.
     *
     * TIENE que llamarse en el hilo principal: CameraX y el ciclo de vida lo
     * exigen. Antes la foto sin vista en vivo y la vigilancia cambiaban el ciclo de
     * vida desde un hilo de fondo, y Android lo rechazaba con "setCurrentState
     * must be called on the main thread": la foto sin vista en vivo nunca funciono
     * y la vigilancia se caia en cada vuelta (visto el 25-sep en el telefono de
     * pruebas).
     */
    private fun vincular(
        helper: SurfaceTextureHelper,
        listo: (Camera, ImageCapture) -> Unit,
        fallo: (Exception) -> Unit,
    ) {
        lifecycleRegistry.currentState = Lifecycle.State.RESUMED
        val future = ProcessCameraProvider.getInstance(ctx)
        future.addListener({
            try {
                val provider = future.get()
                cameraProvider = provider

                // 4:3 en AMBOS use cases: asi el stream muestra exactamente el
                // mismo encuadre que la foto capturada (antes el preview era 16:9
                // y la foto 4:3, por lo que no coincidian).
                val preview = Preview.Builder()
                    .setResolutionSelector(resolucion43())
                    .build()

                // Use case de foto en la MISMA sesion: permite tomar foto durante
                // el stream (sin el conflicto camera_disconnected) y hereda los
                // ajustes en vivo (zoom/exposicion/WB/enfoque).
                val imgCap = construirImageCapture()

                preview.setSurfaceProvider(mainExecutor) { request ->
                    val res = request.resolution
                    // Imprescindible: el SurfaceTextureHelper descarta frames si no
                    // se le fija su tamaño de textura (no basta setDefaultBufferSize).
                    helper.setTextureSize(res.width, res.height)
                    val surface = Surface(helper.surfaceTexture)
                    if (helper === surfaceTextureHelper) previewSurface = surface
                    request.provideSurface(surface, mainExecutor) { surface.release() }
                }

                provider.unbindAll()
                val cam = provider.bindToLifecycle(this, selectorDeLente(), preview, imgCap)
                // Arranca con el encuadre configurado para el sitio, para que lo
                // primero que se vea sea ya el encuadre bueno.
                if (zoomInicial > 0f) cam.cameraControl.setLinearZoom(zoomInicial.coerceIn(0f, 1f))
                listo(cam, imgCap)
            } catch (e: Exception) {
                fallo(e)
            }
        }, mainExecutor)
    }

    private fun bindCameraX() {
        // La vista en vivo manda: si habia una foto suelta o una vuelta de
        // vigilancia con la camara abierta, se la lleva por delante.
        capturaVigilancia = null
        soltarAuxiliar()
        vincular(surfaceTextureHelper!!, { cam, imgCap ->
            imageCapture = imgCap
            camera = cam
            cameraControl = cam.cameraControl
            cameraInfo = cam.cameraInfo
            val rango = cam.cameraInfo.zoomState.value
            Log.d(TAG, "CameraX bound; lente=$lente zoom range=${rango?.minZoomRatio}-${rango?.maxZoomRatio}")
            // El rango va al log remoto: sin esto no habia forma de saber desde
            // el dashboard si un equipo tiene gran angular o hasta donde abre.
            RemoteLog.info(ctx, "camera",
                "Cámara abierta (stream) lente=$lente zoom=${rango?.minZoomRatio}x-${rango?.maxZoomRatio}x")
        }, { e ->
            Log.e(TAG, "CameraX bind failed: ${e.message}", e)
            RemoteLog.error(ctx, "camera", "Fallo al abrir cámara: ${e.message}")
        })
    }

    // Vista previa "de mentiras" para abrir la camara sin vista en vivo.
    private var auxiliar: SurfaceTextureHelper? = null

    private fun soltarAuxiliar() {
        auxiliar?.let { try { it.stopListening(); it.dispose() } catch (_: Exception) {} }
        auxiliar = null
    }

    /**
     * Abre la camara sin vista en vivo, igual que la vista en vivo, y avisa cuando
     * ya enfoco y midio la luz. null si no se pudo (o si mientras tanto alguien
     * abrio la vista en vivo, que manda).
     */
    private fun abrirSinVistaEnVivo(listo: (ImageCapture?) -> Unit) = abrirSinVistaEnVivo(false, listo)

    /**
     * @param fijarExposicion al terminar de enfocar y medir la luz, fija la
     *   exposicion y el balance de blancos (solo la vigilancia). Si no, la camara
     *   reajusta el brillo de TODA la foto cada vez que el anuncio pasa de oscuro a
     *   claro, y una zona que no cambia (un gabinete congelado, algo delante)
     *   parece cambiar con ella: en la prueba del 28-sep la ventana que tapaba un
     *   tercio de la pantalla no alarmaba por eso. En 4 minutos la luz del sitio
     *   casi no cambia; cada vuelta vuelve a medir desde cero.
     */
    @OptIn(markerClass = [ExperimentalCamera2Interop::class])
    private fun abrirSinVistaEnVivo(fijarExposicion: Boolean, listo: (ImageCapture?) -> Unit) {
        mainExecutor.execute {
            if (isStreaming()) { listo(null); return@execute }
            try {
                if (eglBase == null) eglBase = EglBase.create()
                soltarAuxiliar()
                val h = SurfaceTextureHelper.create("CamaraSinVivo", eglBase!!.eglBaseContext)
                // Los cuadros se descartan: solo mantienen la camara corriendo como
                // en la vista en vivo. No se codifican ni se transmiten.
                h.startListening { _ -> }
                auxiliar = h
                vincular(h, { cam, ic ->
                    Handler(Looper.getMainLooper()).postDelayed({
                        if (fijarExposicion && auxiliar === h) {
                            try {
                                Camera2CameraControl.from(cam.cameraControl).captureRequestOptions =
                                    CaptureRequestOptions.Builder()
                                        .setCaptureRequestOption(CaptureRequest.CONTROL_AE_LOCK, true)
                                        .setCaptureRequestOption(CaptureRequest.CONTROL_AWB_LOCK, true)
                                        .build()
                            } catch (e: Exception) {
                                Log.w(TAG, "no se pudo fijar la exposicion: ${e.message}")
                            }
                        }
                        listo(if (auxiliar === h && !isStreaming()) ic else null)
                    }, ESPERA_ENFOQUE_MS)
                }, { e ->
                    Log.e(TAG, "no se pudo abrir la camara sin vista en vivo: ${e.message}", e)
                    RemoteLog.error(ctx, "camera", "No se pudo abrir la cámara: ${e.message}")
                    cerrarSinVistaEnVivo()
                    listo(null)
                })
            } catch (e: Exception) {
                Log.e(TAG, "no se pudo preparar la camara: ${e.message}", e)
                cerrarSinVistaEnVivo()
                listo(null)
            }
        }
    }

    /** Cierra la camara abierta sin vista en vivo. Si hay vista en vivo, no la toca. */
    private fun cerrarSinVistaEnVivo() {
        mainExecutor.execute {
            soltarAuxiliar()
            if (isStreaming()) return@execute
            try { cameraProvider?.unbindAll() } catch (_: Exception) {}
            lifecycleRegistry.currentState = Lifecycle.State.CREATED
        }
    }

    // ---- Control manual de camara ----------------------------------------

    /** Zoom lineal 0.0 (min) .. 1.0 (max). */
    fun setZoom(linear: Float) {
        cameraControl?.setLinearZoom(linear.coerceIn(0f, 1f))
    }

    /**
     * Encuadre fijo del sitio (lente + zoom), tal como quedo configurado en el
     * dashboard. Si cambia el lente con el stream ya andando hay que reabrir la
     * camara: el lente es una camara fisica distinta, no un parametro.
     */
    fun setEncuadre(nuevoLente: String, zoom: Float) {
        val cambioDeLente = nuevoLente != lente
        lente = if (nuevoLente == "wide") "wide" else "main"
        zoomInicial = zoom.coerceIn(0f, 1f)
        if (isStreaming()) {
            // Reabrir la camara va en el hilo principal (setEncuadre llega desde
            // el hilo de las ordenes).
            if (cambioDeLente) mainExecutor.execute { bindCameraX() } else setZoom(zoomInicial)
        }
    }

    /** Lente y zoom vigentes, para que la captura con Camera2 use los mismos. */
    fun lenteActual(): String = lente
    fun zoomActual(): Float = zoomInicial

    /** Enfoque + medicion de exposicion en un punto normalizado (0..1). */
    fun focusAt(x: Float, y: Float, lock: Boolean) {
        val cc = cameraControl ?: return
        val pointFactory = SurfaceOrientedMeteringPointFactory(1f, 1f)
        val point = pointFactory.createPoint(x.coerceIn(0f, 1f), y.coerceIn(0f, 1f))
        val builder = FocusMeteringAction.Builder(
            point,
            FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
        )
        if (lock) builder.disableAutoCancel()  // mantiene el foco fijo
        cc.startFocusAndMetering(builder.build())
    }

    /** Libera el bloqueo de foco y vuelve a autofoco continuo. */
    fun unlockFocus() {
        cameraControl?.cancelFocusAndMetering()
    }

    /** Compensacion de exposicion (indice); se recorta al rango del sensor. */
    fun setExposure(index: Int) {
        val info = cameraInfo ?: return
        val range = info.exposureState.exposureCompensationRange
        cameraControl?.setExposureCompensationIndex(index.coerceIn(range.lower, range.upper))
    }

    /** Balance de blancos (auto/incandescent/daylight/cloudy/fluorescent). */
    @OptIn(markerClass = [ExperimentalCamera2Interop::class])
    fun setWhiteBalance(mode: String) {
        val cc = cameraControl ?: return
        val awb = when (mode) {
            "incandescent" -> CaptureRequest.CONTROL_AWB_MODE_INCANDESCENT
            "daylight" -> CaptureRequest.CONTROL_AWB_MODE_DAYLIGHT
            "cloudy" -> CaptureRequest.CONTROL_AWB_MODE_CLOUDY_DAYLIGHT
            "fluorescent" -> CaptureRequest.CONTROL_AWB_MODE_FLUORESCENT
            else -> CaptureRequest.CONTROL_AWB_MODE_AUTO
        }
        val opts = CaptureRequestOptions.Builder()
            .setCaptureRequestOption(CaptureRequest.CONTROL_AWB_MODE, awb)
            .build()
        Camera2CameraControl.from(cc).captureRequestOptions = opts
    }

    /** Hay una sesion CameraX activa (stream en curso). */
    fun isStreaming(): Boolean = imageCapture != null && cameraControl != null

    /**
     * Cuanto se espera a que la camara termine de enfocar y medir la luz antes de
     * disparar, cuando se abre solo para la foto.
     *
     * Es LA razon por la que las fotos sin vista en vivo salian mal. Con el stream
     * abierto la camara lleva rato funcionando y el enfoque, la exposicion y el
     * balance de blancos ya convergieron; abriendola y disparando de inmediato,
     * la foto sale con lo primero que alcanzo a calcular: desenfocada y mal
     * expuesta. Un segundo y medio le basta para asentarse.
     */
    private val ESPERA_ENFOQUE_MS = 1500L

    /**
     * Toma una foto SIEMPRE con la misma configuracion del sitio, haya stream o no.
     *
     * Si la vista en vivo esta abierta se usa esa sesion (no se puede abrir la
     * camara dos veces). Si no lo esta, se abre una sesion CameraX identica -mismo
     * lente, mismo zoom, misma resolucion, mismo use case de foto-, se le da tiempo
     * a enfocar y se cierra al terminar.
     *
     * Antes este segundo caso iba por otro camino completamente distinto (Camera2
     * en crudo, sin vista previa y disparando al instante), y por eso la misma
     * camara daba fotos buenas o malas segun si alguien habia abierto el visor.
     */
    fun capturarFoto(extraDegrees: Int, onResult: (ByteArray?) -> Unit) {
        if (isStreaming()) {
            captureStill(extraDegrees, onResult)
            return
        }
        abrirSoloParaFoto(extraDegrees, onResult)
    }

    private fun abrirSoloParaFoto(extraDegrees: Int, onResult: (ByteArray?) -> Unit) {
        // Esta foto cierra la vigilancia si estaba abierta; el vigilante la
        // reabre cuando la camara quede libre.
        capturaVigilancia = null
        abrirSinVistaEnVivo { imgCap ->
            if (imgCap == null) { onResult(null); return@abrirSinVistaEnVivo }
            Log.d(TAG, "foto sin stream: lente=$lente zoom=$zoomInicial")
            try {
                imgCap.takePicture(mainExecutor, object : ImageCapture.OnImageCapturedCallback() {
                    override fun onCaptureSuccess(image: ImageProxy) {
                        try {
                            val buffer = image.planes[0].buffer
                            val bytes = ByteArray(buffer.remaining())
                            buffer.get(bytes)
                            image.close()
                            cerrarSinVistaEnVivo()
                            onResult(bakeRotation(bytes, extraDegrees))
                        } catch (e: Exception) {
                            Log.e(TAG, "foto sin stream, fallo al leer: ${e.message}")
                            cerrarSinVistaEnVivo()
                            onResult(null)
                        }
                    }
                    override fun onError(exc: ImageCaptureException) {
                        Log.e(TAG, "foto sin stream, error: ${exc.message}")
                        RemoteLog.error(ctx, "photo", "No se pudo capturar: ${exc.message}")
                        cerrarSinVistaEnVivo()
                        onResult(null)
                    }
                })
            } catch (e: Exception) {
                Log.e(TAG, "foto sin stream, fallo al disparar: ${e.message}")
                cerrarSinVistaEnVivo()
                onResult(null)
            }
        }
    }

    // ---- Vigilancia de creativos -------------------------------------------
    //
    // Durante un recorrido la camara se queda ABIERTA (igual que en la vista en
    // vivo, pero sin transmitir) y se toman fotos cada pocos segundos. Abrir y
    // cerrar en cada vistazo costaria segundo y medio de enfoque cada vez y
    // calentaria mas el telefono.
    //
    // Cualquier otra cosa que use la camara (la vista en vivo, una foto pedida)
    // hace unbindAll y se lleva esta sesion por delante. Por eso se anula alli, y
    // el vigilante, al ver que no hay sesion, la vuelve a abrir cuando la camara
    // quede libre.

    @Volatile private var capturaVigilancia: ImageCapture? = null

    /** Abre la sesion de vigilancia, igual que la vista en vivo. false si no pudo. */
    fun abrirVigilancia(onListo: (Boolean) -> Unit) {
        abrirSinVistaEnVivo(fijarExposicion = true) { imgCap ->
            capturaVigilancia = imgCap
            onListo(imgCap != null)
        }
    }

    /** Una foto de la sesion de vigilancia, SIN girar (la huella no lo necesita). */
    fun vistazo(onResult: (ByteArray?) -> Unit) {
        val ic = capturaVigilancia ?: return onResult(null)
        mainExecutor.execute {
            try {
                ic.takePicture(mainExecutor, object : ImageCapture.OnImageCapturedCallback() {
                    override fun onCaptureSuccess(image: ImageProxy) {
                        try {
                            val buffer = image.planes[0].buffer
                            val bytes = ByteArray(buffer.remaining())
                            buffer.get(bytes)
                            onResult(bytes)
                        } catch (e: Exception) {
                            onResult(null)
                        } finally {
                            image.close()
                        }
                    }
                    override fun onError(exc: ImageCaptureException) {
                        Log.w(TAG, "vistazo fallido: ${exc.message}")
                        onResult(null)
                    }
                })
            } catch (e: Exception) {
                onResult(null)
            }
        }
    }

    /** Cierra la sesion de vigilancia, si sigue siendo la que esta abierta. */
    fun cerrarVigilancia() {
        mainExecutor.execute {
            if (capturaVigilancia == null) return@execute
            capturaVigilancia = null
            cerrarSinVistaEnVivo()
        }
    }

    /** Gira el JPEG igual que cualquier otra foto del sitio. */
    fun enderezar(jpeg: ByteArray, grados: Int): ByteArray = bakeRotation(jpeg, grados)

    /**
     * Toma una foto desde la sesion CameraX activa (no abre otra camara → sin
     * conflicto con el stream, y con los ajustes en vivo aplicados). Devuelve
     * el JPEG por callback, o null si falla.
     */
    fun captureStill(extraDegrees: Int, onResult: (ByteArray?) -> Unit) {
        val ic = imageCapture ?: return onResult(null)
        ic.takePicture(mainExecutor, object : ImageCapture.OnImageCapturedCallback() {
            override fun onCaptureSuccess(image: ImageProxy) {
                try {
                    val buffer = image.planes[0].buffer
                    val bytes = ByteArray(buffer.remaining())
                    buffer.get(bytes)
                    image.close()
                    // Hornea la orientacion en los pixeles (ver bakeRotation) para
                    // que la foto guardada coincida con lo que se veia en el stream.
                    onResult(bakeRotation(bytes, extraDegrees))
                } catch (e: Exception) {
                    Log.e(TAG, "captureStill read failed: ${e.message}")
                    onResult(null)
                }
            }
            override fun onError(exc: ImageCaptureException) {
                Log.e(TAG, "captureStill error: ${exc.message}")
                onResult(null)
            }
        })
    }

    /**
     * Graba en los pixeles la orientacion EXIF de la captura + la rotacion manual
     * del visor (extraDegrees) y re-codifica el JPEG sin EXIF. Asi la foto queda
     * con la MISMA orientacion que se veia en el stream, y todo lo de abajo
     * (miniatura, galeria, descarga, verificacion) es consistente sin depender
     * del EXIF (que muchos visores ignoran).
     */
    private fun bakeRotation(jpeg: ByteArray, extraDegrees: Int): ByteArray {
        return try {
            val exifDeg = try {
                when (ExifInterface(ByteArrayInputStream(jpeg))
                    .getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> 90
                    ExifInterface.ORIENTATION_ROTATE_180 -> 180
                    ExifInterface.ORIENTATION_ROTATE_270 -> 270
                    else -> 0
                }
            } catch (_: Exception) { 0 }

            val total = (((exifDeg + extraDegrees + PHOTO_ROTATION_CORRECTION) % 360) + 360) % 360
            val src = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size) ?: return jpeg
            val outBmp = if (total == 0) src else {
                val m = Matrix().apply { postRotate(total.toFloat()) }
                Bitmap.createBitmap(src, 0, 0, src.width, src.height, m, true)
            }
            val out = ByteArrayOutputStream()
            outBmp.compress(Bitmap.CompressFormat.JPEG, 92, out)
            if (outBmp !== src) outBmp.recycle()
            src.recycle()
            out.toByteArray()
        } catch (e: Exception) {
            Log.e(TAG, "bakeRotation failed: ${e.message}")
            jpeg
        }
    }

    // ---- Señalizacion (sin cambios respecto a la version que ya conectaba) --

    private fun createOfferAndSend() {
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "false"))
        }

        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {
                peerConnection?.setLocalDescription(object : SdpObserver {
                    override fun onSetSuccess() {
                        val json = JSONObject().apply {
                            put("session_id", currentSessionId)
                            put("sdp", JSONObject().apply {
                                put("type", sdp.type.canonicalForm())
                                put("sdp", sdp.description)
                            })
                        }
                        ofertaEnviada = true
                        emitirSeñal("webrtc_offer", json)
                    }
                    override fun onSetFailure(error: String?) {
                        Log.e(TAG, "setLocalDescription failed: $error")
                        // Sin esto la recoleccion de direcciones nunca arranca y
                        // el visor se queda esperando sin motivo visible.
                        RemoteLog.error(ctx, "stream",
                            "El equipo no pudo preparar su oferta de video (setLocalDescription): $error")
                    }
                    override fun onCreateSuccess(sdp: SessionDescription?) {}
                    override fun onCreateFailure(error: String?) {}
                }, sdp)
            }
            override fun onCreateFailure(error: String?) {
                Log.e(TAG, "createOffer failed: $error")
                RemoteLog.error(ctx, "stream",
                    "El equipo no pudo crear su oferta de video (createOffer): $error")
            }
            override fun onSetSuccess() {}
            override fun onSetFailure(error: String?) {}
        }, constraints)
    }

    fun onAnswerReceived(sdpJson: JSONObject) {
        val sdpString = sdpJson.optString("sdp")
        if (sdpString.isEmpty()) {
            Log.e(TAG, "Received empty answer SDP")
            return
        }
        val answer = SessionDescription(SessionDescription.Type.ANSWER, sdpString)
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onSetSuccess() { Log.d(TAG, "Remote description (answer) set") }
            override fun onSetFailure(error: String?) {
                Log.e(TAG, "setRemoteDescription failed: $error")
            }
            override fun onCreateSuccess(sdp: SessionDescription?) {}
            override fun onCreateFailure(error: String?) {}
        }, answer)
    }

    fun onIceCandidateReceived(candidateJson: JSONObject) {
        val sdpMid = candidateJson.optString("sdpMid")
        val sdpMLineIndex = candidateJson.optInt("sdpMLineIndex")
        val sdp = candidateJson.optString("candidate")
        if (sdp.isEmpty()) return
        peerConnection?.addIceCandidate(IceCandidate(sdpMid, sdpMLineIndex, sdp))
    }

    fun stopStreaming() {
        Log.d(TAG, "Stopping stream")
        // Lo PRIMERO, antes de destruir nada: si el parte llegara a ejecutarse
        // mientras se libera la conexion, leeria un objeto nativo ya liberado.
        cancelarVigilancia()
        mainExecutor.execute {
            try {
                cameraProvider?.unbindAll()
            } catch (_: Exception) {}
            lifecycleRegistry.currentState = Lifecycle.State.CREATED
            camera = null
            cameraControl = null
            cameraInfo = null
            imageCapture = null
        }

        surfaceTextureHelper?.stopListening()
        surfaceTextureHelper?.dispose()
        surfaceTextureHelper = null

        previewSurface?.release()
        previewSurface = null

        videoTrack?.dispose()
        videoTrack = null

        videoSource?.dispose()
        videoSource = null

        peerConnection?.close()
        peerConnection?.dispose()
        peerConnection = null

        currentSessionId = null
        socketEmitter = null

        // Un STOP normal (el usuario cierra, o el corte a los 3 min) no es un
        // fallo: se cancela el parte para no llenar el historial del equipo de
        // errores que no lo son.
        cancelarVigilancia()
    }

    fun setQuality(quality: String) {
        val (width, height) = when (quality) {
            "low" -> 640 to 360
            "medium" -> 1280 to 720
            "high" -> 1920 to 1080
            else -> 1280 to 720
        }
        captureWidth = width
        captureHeight = height
    }

    fun release() {
        stopStreaming()
        factory?.dispose()
        factory = null
        eglBase?.release()
        eglBase = null
    }
}
