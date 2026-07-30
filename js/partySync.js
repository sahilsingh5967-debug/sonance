/**
 * Sonance PartySync - WebRTC PeerJS Networking Layer with Binary Chunking
 */
export class PartySync {
  /**
   * @param {import('./eventBus.js').EventBus} eventBus 
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.peer = null;
    this.conn = null;
    this.activeConnection = null;
    this.isHost = false;
    this.fullPeerId = null;
    this.lastTimeBroadcast = 0;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;

    // Buffer array for reassembling chunked P2P audio transfers on guest side
    this.chunkBuffer = null;
    this.receivedChunks = 0;

    this.bindEvents();
  }

  bindEvents() {
    this.eventBus.on('START_PARTY_HOST', () => this.startHostSession());
    this.eventBus.on('JOIN_PARTY_GUEST', (hostId) => this.joinGuestSession(hostId));
    this.eventBus.on('LEAVE_PARTY', () => this.leaveParty());

    // Host Broadcasting Listeners
    this.eventBus.on('PLAYSTATE_CHANGED', ({ isPlaying }) => {
      if (this.isHost) {
        this.broadcastPayload({ action: isPlaying ? 'PLAY_ACTION' : 'PAUSE_ACTION', timestamp: Date.now() });
      }
    });

    this.eventBus.on('TIME_UPDATED', ({ currentTime }) => {
      if (this.isHost) {
        const now = Date.now();
        if (now - this.lastTimeBroadcast >= 2000) {
          this.lastTimeBroadcast = now;
          this.broadcastPayload({ action: 'SYNC_TIME', time: currentTime, timestamp: now });
        }
      }
    });

    this.eventBus.on('SEEK_COMMAND', (time) => {
      if (this.isHost) {
        this.broadcastPayload({ action: 'SYNC_TIME', time, timestamp: Date.now() });
      }
    });

    // P2P Audio File Transfer on Track Change
    this.eventBus.on('CURRENT_TRACK_CHANGED', (trackObject) => {
      if (this.isHost && trackObject && trackObject.originalFile) {
        this.transferAudioFile(trackObject);
      }
    });
  }

  /**
   * Host Session Initialization & Peer Lifecycle Setup
   */
  startHostSession() {
    if (typeof window.Peer === 'undefined') {
      this.handlePeerError({ type: 'browser-incompatible', message: 'PeerJS WebRTC Library Not Loaded' });
      return;
    }

    this.cleanupPeer();
    this.isHost = true;

    try {
      this.peer = new window.Peer();
      this.attachPeerLifecycleListeners('host');
    } catch (err) {
      this.handlePeerError({ type: 'webrtc', message: 'Failed to instantiate Host Peer session', error: err });
    }
  }

  /**
   * Guest Session Initialization & Connection Setup
   * @param {string} hostId 
   */
  joinGuestSession(hostId) {
    if (!hostId || !hostId.trim()) {
      this.handlePeerError({ type: 'invalid-id', message: 'Invalid or empty Host Room ID' });
      return;
    }

    if (typeof window.Peer === 'undefined') {
      this.handlePeerError({ type: 'browser-incompatible', message: 'PeerJS WebRTC Library Not Loaded' });
      return;
    }

    const cleanHostId = hostId.trim();
    this.cleanupPeer();
    this.isHost = false;

    try {
      this.peer = new window.Peer();
      this.attachPeerLifecycleListeners('guest', cleanHostId);
    } catch (err) {
      this.handlePeerError({ type: 'webrtc', message: 'Failed to instantiate Guest Peer session', error: err });
    }
  }

  // BUG 1 FIX: Enforce binary serialization on connection
  connectToHost(hostId) {
    if (!this.peer || !hostId) return;
    const cleanHostId = hostId.trim();
    
    // Change default serialization to 'binary' to prevent ArrayBuffer corruption
    this.conn = this.peer.connect(cleanHostId, { serialization: 'binary', reliable: true });
    this.activeConnection = this.conn;

    this.conn.on('open', () => {
      console.log('[Sonance] Connected to host:', cleanHostId);
      this.eventBus.emit('PARTY_STATUS_UPDATED', {
        role: 'guest',
        peerId: cleanHostId,
        fullPeerId: cleanHostId,
        status: 'Connected (Live P2P)'
      });
      this.eventBus.emit('TOAST_SHOW', 'Connected to Host Party!');
    });

    this.conn.on('data', (data) => this.handleGuestPayload(data));

    this.conn.on('close', () => {
      this.handleDisconnect('Host Disconnected');
    });

    this.conn.on('error', (err) => {
      this.handlePeerError({ type: 'webrtc', message: 'Data Channel Error', error: err });
    });
  }

