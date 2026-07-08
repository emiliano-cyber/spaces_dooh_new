// frontend/src/js/webrtc.js
class LiveStreamClient {
  constructor(deviceId, videoElement) {
    this.deviceId = deviceId;
    this.video = videoElement;
    this.pc = null;
    this.socket = null;
  }

  async start() {
    this.socket = io('/dashboard', {
      auth: { token: localStorage.getItem('access_token') },
      transports: ['websocket', 'polling'],
    });

    await new Promise((resolve, reject) => {
      this.socket.on('connect', resolve);
      this.socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('socket_timeout')), 5000);
    });

    // Join the watching room so we receive offers/ICE from this device
    this.socket.emit('watch_device', this.deviceId);

    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.pc.ontrack = (evt) => {
      console.log('[WebRTC] ontrack — received remote stream');
      if (evt.streams && evt.streams[0]) {
        this.video.srcObject = evt.streams[0];
      }
    };

    this.pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        this.socket.emit('webrtc_ice_candidate', {
          device_id: this.deviceId,
          candidate: {
            sdpMid: evt.candidate.sdpMid,
            sdpMLineIndex: evt.candidate.sdpMLineIndex,
            candidate: evt.candidate.candidate,
          },
        });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', this.pc.iceConnectionState);
    };

    // Listen for offer from device (sdp comes as { type: "offer", sdp: "v=0..." })
    this.socket.on('webrtc_offer', async (data) => {
      try {
        const sdpObj = data.sdp;
        console.log('[WebRTC] Received offer from device');
        await this.pc.setRemoteDescription(
          new RTCSessionDescription({ type: sdpObj.type, sdp: sdpObj.sdp })
        );
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.socket.emit('webrtc_answer', {
          device_id: this.deviceId,
          sdp: {
            type: answer.type,
            sdp: answer.sdp,
          },
        });
        console.log('[WebRTC] Answer sent');
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    });

    // Listen for ICE candidates from device
    this.socket.on('webrtc_ice_candidate', async (data) => {
      try {
        if (data.candidate && this.pc.remoteDescription) {
          await this.pc.addIceCandidate(
            new RTCIceCandidate({
              sdpMid: data.candidate.sdpMid,
              sdpMLineIndex: data.candidate.sdpMLineIndex,
              candidate: data.candidate.candidate,
            })
          );
        }
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
    });

    // Send START_STREAM command to device via API
    await API.post(`/api/devices/${this.deviceId}/command`, {
      command_type: 'START_STREAM',
      payload: { session_id: Date.now().toString() },
    });

    console.log('[WebRTC] START_STREAM command sent');
  }

  async stop() {
    try {
      await API.post(`/api/devices/${this.deviceId}/command`, {
        command_type: 'STOP_STREAM',
      });
    } catch (e) { /* ignore */ }

    this.pc?.close();
    this.pc = null;

    if (this.socket) {
      this.socket.emit('unwatch_device', this.deviceId);
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.video) this.video.srcObject = null;
  }
}
