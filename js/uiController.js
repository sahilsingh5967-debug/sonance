/**
 * Sonance UIController - SoundCloud-Style Static Waveform Scrubber & Clickable Host ID Badge
 */
export class UIController {
  /**
   * @param {import('./eventBus.js').EventBus} eventBus 
   */
  constructor(eventBus) {
    this.eventBus = eventBus;

    // Transport UI Elements
    this.btnPlayPause = document.getElementById('btn-play-pause');
    this.iconPlay = document.getElementById('icon-play');
    this.iconPause = document.getElementById('icon-pause');
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');

    // File Input & Triggers
    this.fileImportInput = document.getElementById('file-import');
    this.btnImportLeft = document.getElementById('btn-import-left');
    this.btnImportTab = document.getElementById('btn-import-tab');

    this.vinylContainer = document.getElementById('vinyl-container');
    this.vinylArtwork = document.getElementById('vinyl-artwork');
    this.dynamicBg = document.getElementById('dynamic-bg');

    this.trackTitle = document.getElementById('track-title');
    this.trackArtist = document.getElementById('track-artist');
    this.currentTimeDisplay = document.getElementById('current-time');
    this.durationDisplay = document.getElementById('duration');

    // Waveform Scrubber Canvas
    this.waveformCanvas = document.getElementById('waveform-scrubber');
    this.waveformCtx = this.waveformCanvas ? this.waveformCanvas.getContext('2d') : null;
    this.currentTimeSec = 0;
    this.durationSec = 0;
    this.peaksArray = null;

    this.partyBadge = document.getElementById('party-badge');
    this.badgeP2P = document.getElementById('badge-p2p');
    this.libraryContainer = document.getElementById('library-container');

    this.toastElement = document.getElementById('toast-notification');
    this.paletteOverlay = document.getElementById('command-palette');
    this.paletteInput = document.getElementById('palette-input');

    this.volumeKnob = document.getElementById('volume-knob');

    this.currentQueue = [];
    this.currentTrackId = null;
    this.partyRole = 'standalone';
    this.currentHostId = null;

    this.colorThief = (typeof window.ColorThief !== 'undefined') ? new window.ColorThief() : null;

    this.initWaveformCanvas();
    this.bindSubsystemTabs();
    this.bindFileTriggers();
    this.bindTransportEvents();
    this.bindAudioControls();
    this.bindShortcuts();
    this.bindCommandPalette();
    this.bindPartyBadgeCopy();
    this.listenToBus();
  }

  initWaveformCanvas() {
    if (!this.waveformCanvas) return;
    this.resizeWaveform();
    window.addEventListener('resize', () => this.resizeWaveform());

    this.waveformCanvas.addEventListener('click', (e) => {
      if (this.partyRole === 'guest' || !this.durationSec) return;
      const rect = this.waveformCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = clickX / rect.width;
      const targetTime = ratio * this.durationSec;
      this.eventBus.emit('SEEK_COMMAND', targetTime);
    });

    this.drawWaveform();
  }

  resizeWaveform() {
    if (!this.waveformCanvas) return;
    this.waveformCanvas.width = this.waveformCanvas.clientWidth * window.devicePixelRatio;
    this.waveformCanvas.height = this.waveformCanvas.clientHeight * window.devicePixelRatio;
    this.drawWaveform();
  }

  drawWaveform() {
    if (!this.waveformCtx || !this.waveformCanvas) return;
    const w = this.waveformCanvas.width;
    const h = this.waveformCanvas.height;

    this.waveformCtx.clearRect(0, 0, w, h);

    const peaks = this.peaksArray;
    const barCount = (peaks && peaks.length > 0) ? peaks.length : 120;
    const barWidth = (w / barCount) * 0.6;
    const gap = (w / barCount) * 0.4;
    const progressRatio = this.durationSec ? (this.currentTimeSec / this.durationSec) : 0;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + gap);
      
      let peakVal = 0.4;
      if (peaks && peaks[i] !== undefined) {
        peakVal = peaks[i];
      } else {
        peakVal = Math.abs(Math.sin((i / barCount) * Math.PI) * 0.7 + (Math.sin(i * 1.5) * 0.3));
      }

      const barHeight = Math.max(6, peakVal * (h * 0.85));
      const y = (h - barHeight) / 2;

      const barRatio = i / barCount;

      if (barRatio <= progressRatio) {
        const grad = this.waveformCtx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#8b5cf6');
        grad.addColorStop(1, '#6366f1');
        this.waveformCtx.fillStyle = grad;
      } else {
        this.waveformCtx.fillStyle = '#262626';
      }