  attachPeerLifecycleListeners(role, targetHostId = null) {
    if (!this.peer) return;

    this.peer.on('open', (peerId) => {
      this.fullPeerId = peerId;
      this.reconnectAttempts = 0;
      console.log(`[PartySync ${role.toUpperCase()}] Peer Open (ID: ${peerId})`);

      if (role === 'host') {
        this.eventBus.emit('PARTY_STATUS_UPDATED', {
          role: 'host',
          peerId,
          fullPeerId: peerId,
          status: `Host (ID: ${peerId})`
        });
        this.eventBus.emit('TOAST_SHOW', `Host Room Created! Click badge to copy ID.`);
      } else if (role === 'guest' && targetHostId) {
        this.connectToHost(targetHostId);
      }
    });

    this.peer.on('connection', (conn) => {
      console.log(`[PartySync HOST] Incoming connection from Guest: ${conn.peer}`);
      this.setupConnectionHandlers(conn);
      this.eventBus.emit('PARTY_STATUS_UPDATED', {
        role: 'host',
        peerId: this.peer.id,
        fullPeerId: this.peer.id,
        status: `Host (Connected)`
      });
      this.eventBus.emit('TOAST_SHOW', 'Remote Party Guest Connected!');
    });

    this.peer.on('disconnected', () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts && this.peer && !this.peer.destroyed) {
        this.reconnectAttempts++;
        try { this.peer.reconnect(); } catch (err) {}
      } else {
        this.handlePeerError({ type: 'network', message: 'Signaling server connection lost permanently.' });
        this.handleDisconnect('Host Disconnected');
      }
    });

    this.peer.on('close', () => {
      this.handleDisconnect('Party Session Closed');
    });

    this.peer.on('error', (err) => {
      this.handlePeerError(err);
    });
  }

  setupConnectionHandlers(conn) {
    if (!conn) return;
    this.conn = conn;
    this.activeConnection = conn;

    conn.on('open', () => {
      console.log(`[PartySync P2P Channel] Open with Peer: ${conn.peer}`);
      if (!this.isHost) {
        this.eventBus.emit('PARTY_STATUS_UPDATED', {
          role: 'guest',
          peerId: conn.peer,
          fullPeerId: conn.peer,
          status: 'Connected (Live P2P)'
        });
        this.eventBus.emit('TOAST_SHOW', 'Connected to Host Party!');
      }
    });

    conn.on('data', (data) => {
      this.handleGuestPayload(data);
    });

    conn.on('close', () => {
      this.handleDisconnect(this.isHost ? 'Guest Disconnected' : 'Host Disconnected');
    });

    conn.on('error', (err) => {
      this.handlePeerError({ type: 'webrtc', message: 'WebRTC P2P Data Channel Error', error: err });
    });
  }

  handlePeerError(err) {
    const errorType = err ? (err.type || 'unknown') : 'unknown';
    let readableMessage = err ? (err.message || 'WebRTC error') : 'WebRTC error';

    this.eventBus.emit('NETWORK_ERROR', { type: errorType, message: readableMessage, error: err });
    this.eventBus.emit('TOAST_SHOW', readableMessage);
  }

  handleDisconnect(reasonMessage) {
    this.conn = null;
    this.activeConnection = null;
    this.isHost = false;
    this.fullPeerId = null;
    this.chunkBuffer = null;
    this.receivedChunks = 0;
    this.eventBus.emit('PARTY_STATUS_UPDATED', {
      role: 'standalone',
      status: reasonMessage || 'Standalone'
    });
    this.eventBus.emit('TOAST_SHOW', reasonMessage || 'Party Session Ended');
  }

  cleanupPeer() {
    if (this.activeConnection) {
      try { this.activeConnection.close(); } catch (e) {}
      this.activeConnection = null;
      this.conn = null;
    }

    if (this.peer) {
      try {
        this.peer.off();
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
    this.chunkBuffer = null;
    this.receivedChunks = 0;
  }

  broadcastPayload(payload) {
    const activeConn = this.conn || this.activeConnection;
    if (this.isHost && activeConn && activeConn.open) {
      try {
        activeConn.send(payload);
      } catch (err) {
        this.handlePeerError({ type: 'webrtc', message: 'Failed to broadcast WebRTC payload', error: err });
      }
    }
  }

  // BUG 3 FIX (Part A): Split ArrayBuffer into 16KB chunks
  transferAudioFile(trackObject) {
    const activeConn = this.conn || this.activeConnection;
    if (!activeConn || !activeConn.open) return;

    const file = trackObject ? (trackObject.originalFile || trackObject) : null;
    if (!file) return;

    const sendBuffer = (arrayBuffer) => {
      const chunkSize = 16 * 1024; // 16KB limit for max browser compatibility
      const totalChunks = Math.ceil(arrayBuffer.byteLength / chunkSize);
      const uint8Array = new Uint8Array(arrayBuffer);

      console.log(`[Sonance] Transferring file in ${totalChunks} chunks...`);
      this.eventBus.emit('TOAST_SHOW', `Streaming audio to Guest (${totalChunks} chunks)...`);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, uint8Array.length);
        
        // Slice the Uint8Array and get the underlying ArrayBuffer
        const chunkBuffer = uint8Array.slice(start, end).buffer;

        this.broadcastPayload({
          type: 'AUDIO_CHUNK',
          payload: {
            chunkIndex: i,
            totalChunks: totalChunks,
            data: chunkBuffer
          }
        });
      }
    };

    if (file instanceof ArrayBuffer) {
      sendBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => sendBuffer(reader.result);
      reader.onerror = (err) => {
        this.handlePeerError({ type: 'webrtc', message: 'Failed to read audio file for P2P transfer', error: err });
      };
      reader.readAsArrayBuffer(file);
    }
  }

  // BUG 3 FIX (Part B): Reassemble chunks on the guest side
  handleGuestPayload(message) {
    if (!message) return;

    // Check if message matches Bug 3 chunking payload structure
    const type = message.type || message.action;
    const payload = message.payload || message;

    if (type === 'AUDIO_CHUNK') {
      // Initialize the buffer array if it doesn't exist
      if (!this.chunkBuffer) {
        this.chunkBuffer = [];
        this.receivedChunks = 0;
      }

      const { chunkIndex, totalChunks, data, chunk } = payload;
      const rawChunk = data || chunk;
      
      // Store the incoming chunk
      if (!this.chunkBuffer[chunkIndex]) {
        this.chunkBuffer[chunkIndex] = new Uint8Array(rawChunk);
        this.receivedChunks++;
      }

      // Check if we have received every single chunk
      if (this.receivedChunks === totalChunks) {
        console.log('[Sonance] All chunks received. Reassembling file...');
        
        // Calculate the exact total byte length
        const totalLength = this.chunkBuffer.reduce((acc, val) => acc + val.length, 0);
        const combinedArray = new Uint8Array(totalLength);
        
        // Stitch the chunks together sequentially
        let offset = 0;
        for (const c of this.chunkBuffer) {
          combinedArray.set(c, offset);
          offset += c.length;
        }

        // Create the final audio Blob
        const audioBlob = new Blob([combinedArray], { type: 'audio/mpeg' }); 
        const blobUrl = URL.createObjectURL(audioBlob);
        
        // Cleanup memory
        this.chunkBuffer = null; 
        this.receivedChunks = 0;

        const remoteTrack = {
          id: `remote-${Date.now()}`,
          title: payload.metadata ? payload.metadata.title : 'Remote Party Track',
          artist: payload.metadata ? payload.metadata.artist : 'Host Audio',
          album: 'P2P Stream',
          coverArt: './assets/icons/icon.svg',
          audioUrl: blobUrl,
          url: blobUrl
        };

        // Push to EventBus so audioEngine picks it up
        this.eventBus.emit('TOAST_SHOW', 'P2P Track Received & Ready');
        this.eventBus.emit('TRACK_RECEIVED', { url: blobUrl });
        this.eventBus.emit('CURRENT_TRACK_CHANGED', remoteTrack);
      }
      return; // Exit early so we don't process this as a playback sync command
    }

    if (this.isHost) return;

    const now = Date.now();
    const latency = (now - (payload.timestamp || now)) / 1000;

    switch (type) {
      case 'PLAY_ACTION':
        this.eventBus.emit('PLAY_COMMAND');
        break;
      case 'PAUSE_ACTION':
        this.eventBus.emit('PAUSE_COMMAND');
        break;
      case 'SYNC_TIME': {
        const targetTime = payload.time + Math.max(0, latency);
        this.eventBus.emit('SEEK_COMMAND', targetTime);
        break;
      }
    }
  }

  leaveParty() {
    this.handleDisconnect('Party Session Closed');
    this.cleanupPeer();
  }
}
