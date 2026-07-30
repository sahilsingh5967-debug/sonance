/**
 * Sonance PartySync - WebRTC PeerJS Remote Party Synchronization & Full Host ID Sharing
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

    // P2P File Transfer on Track Change
    this.eventBus.on('CURRENT_TRACK_CHANGED', (trackObject) => {
      if (this.isHost && trackObject && trackObject.originalFile) {
        this.transferAudioFile(trackObject);
      }
    });
  }

  startHostSession() {
    if (typeof window.Peer === 'undefined') {
      this.eventBus.emit('TOAST_SHOW', 'PeerJS Library Not Loaded');
      return;
    }

    this.isHost = true;
    this.peer = new window.Peer();

    this.peer.on('open', (peerId) => {
      this.fullPeerId = peerId;
      console.log('[PartySync Host] Full Peer ID Created:', peerId);
      this.eventBus.emit('PARTY_STATUS_UPDATED', {
        role: 'host',
        peerId,
        fullPeerId: peerId,
        status: `Host (ID: ${peerId})`
      });
      this.eventBus.emit('TOAST_SHOW', `Host Room ID Created! Click badge to copy.`);
    });

    this.peer.on('connection', (conn) => {
      this.activeConnection = conn;
      console.log('[PartySync Host] Guest Connected');
      this.setupConnectionHandlers();
      this.eventBus.emit('PARTY_STATUS_UPDATED', {
        role: 'host',
        peerId: this.peer.id,
        fullPeerId: this.peer.id,
        status: `Host (Connected)`
      });
      this.eventBus.emit('TOAST_SHOW', 'Remote Party Guest Connected!');
    });

    this.peer.on('disconnected', () => {
      this.handleDisconnect('Host Peer Disconnected');
    });

    this.peer.on('error', (err) => {
      console.warn('[PartySync Host Error]', err);
      this.eventBus.emit('TOAST_SHOW', 'PeerJS Error: ' + err.message);
    });
  }

  joinGuestSession(hostId) {
    if (!hostId || typeof window.Peer === 'undefined') return;

    this.isHost = false;
    this.peer = new window.Peer();

    this.peer.on('open', () => {
      console.log('[PartySync Guest] Connecting to Host:', hostId);
      this.activeConnection = this.peer.connect(hostId);
      this.setupConnectionHandlers();
      this.eventBus.emit('PARTY_STATUS_UPDATED', {
        role: 'guest',
        peerId: hostId,
        fullPeerId: hostId,
        status: 'Connecting to Host...'
      });
    });

    this.peer.on('disconnected', () => {
      this.handleDisconnect('Host Disconnected');
    });

    this.peer.on('error', (err) => {
      console.warn('[PartySync Guest Error]', err);
      this.eventBus.emit('TOAST_SHOW', 'Failed to connect to Host ID');
    });
  }

  setupConnectionHandlers() {
    if (!this.activeConnection) return;

    this.activeConnection.on('open', () => {
      console.log('[PartySync] WebRTC Connection Active');
      if (!this.isHost) {
        this.eventBus.emit('PARTY_STATUS_UPDATED', {
          role: 'guest',
          peerId: this.activeConnection.peer,
          fullPeerId: this.activeConnection.peer,
          status: 'Connected (Live P2P)'
        });
        this.eventBus.emit('TOAST_SHOW', 'Connected to Host Party!');
      }
    });

    this.activeConnection.on('data', (payload) => {
      this.handleGuestPayload(payload);
    });

    this.activeConnection.on('close', () => {
      this.handleDisconnect('Host Disconnected');
    });

    this.activeConnection.on('error', (err) => {
      this.handleDisconnect('Party Disconnected');
    });
  }

  handleDisconnect(reasonMessage) {
    this.activeConnection = null;
    this.isHost = false;
    this.fullPeerId = null;
    this.eventBus.emit('PARTY_STATUS_UPDATED', {
      role: 'standalone',
      status: reasonMessage || 'Standalone'
    });
    this.eventBus.emit('TOAST_SHOW', reasonMessage || 'Party Connection Dropped');
  }

  broadcastPayload(payload) {
    if (this.isHost && this.activeConnection && this.activeConnection.open) {
      this.activeConnection.send(payload);
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
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
