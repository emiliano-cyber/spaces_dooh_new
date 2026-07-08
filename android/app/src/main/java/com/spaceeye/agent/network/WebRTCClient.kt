package com.spaceeye.agent.network

import android.content.Context
import android.util.Log
import org.json.JSONObject
import org.webrtc.*

class WebRTCClient(private val ctx: Context) {

    companion object {
        private const val TAG = "WebRTCClient"
        private val ICE_SERVERS = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
        )
    }

    private var factory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var videoCapturer: CameraVideoCapturer? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var eglBase: EglBase? = null

    private var socketEmitter: ((String, JSONObject) -> Unit)? = null
    private var currentSessionId: String? = null

    private var captureWidth = 640
    private var captureHeight = 480
    private var captureFps = 15

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

        val capturer = createCameraCapturer() ?: run {
            Log.e(TAG, "No camera available")
            return
        }
        videoCapturer = capturer

        surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", eglBase!!.eglBaseContext)
        videoSource = factory!!.createVideoSource(capturer.isScreencast)
        capturer.initialize(surfaceTextureHelper, ctx, videoSource!!.capturerObserver)
        capturer.startCapture(captureWidth, captureHeight, captureFps)

        videoTrack = factory!!.createVideoTrack("video_track", videoSource).apply {
            setEnabled(true)
        }

        val rtcConfig = PeerConnection.RTCConfiguration(ICE_SERVERS).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        peerConnection = factory!!.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate) {
                Log.d(TAG, "Local ICE candidate: ${candidate.sdpMid}")
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
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {
                Log.d(TAG, "Signaling state: $state")
            }
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                Log.d(TAG, "ICE connection state: $state")
            }
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {
                Log.d(TAG, "ICE gathering state: $state")
            }
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

        createOfferAndSend()
    }

    private fun createOfferAndSend() {
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "false"))
        }

        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {
                peerConnection?.setLocalDescription(object : SdpObserver {
                    override fun onSetSuccess() {
                        Log.d(TAG, "Local description set, sending offer")
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
            override fun onSetSuccess() {
                Log.d(TAG, "Remote description (answer) set successfully")
            }
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

        val candidate = IceCandidate(sdpMid, sdpMLineIndex, sdp)
        val added = peerConnection?.addIceCandidate(candidate) ?: false
        Log.d(TAG, "Remote ICE candidate added: $added")
    }

    fun stopStreaming() {
        Log.d(TAG, "Stopping stream")
        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        videoCapturer = null

        videoTrack?.dispose()
        videoTrack = null

        videoSource?.dispose()
        videoSource = null

        surfaceTextureHelper?.dispose()
        surfaceTextureHelper = null

        peerConnection?.close()
        peerConnection?.dispose()
        peerConnection = null

        currentSessionId = null
        socketEmitter = null
    }

    fun setQuality(quality: String) {
        val (width, height, fps) = when (quality) {
            "low" -> Triple(320, 240, 10)
            "medium" -> Triple(640, 480, 15)
            "high" -> Triple(1280, 720, 20)
            else -> Triple(640, 480, 15)
        }
        captureWidth = width
        captureHeight = height
        captureFps = fps
        videoCapturer?.changeCaptureFormat(width, height, fps)
    }

    fun release() {
        stopStreaming()
        factory?.dispose()
        factory = null
        eglBase?.release()
        eglBase = null
    }

    private fun createCameraCapturer(): CameraVideoCapturer? {
        val enumerator = Camera2Enumerator(ctx)
        // Prefer back camera
        for (name in enumerator.deviceNames) {
            if (enumerator.isBackFacing(name)) {
                val capturer = enumerator.createCapturer(name, null)
                if (capturer != null) return capturer
            }
        }
        // Fallback to any available camera
        for (name in enumerator.deviceNames) {
            val capturer = enumerator.createCapturer(name, null)
            if (capturer != null) return capturer
        }
        return null
    }
}