      this.waveformCtx.beginPath();
      if (this.waveformCtx.roundRect) {
        this.waveformCtx.roundRect(x, y, barWidth, barHeight, 2);
      } else {
        this.waveformCtx.fillRect(x, y, barWidth, barHeight);
      }
      this.waveformCtx.fill();
    }
  }

  bindSubsystemTabs() {
    document.querySelectorAll('.aur-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.aur-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.aur-tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.dataset.tab;
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');
      });
    });
  }

  bindFileTriggers() {
    const triggerFile = () => {
      if (this.fileImportInput) this.fileImportInput.click();
    };

    if (this.btnImportLeft) this.btnImportLeft.addEventListener('click', triggerFile);
    if (this.btnImportTab) this.btnImportTab.addEventListener('click', triggerFile);

    if (this.fileImportInput) {
      this.fileImportInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('audio/'));
        if (files.length > 0) {
          this.eventBus.emit('FILES_DROPPED', files);
        }
        this.fileImportInput.value = '';
      });
    }

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      window.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });

    window.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        const files = Array.from(dt.files).filter(f => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|flac|ogg|m4a)$/i));
        if (files.length > 0) {
          this.eventBus.emit('FILES_DROPPED', files);
        }
      }
    });
  }

  bindTransportEvents() {
    if (this.btnPlayPause) {
      this.btnPlayPause.addEventListener('click', () => {
        if (this.partyRole === 'guest') {
          this.showToast('Guest mode: Host dictates playback state');
          return;
        }
        const isPlaying = this.vinylContainer.classList.contains('spinning');
        this.eventBus.emit(isPlaying ? 'PAUSE_COMMAND' : 'PLAY_COMMAND');
      });
    }

    if (this.btnPrev) {
      this.btnPrev.addEventListener('click', () => {
        if (this.partyRole === 'guest') return;
        this.eventBus.emit('PREV_TRACK_COMMAND');
      });
    }
    if (this.btnNext) {
      this.btnNext.addEventListener('click', () => {
        if (this.partyRole === 'guest') return;
        this.eventBus.emit('NEXT_TRACK_COMMAND');
      });
    }

    const hostBtn = document.getElementById('btn-party-host');
    const joinBtn = document.getElementById('btn-party-join');

    if (hostBtn) hostBtn.addEventListener('click', () => this.eventBus.emit('START_PARTY_HOST'));
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        const hostId = prompt('Enter Host Room ID:');
        if (hostId && hostId.trim()) {
          this.eventBus.emit('JOIN_PARTY_GUEST', hostId.trim());
        }
      });
    }
  }

  bindPartyBadgeCopy() {
    if (!this.partyBadge) return;
    this.partyBadge.addEventListener('click', () => {
      if (this.currentHostId) {
        navigator.clipboard.writeText(this.currentHostId).then(() => {
          this.eventBus.emit('TOAST_SHOW', 'Host ID copied to clipboard!');
        }).catch(() => {
          this.eventBus.emit('TOAST_SHOW', `Host ID: ${this.currentHostId}`);
        });
      } else {
        this.eventBus.emit('START_PARTY_HOST');
      }
    });
  }

  bindAudioControls() {
    if (this.volumeKnob) {
      this.volumeKnob.addEventListener('input', (e) => {
        const normalizedVal = parseFloat(e.target.value) / 100;
        this.eventBus.emit('VOLUME_CHANGE_COMMAND', normalizedVal);
      });
    }

    const eqInputs = document.querySelectorAll('.aur-knob-input[min="-12"]');
    eqInputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.eventBus.emit('EQ_CHANGE_COMMAND', { bandIndex: index, value: val });
      });
    });

    document.querySelectorAll('[data-eq-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-eq-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.eventBus.emit('EQ_PRESET_COMMAND', btn.dataset.eqPreset);
      });
    });

    document.querySelectorAll('[data-vis-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-vis-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.eventBus.emit('VISUALIZER_MODE_CHANGED', btn.dataset.visMode);
      });
    });
  }

  bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (this.partyRole === 'guest') return;
        const isPlaying = this.vinylContainer.classList.contains('spinning');
        this.eventBus.emit(isPlaying ? 'PAUSE_COMMAND' : 'PLAY_COMMAND');
      } else if (e.code === 'ArrowRight' && !e.ctrlKey) {
        if (this.partyRole === 'guest') return;
        this.eventBus.emit('SEEK_COMMAND', this.currentTimeSec + 5);
      } else if (e.code === 'ArrowLeft' && !e.ctrlKey) {
        if (this.partyRole === 'guest') return;
        this.eventBus.emit('SEEK_COMMAND', Math.max(0, this.currentTimeSec - 5));
      } else if (e.code === 'ArrowRight' && e.ctrlKey) {
        if (this.partyRole === 'guest') return;
        this.eventBus.emit('NEXT_TRACK_COMMAND');
      } else if (e.code === 'ArrowLeft' && e.ctrlKey) {
        if (this.partyRole === 'guest') return;
        this.eventBus.emit('PREV_TRACK_COMMAND');
      } else if (e.code === 'KeyM') {
        this.eventBus.emit('MUTE_TOGGLE_COMMAND');
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyP') {
        e.preventDefault();
        this.toggleCommandPalette();
      } else if (e.code === 'Escape') {
        this.closeCommandPalette();
      }
    });
  }

  bindCommandPalette() {
    if (!this.paletteOverlay) return;

    this.paletteOverlay.addEventListener('click', (e) => {
      if (e.target === this.paletteOverlay) this.closeCommandPalette();
    });

    document.querySelectorAll('[data-command]').forEach(item => {
      item.addEventListener('click', () => {
        this.executeCommand(item.dataset.command);
        this.closeCommandPalette();
      });
    });
  }

  toggleCommandPalette() {
    if (!this.paletteOverlay) return;
    this.paletteOverlay.classList.toggle('open');
    if (this.paletteOverlay.classList.contains('open') && this.paletteInput) {
      this.paletteInput.focus();
    }
  }

  closeCommandPalette() {
    if (this.paletteOverlay) {
      this.paletteOverlay.classList.remove('open');
    }
  }

  executeCommand(cmd) {
    switch (cmd) {
      case 'toggle-play': {
        if (this.partyRole === 'guest') return;
        const isPlaying = this.vinylContainer.classList.contains('spinning');
        this.eventBus.emit(isPlaying ? 'PAUSE_COMMAND' : 'PLAY_COMMAND');
        break;
      }
      case 'next':
        if (this.partyRole === 'guest') return;
        this.eventBus.emit('NEXT_TRACK_COMMAND');
        break;
      case 'prev':
        if (this.partyRole === 'guest') return;
        this.eventBus.emit('PREV_TRACK_COMMAND');
        break;
    }
  }

  listenToBus() {
    this.eventBus.on('WAVEFORM_DATA_READY', (peaksArray) => {
      this.peaksArray = peaksArray;
      this.drawWaveform();
    });

    this.eventBus.on('PARTY_STATUS_UPDATED', ({ role, peerId, fullPeerId, status }) => {
      this.partyRole = role;
      this.currentHostId = fullPeerId || peerId || null;
      
      if (this.partyBadge) {
        const textSpan = this.partyBadge.querySelector('span');
        if (textSpan) textSpan.innerText = status || (role === 'host' ? 'Host' : role === 'guest' ? 'Guest' : 'Remote Party');
        if (role !== 'standalone') {
          this.partyBadge.classList.add('connected');
        } else {
          this.partyBadge.classList.remove('connected');
        }
      }

      if (this.badgeP2P) {
        if (role === 'host' || role === 'guest') {
          this.badgeP2P.innerText = `P2P ${role.toUpperCase()} LIVE`;
          this.badgeP2P.classList.add('aur-badge-live');
        } else {
          this.badgeP2P.innerText = 'Standalone';
          this.badgeP2P.classList.remove('aur-badge-live');
        }
      }
    });

    this.eventBus.on('CURRENT_TRACK_CHANGED', (track) => {
      if (!track) return;
      this.currentTrackId = track.id;
      this.peaksArray = null;
      this.trackTitle.innerText = track.title || 'Unknown Track';
      this.trackArtist.innerText = track.artist || 'Local Audio Track';

      const coverSrc = track.coverArt || track.artwork || './assets/icons/icon.svg';
      this.vinylArtwork.src = coverSrc;
      if (this.dynamicBg) {
        this.dynamicBg.style.backgroundImage = `url('${coverSrc}')`;
      }

      this.updateDynamicTheme(coverSrc);
      this.renderLibrary();
      this.drawWaveform();
    });

    this.eventBus.on('PLAYSTATE_CHANGED', ({ isPlaying }) => {
      if (isPlaying) {
        this.vinylContainer.classList.add('spinning');
        this.iconPlay.classList.add('hidden');
        this.iconPause.classList.remove('hidden');
      } else {
        this.vinylContainer.classList.remove('spinning');
        this.iconPlay.classList.remove('hidden');
        this.iconPause.classList.add('hidden');
      }
    });

    this.eventBus.on('TIME_UPDATED', ({ currentTime, duration }) => {
      this.currentTimeSec = currentTime;
      this.durationSec = duration;
      this.currentTimeDisplay.innerText = this.formatTime(currentTime);
      this.durationDisplay.innerText = this.formatTime(duration);
      this.drawWaveform();
    });

    this.eventBus.on('VOLUME_UPDATED', (normalizedVol) => {
      if (this.volumeKnob) {
        this.volumeKnob.value = Math.round(normalizedVol * 100);
      }
    });

    this.eventBus.on('EQ_UPDATED', (gainsArray) => {
      const eqInputs = document.querySelectorAll('.aur-knob-input[min="-12"]');
      eqInputs.forEach((input, idx) => {
        if (gainsArray[idx] !== undefined) {
          input.value = gainsArray[idx];
        }
      });
    });

    this.eventBus.on('QUEUE_UPDATED', (queue) => {
      this.currentQueue = queue;
      this.renderLibrary();
    });

    this.eventBus.on('TOAST_SHOW', (message) => this.showToast(message));
  }

  updateDynamicTheme(coverSrc) {
    if (!coverSrc || coverSrc.endsWith('icon.svg')) {
      document.documentElement.style.setProperty('--dynamic-glow', 'rgba(139, 92, 246, 0.12)');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        if (this.colorThief) {
          const [r, g, b] = this.colorThief.getColor(img);
          document.documentElement.style.setProperty('--dynamic-glow', `rgba(${r}, ${g}, ${b}, 0.14)`);
        } else {
          document.documentElement.style.setProperty('--dynamic-glow', 'rgba(139, 92, 246, 0.12)');
        }
      } catch (err) {
        document.documentElement.style.setProperty('--dynamic-glow', 'rgba(139, 92, 246, 0.12)');
      }
    };
    img.onerror = () => {
      document.documentElement.style.setProperty('--dynamic-glow', 'rgba(139, 92, 246, 0.12)');
    };
    img.src = coverSrc;
  }

  renderLibrary() {
    if (!this.libraryContainer) return;
    this.libraryContainer.innerHTML = '';

    if (!this.currentQueue || this.currentQueue.length === 0) {
      this.libraryContainer.innerHTML = `
        <div class="empty-queue-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 160px; text-align: center; opacity: 0.7; padding: 24px 12px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="1.5" style="margin-bottom: 12px;">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          <p style="font-family: var(--font-brand); font-size: 14px; color: #F5F5F5; margin-bottom: 4px; font-weight: 600;">Queue is empty</p>
          <p style="font-family: var(--font-body); font-size: 13px; color: var(--aur-text-muted);">Import or drag-and-drop tracks to begin</p>
        </div>
      `;
      return;
    }

    this.currentQueue.forEach((track) => {
      const card = document.createElement('div');
      card.className = `aur-track-card ${track.id === this.currentTrackId ? 'active' : ''}`;

      const coverSrc = track.coverArt || track.artwork;
      const firstChar = (track.title || 'A').charAt(0).toUpperCase();

      const artHtml = coverSrc ? 
        `<img class="aur-track-thumb" src="${coverSrc}" alt="${track.title}">` :
        `<div class="aur-fallback-art">${firstChar}</div>`;

      const formattedDuration = this.formatTime(track.duration || 0);

      card.innerHTML = `
        ${artHtml}
        <div class="aur-track-meta">
          <span class="aur-track-name">${track.title}</span>
          <span class="aur-track-artist-sub">${track.artist || 'Unknown Artist'}</span>
        </div>
        <span style="font-family: var(--font-oled); font-size: 0.75rem; color: var(--aur-text-muted);">${formattedDuration}</span>
      `;

      card.addEventListener('click', () => {
        if (this.partyRole === 'guest') {
          this.showToast('Guest mode: Host dictates track selection');
          return;
        }
        this.eventBus.emit('TRACK_SELECTED', track.id);
      });

      this.libraryContainer.appendChild(card);
    });
  }

  showToast(message) {
    if (!this.toastElement) return;
    this.toastElement.innerText = message;
    this.toastElement.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastElement.classList.remove('show');
    }, 2400);
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds === 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
