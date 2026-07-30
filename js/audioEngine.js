/**
 * Sonance AudioEngine - Instant Audio Playback Pipeline & Brute-Force Output Routing
 * 
 * Pipeline Chain:
 * HTMLAudioElement (Persistent Class Instance) 
 *  -> MediaElementAudioSourceNode 
 *  -> GainNode (default 1.0) 
 *  -> 5 BiquadFilterNodes (60Hz, 250Hz, 1kHz, 4kHz, 12kHz) 
 *  -> AnalyserNode 
 *  -> AudioContext.destination (Speakers)
 */
export class AudioEngine {
  /**
   * @param {import('./eventBus.js').EventBus} eventBus 
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.audioCtx = null;
    
    // Class-level persistent Audio Element (Prevents Garbage Collection)
    this.audioElement = new Audio();

    this.sourceNode = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.eqFilters = [];

    this.isPlaying = false;
    this.isMuted = false;
    this.previousVolume = 1.0;
    this.currentTrack = null;

    // Web Worker for Background Waveform Extraction
    this.waveformWorker = null;
    this.initWaveformWorker();

    this.eqPresets = {
      flat: [0, 0, 0, 0, 0],
      rock: [4, 2, -1, 3, 5],
      pop: [-1, 2, 4, 2, -1],
      jazz: [3, 2, 0, 2, 4],
      bass: [8, 5, 1, 0, 0],
      electronic: [5, 3, 0, 2, 4],
      speech: [-3, 3, 5, 2, -2]
    };

    this.initAudioContext();
    this.bindEvents();
  }

  unlockAudioContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => {
        console.log('[Sonance] macOS/Safari AudioContext Unlocked Successfully.');
      }).catch(err => {
        console.warn('[Sonance] AudioContext unlock error:', err);
      });
    }
  }

  initWaveformWorker() {
    try {
      this.waveformWorker = new Worker(new URL('./waveformWorker.js', import.meta.url));
      this.waveformWorker.onmessage = (e) => {
        const peaksArray = e.data;
        console.log('[Waveform Debug] Background Web Worker Peak Data Received:', peaksArray ? peaksArray.length : 0);
        this.eventBus.emit('WAVEFORM_DATA_READY', peaksArray);
      };
      this.waveformWorker.onerror = (err) => {
        console.error('[Waveform Debug] Worker Execution Error:', err);
      };
    } catch (e) {
      try {
        this.waveformWorker = new Worker('./js/waveformWorker.js');
      } catch (err) {
        console.error('[Waveform Debug] Web Worker initialization failed:', err);
      }
    }
  }

  initAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.error('[Sonance Debug] Web Audio API not supported in this browser.');
      return;
    }
    this.audioCtx = new AudioContextClass();

    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.value = 1.0;

    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    const eqFrequencies = [60, 250, 1000, 4000, 12000];
    this.eqFilters = eqFrequencies.map(freq => {
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = freq <= 250 ? 'lowshelf' : freq >= 4000 ? 'highshelf' : 'peaking';
      filter.frequency.value = freq;
      filter.gain.value = 0;
      return filter;
    });

    try {
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElement);

      let current = this.sourceNode;
      current.connect(this.gainNode);
      current = this.gainNode;

      this.eqFilters.forEach(filter => {
        current.connect(filter);
        current = filter;
      });

      current.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);
      console.log('[Sonance Debug] Web Audio Graph connected to AudioContext destination.');
    } catch (e) {
      console.error('[Sonance Debug] Audio Graph Connection Failed:', e);
    }

    setTimeout(() => {
      this.eventBus.emit('ANALYSER_READY', this.analyserNode);
    }, 100);
  }

  bindEvents() {
    this.audioElement.addEventListener('timeupdate', () => {
      this.eventBus.emit('TIME_UPDATED', {
        currentTime: this.audioElement.currentTime,
        duration: this.audioElement.duration || 0
      });
    });

    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      this.eventBus.emit('PLAYSTATE_CHANGED', { isPlaying: false });
      this.eventBus.emit('TRACK_ENDED');
    });

    this.audioElement.addEventListener('pause', () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.eventBus.emit('PLAYSTATE_CHANGED', { isPlaying: false });
      }
    });

    this.audioElement.addEventListener('playing', () => {
      this.isPlaying = true;
      this.eventBus.emit('PLAYSTATE_CHANGED', { isPlaying: true });
    });

    this.eventBus.on('UNLOCK_AUDIO', () => this.unlockAudioContext());
    this.eventBus.on('TRACK_INITIALIZED', (trackObject) => {
      this.setTrackSourceOnly(trackObject);
      this.generateWaveform(trackObject ? trackObject.originalFile : null);
    });

    this.eventBus.on('CURRENT_TRACK_CHANGED', (trackObject) => {
      this.loadAndPlayTrack(trackObject);
    });

    this.eventBus.on('PLAY_COMMAND', () => this.play());
    this.eventBus.on('PAUSE_COMMAND', () => this.pause());
    this.eventBus.on('SEEK_COMMAND', (time) => this.seek(time));

    this.eventBus.on('VOLUME_CHANGE_COMMAND', (val) => this.setVolumeRamp(val));
    this.eventBus.on('MUTE_TOGGLE_COMMAND', () => this.toggleMute());

    this.eventBus.on('EQ_CHANGE_COMMAND', ({ bandIndex, value }) => this.setEQ(bandIndex, value));
    this.eventBus.on('EQ_PRESET_COMMAND', (presetName) => this.applyPreset(presetName));
  }

  setTrackSourceOnly(trackObject) {
    if (!trackObject || !trackObject.audioUrl) return;
    this.currentTrack = trackObject;
    this.audioElement.src = trackObject.audioUrl;
  }

  async loadAndPlayTrack(trackObject) {
    if (!trackObject || !trackObject.audioUrl) return;
    this.currentTrack = trackObject;
    console.log(`[Sonance Debug] Loading Track: "${trackObject.title}"`);
    
    this.audioElement.src = trackObject.audioUrl;
    this.play();

    this.generateWaveform(trackObject.originalFile);
  }

  async generateWaveform(file) {
    if (!file || !this.waveformWorker || !this.audioCtx) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          if (!arrayBuffer) return;

          const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
          const channelData = audioBuffer.getChannelData(0);

          this.waveformWorker.postMessage({ channelData, samples: 200 }, [channelData.buffer]);
        } catch (decodeErr) {
          console.error('[Waveform Debug] decodeAudioData Failed:', decodeErr);
        }
      };
      reader.onerror = (readerErr) => {
        console.error('[Waveform Debug] FileReader Failed:', readerErr);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('[Waveform Debug] Failed:', err);
    }
  }

  /**
   * Brute-forces AudioContext wake and GainNode output levels before playback
   */
  async play() {
    try {
      if (this.audioCtx && this.audioCtx.state !== 'running') {
        console.log('[Sonance] Forcing AudioContext resume...');
        await this.audioCtx.resume();
      }
      
      // Brute-force hardware and virtual volumes to prevent 0-gain silence traps
      this.audioElement.volume = 1.0;
      if (this.gainNode && this.audioCtx) {
        this.gainNode.gain.setTargetAtTime(1.0, this.audioCtx.currentTime, 0.01);
      }

      await this.audioElement.play();
      console.log('[Sonance] Playback executing.');
      this.isPlaying = true;
      this.eventBus.emit('PLAYSTATE_CHANGED', { isPlaying: true });
    } catch (error) {
      console.error('[Sonance Debug] Playback Failed:', error);
      this.isPlaying = false;
      this.eventBus.emit('PLAYSTATE_CHANGED', { isPlaying: false });
    }
  }

