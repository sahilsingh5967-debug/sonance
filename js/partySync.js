/**
 * Sonance PartySync - Production-Grade Resilient WebRTC PeerJS Networking Layer
 * 
 * Handles full PeerJS lifecycle events, reconnection logic, and comprehensive error mapping:
 * - Peer Events: open, connection, error, close, disconnected
 * - Connection Events: open, data, close, error
 * - Error Types: network, peer-unavailable, server-error, socket-error, webrtc, 
 *                browser-incompatible, ssl-unavailable, unavailable-id, invalid-id
 */
export class PartySync {
  /**
   * @param {import('./eventBus.js').EventBus} eventBus 
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.peer = null;
    this.activeConnection = null;
    this.isHost = false;
    this.fullPeerId = null;
    this.lastTimeBroadcast = 0;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;

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

  /**
   * Attaches handlers for all PeerJS lifecycle events: open, connection, error, close, disconnected
   * @param {'host'|'guest'} role 
   * @param {string} [targetHostId] 
   */
  attachPeerLifecycleListeners(role, targetHostId = null) {
    if (!this.peer) return;

    // 1. peer.on("open")
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
        console.log(`[PartySync GUEST] Connecting to Host ID: ${targetHostId}`);
        this.eventBus.emit('PARTY_STATUS_UPDATED', {
          role: 'guest',
          peerId: targetHostId,
          fullPeerId: targetHostId,
          status: 'Connecting to Host...'
        });

        try {
          const conn = this.peer.connect(targetHostId, { reliable: true });
          this.setupConnectionHandlers(conn);
        } catch (err) {
          this.handlePeerError({ type: 'webrtc', message: `Could not initiate connection to ${targetHostId}`, error: err });
        }
      }
    });

    // 2. peer.on("connection") - Incoming Host connections
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

    // 3. peer.on("disconnected") - Signaling socket loss
    this.peer.on('disconnected', () => {
      console.warn(`[PartySync ${role.toUpperCase()}] Peer Disconnected from signaling server.`);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts && this.peer && !this.peer.destroyed) {
        this.reconnectAttempts++;
        console.log(`[PartySync] Attempting signaling server reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        try {
          this.peer.reconnect();
        } catch (err) {
          console.error('[PartySync] Reconnect attempt failed:', err);
        }
      } else {
        this.handlePeerError({ type: 'network', message: 'Signaling server connection lost permanently.' });
        this.handleDisconnect('Host Disconnected');
      }
    });

    // 4. peer.on("close") - Peer destroyed
    this.peer.on('close', () => {
      console.log(`[PartySync ${role.toUpperCase()}] Peer session closed.`);
      this.handleDisconnect('Party Session Closed');
    });

    // 5. peer.on("error") - Peer error dispatcher
    this.peer.on('error', (err) => {
      this.handlePeerError(err);
    });
  }

  /**
   * Attaches handlers for DataConnection lifecycle events: open, data, close, error
   * @param {import('peerjs').DataConnection} conn 
   */
  setupConnectionHandlers(conn) {
    if (!conn) return;
    this.activeConnection = conn;

    // 1. connection.on("open")
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

    // 2. connection.on("data")
    conn.on('data', (payload) => {
      this.handleGuestPayload(payload);
    });

    // 3. connection.on("close")
    conn.on('close', () => {
      console.log(`[PartySync P2P Channel] Closed with Peer: ${conn.peer}`);
      this.handleDisconnect(this.isHost ? 'Guest Disconnected' : 'Host Disconnected');
    });

    // 4. connection.on("error")
    conn.on('error', (err) => {
      console.error(`[PartySync P2P Channel Error] Peer: ${conn.peer}`, err);
      this.handlePeerError({ type: 'webrtc', message: 'WebRTC P2P Data Channel Error', error: err });
      this.handleDisconnect('Party Data Channel Error');
    });
  }

  /**
   * Maps and handles ALL major PeerJS error codes cleanly
   * @param {Object} err 
   */
  handlePeerError(err) {
    const errorType = err ? (err.type || 'unknown') : 'unknown';
    let readableMessage = 'A WebRTC network error occurred.';

    switch (errorType) {
      case 'network':
        readableMessage = 'Network connection to PeerServer lost or failed.';
        break;
      case 'peer-unavailable':
        readableMessage = 'Host Room ID is invalid, closed, or unavailable.';
        break;
      case 'server-error':
        readableMessage = 'PeerServer encountered an internal error.';
        break;
      case 'socket-error':
        readableMessage = 'WebSocket connection to PeerServer failed.';
        break;
      case 'webrtc':
        readableMessage = 'WebRTC ICE candidate or STUN negotiation failed.';
        break;
      case 'browser-incompatible':
        readableMessage = 'WebRTC Data Channel is incompatible with this browser.';
        break;
      case 'ssl-unavailable':
        readableMessage = 'PeerServer SSL/HTTPS configuration is unavailable.';
        break;
      case 'unavailable-id':
        readableMessage = 'Requested Peer ID is already in use by another session.';
        break;
      case 'invalid-id':
        readableMessage = 'Provided Host Room ID contains invalid characters.';
        break;
      default:
        readableMessage = err.message || 'An unexpected PeerJS networking error occurred.';
        break;
    }

    console.error(`[PartySync Network Error] Type: "${errorType}" | Message: ${readableMessage}`, err);

    // 1. Emit EventBus NETWORK_ERROR event
    this.eventBus.emit('NETWORK_ERROR', {
      type: errorType,
      message: readableMessage,
      error: err
    });

    // 2. Trigger user Toast notification
    this.eventBus.emit('TOAST_SHOW', readableMessage);
  }

  handleDisconnect(reasonMessage) {
    this.activeConnection = null;
    this.isHost = false;
    this.fullPeerId = null;
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
    }

    if (this.peer) {
      try {
        this.peer.off();
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
  }

  broadcastPayload(payload) {
    if (this.isHost && this.activeConnection && this.activeConnection.open) {
      try {
        this.activeConnection.send(payload);
      } catch (err) {
        this.handlePeerError({ type: 'webrtc', message: 'Failed to broadcast WebRTC payload', error: err });
      }
    }
  }

  transferAudioFile(trackObject) {
    if (!this.activeConnection || !this.activeConnection.open) return;

    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      console.log('[PartySync Host] Sending P2P Audio File Buffer...');
      this.broadcastPayload({
        action: 'NEW_TRACK',
        metadata: {
          title: trackObject.title,
          artist: trackObject.artist,
          album: trackObject.album
        },
        fileBuffer: buffer
      });
    };
    reader.onerror = (err) => {
      this.handlePeerError({ type: 'webrtc', message: 'Failed to read audio file for P2P transfer', error: err });
    };
    reader.readAsArrayBuffer(trackObject.originalFile);
  }

  handleGuestPayload(payload) {
    if (this.isHost || !payload) return;

    const now = Date.now();
    const latency = (now - (payload.timestamp || now)) / 1000;

    switch (payload.action) {
      case 'PLAY_ACTION':
        this.eventBus.emit('PLAY_COMMAND');
        break;
      case 'PAUSE_ACTION':
        this.eventBus.emit('PAUSE_COMMAND');
        break;
      case 'SYNC_TIME':
        const targetTime = payload.time + Math.max(0, latency);
        this.eventBus.emit('SEEK_COMMAND', targetTime);
        break;
      case 'NEW_TRACK':
        this.eventBus.emit('TOAST_SHOW', `Receiving P2P Track: ${payload.metadata.title}`);
        const blob = new Blob([payload.fileBuffer], { type: 'audio/mp3' });
        const objectUrl = URL.createObjectURL(blob);
        const remoteTrack = {
          id: `remote-${Date.now()}`,
          title: payload.metadata.title || 'Remote Party Track',
          artist: payload.metadata.artist || 'Host Audio',
          album: payload.metadata.album || 'P2P Stream',
          coverArt: './assets/icons/icon.svg',
          audioUrl: objectUrl
        };
        this.eventBus.emit('CURRENT_TRACK_CHANGED', remoteTrack);
        break;
    }
  }

  leaveParty() {
    this.handleDisconnect('Party Session Closed');
    this.cleanupPeer();
  }
}
