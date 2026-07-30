/**
 * Sonance Playlist - Data Ingestion & Dynamic Demo Track Ingestion Engine
 * 
 * Fetches local MP3 blobs from assets/audio/ and passes them to handleFiles()
 * to extract true ID3 tags via jsmediatags.
 */
export class Playlist {
  /**
   * @param {import('./eventBus.js').EventBus} eventBus 
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.queue = [];
    this.currentIndex = -1;
    this.objectUrls = new Set();

    this.bindEvents();
    this.loadDemoTracks();
  }

  bindEvents() {
    this.eventBus.on('FILES_DROPPED', (files) => this.handleFiles(files));
    this.eventBus.on('TRACK_SELECTED', (trackId) => this.selectTrackById(trackId));
    this.eventBus.on('NEXT_TRACK_COMMAND', () => this.nextTrack());
    this.eventBus.on('PREV_TRACK_COMMAND', () => this.previousTrack());
    this.eventBus.on('TRACK_ENDED', () => this.nextTrack());
    this.eventBus.on('CLEAR_QUEUE', () => this.clearQueue());
  }

  /**
   * Dynamically fetches local demo MP3 files, converts them to File objects,
   * and routes them through handleFiles() to extract real ID3 tags.
   */
  async loadDemoTracks() {
    const filenames = ['1.mp3', '2.mp3', '3.mp3', '4.mp3', '5.mp3'];
    const fetchedFiles = [];

    for (const name of filenames) {
      try {
        const response = await fetch(`./assets/audio/${name}`);
        if (!response.ok) continue;
        
        const blob = await response.blob();
        const file = new File([blob], name, { type: 'audio/mpeg' });
        fetchedFiles.push(file);
      } catch (error) {
        console.warn(`[Sonance] Could not load demo track: ${name}`, error);
      }
    }

    if (fetchedFiles.length > 0) {
      console.log(`[Sonance] Dynamically ingesting ${fetchedFiles.length} demo track(s) through ID3 parser...`);
      await this.handleFiles(fetchedFiles);
    }
  }

  async handleFiles(files) {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    this.eventBus.emit('TOAST_SHOW', `Ingesting ${fileArray.length} track(s)...`);
    const newTracks = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        const track = await this.parseFile(file, i);
        newTracks.push(track);
      } catch (err) {
        console.warn(`[Playlist Ingestion Error] "${file.name}":`, err);
      }
    }

    const wasEmpty = this.queue.length === 0;
    this.queue.push(...newTracks);

    if (wasEmpty && this.queue.length > 0) {
      this.currentIndex = 0;
      this.eventBus.emit('TRACK_INITIALIZED', this.queue[0]);
    }

    this.eventBus.emit('QUEUE_UPDATED', this.queue);
    this.eventBus.emit('TOAST_SHOW', `Loaded ${newTracks.length} track(s)`);
  }

  async parseFile(file, index) {
    const audioUrl = URL.createObjectURL(file);
    this.objectUrls.add(audioUrl);

    const duration = await this.getAudioDuration(audioUrl);
    const tags = await this.extractID3Tags(file);

    const fallbackTitle = file.name.replace(/\.[^/.]+$/, "");
    const title = (tags && tags.title) ? tags.title.trim() : fallbackTitle;
    const artist = (tags && tags.artist) ? tags.artist.trim() : 'Local Audio Track';
    const album = (tags && tags.album) ? tags.album.trim() : 'Local Collection';
    const coverArt = (tags && tags.coverArt) ? tags.coverArt : './assets/icons/icon.svg';

    return {
      id: `track-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 6)}`,
      title,
      artist,
      album,
      duration,
      coverArt,
      audioUrl,
      originalFile: file
    };
  }

  extractID3Tags(file) {
    return new Promise((resolve) => {
      if (!window.jsmediatags) {
        resolve(null);
        return;
      }

      window.jsmediatags.read(file, {
        onSuccess: (tag) => {
          const tags = tag.tags || {};
          let coverArt = null;

          if (tags.picture) {
            const { data, format } = tags.picture;
            let base64String = "";
            for (let i = 0; i < data.length; i++) {
              base64String += String.fromCharCode(data[i]);
            }
            coverArt = `data:${format};base64,${window.btoa(base64String)}`;
          }

          resolve({
            title: tags.title,
            artist: tags.artist,
            album: tags.album,
            coverArt
          });
        },
        onError: () => resolve(null)
      });
    });
  }

  getAudioDuration(url) {
    return new Promise((resolve) => {
      const tempAudio = new Audio(url);
      tempAudio.addEventListener('loadedmetadata', () => resolve(tempAudio.duration || 0));
      tempAudio.addEventListener('error', () => resolve(0));
    });
  }

  selectTrackById(trackId) {
    const index = this.queue.findIndex(t => t.id === trackId);
    if (index !== -1) {
      this.currentIndex = index;
      this.eventBus.emit('CURRENT_TRACK_CHANGED', this.queue[this.currentIndex]);
    }
  }

  nextTrack() {
    if (this.queue.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.queue.length;
    this.eventBus.emit('CURRENT_TRACK_CHANGED', this.queue[this.currentIndex]);
  }

  previousTrack() {
    if (this.queue.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.queue.length) % this.queue.length;
    this.eventBus.emit('CURRENT_TRACK_CHANGED', this.queue[this.currentIndex]);
  }

  clearQueue() {
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls.clear();
    this.queue = [];
    this.currentIndex = -1;
    this.eventBus.emit('QUEUE_UPDATED', this.queue);
  }
}