  pause() {
    this.audioElement.pause();
    this.isPlaying = false;
    this.eventBus.emit('PLAYSTATE_CHANGED', { isPlaying: false });
  }

  seek(time) {
    if (!isNaN(time) && isFinite(time)) {
      this.audioElement.currentTime = time;
    }
  }

  setVolumeRamp(val) {
    const volume = Math.max(0, Math.min(1, val));
    this.isMuted = volume === 0;

    if (this.gainNode && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(volume, now + 0.04);
    } else {
      this.audioElement.volume = volume;
    }

    this.eventBus.emit('VOLUME_UPDATED', volume);
  }

  toggleMute() {
    const currentVol = this.gainNode ? this.gainNode.gain.value : this.audioElement.volume;
    if (this.isMuted || currentVol === 0) {
      this.setVolumeRamp(this.previousVolume || 1.0);
      this.eventBus.emit('TOAST_SHOW', 'Unmuted');
    } else {
      this.previousVolume = currentVol;
      this.setVolumeRamp(0);
      this.eventBus.emit('TOAST_SHOW', 'Muted');
    }
  }

  setEQ(bandIndex, value) {
    if (this.eqFilters[bandIndex]) {
      this.eqFilters[bandIndex].gain.value = value;
    }
  }

  applyPreset(presetName) {
    const presetKey = presetName.toLowerCase();
    const gains = this.eqPresets[presetKey];
    if (gains) {
      gains.forEach((gain, index) => this.setEQ(index, gain));
      this.eventBus.emit('EQ_UPDATED', gains);
      this.eventBus.emit('TOAST_SHOW', `EQ Preset: ${presetName.toUpperCase()}`);
    }
  }
}
