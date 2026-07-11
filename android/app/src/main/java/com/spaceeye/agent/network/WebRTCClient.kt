package com.spaceeye.agent.network

import android.content.Context
import android.hardware.camera2.CaptureRequest
import android.util.Log
import android.util.Size
import android.view.Surface
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

    // 16:9 por defecto para que la vista en vivo (recuadro 16:9) se llene sin
    // barras negras cuando el celular esta en horizontal.
    private var captureWidth = 1280
    private var captureHeight = 720

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
                socketEmitter?.invoke("webrtc_ice_candidate", json)
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
            return
        }

        peerConnection!!.addTrack(videoTrack)

        // Abrir la camara con CameraX en el hilo principal.
        mainExecutor.execute { bindCameraX() }

        createOfferAndSend()
    }

    private fun bindCameraX() {
        lifecycleRegistry.currentState = Lifecycle.State.RESUMED
        val future = ProcessCameraProvider.getInstance(ctx)
        future.addListener({
            try {
                val provider = future.get()
                cameraProvider = provider

                // 4:3 en AMBOS use cases: asi el stream muestra exactamente el
                // mismo encuadre que la foto capturada (antes el preview era 16:9
                // y la foto 4:3, por lo que no coincidian).
                val res43 = ResolutionSelector.Builder()
                    .setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
                    .build()

                val preview = Preview.Builder()
                    .setResolutionSelector(res43)
                    .build()

                // Use case de foto en la MISMA sesion: permite tomar foto durante
                // el stream (sin el conflicto camera_disconnected) y hereda los
                // ajustes en vivo (zoom/exposicion/WB/enfoque).
                // El sensor trasero suele estar a 90°, por lo que la foto salia
                // girada respecto al stream. Compensamos para que la foto guardada
                // coincida con lo que se ve en la vista en vivo (landscape).
                val imgCap = ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                    .setResolutionSelector(res43)
                    .setTargetRotation(Surface.ROTATION_270)
                    .build()
                imageCapture = imgCap

                preview.setSurfaceProvider(mainExecutor) { request ->
                    val res = request.resolution
                    // Imprescindible: el SurfaceTextureHelper descarta frames si no
                    // se le fija su tamaño de textura (no basta setDefaultBufferSize).
                    surfaceTextureHelper!!.setTextureSize(res.width, res.height)
                    val surface = Surface(surfaceTextureHelper!!.surfaceTexture)
                    previewSurface = surface
                    request.provideSurface(surface, mainExecutor) { surface.release() }
                }

                provider.unbindAll()
                val cam = provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, imgCap)
                camera = cam
                cameraControl = cam.cameraControl
                cameraInfo = cam.cameraInfo
                Log.d(TAG, "CameraX bound; zoom range=" +
                    "${cam.cameraInfo.zoomState.value?.minZoomRatio}-${cam.cameraInfo.zoomState.value?.maxZoomRatio}")
                RemoteLog.info(ctx, "camera", "Cámara abierta (stream)")
            } catch (e: Exception) {
                Log.e(TAG, "CameraX bind failed: ${e.message}", e)
                RemoteLog.error(ctx, "camera", "Fallo al abrir cámara: ${e.message}")
            }
        }, mainExecutor)
    }

    // ---- Control manual de camara ----------------------------------------

    /** Zoom lineal 0.0 (min) .. 1.0 (max). */
    fun setZoom(linear: Float) {
        cameraControl?.setLinearZoom(linear.coerceIn(0f, 1f))
    }

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
     * Toma una foto desde la sesion CameraX activa (no abre otra camara → sin
     * conflicto con el stream, y con los ajustes en vivo aplicados). Devuelve
     * el JPEG por callback, o null si falla.
     */
    fun captureStill(onResult: (ByteArray?) -> Unit) {
        val ic = imageCapture ?: return onResult(null)
        ic.takePicture(mainExecutor, object : ImageCapture.OnImageCapturedCallback() {
            override fun onCaptureSuccess(image: ImageProxy) {
                try {
                    val buffer = image.planes[0].buffer
                    val bytes = ByteArray(buffer.remaining())
                    buffer.get(bytes)
                    onResult(bytes)
                } catch (e: Exception) {
                    Log.e(TAG, "captureStill read failed: ${e.message}")
                    onResult(null)
                } finally {
                    image.close()
                }
            }
            override fun onError(exc: ImageCaptureException) {
                Log.e(TAG, "captureStill error: ${exc.message}")
                onResult(null)
            }
        })
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
                        socketEmitter?.invoke("webrtc_offer", json)
                    }
                    override fun onSetFailure(error: String?) {
                        Log.e(TAG, "setLocalDescription failed: $error")
                    }
                    override fun onCreateSuccess(sdp: SessionDescription?) {}
                    override fun onCreateFailure(error: String?) {}
                }, sdp)
            }
            override fun onCreateFailure(error: String?) {
                Log.e(TAG, "createOffer failed: $error")
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
