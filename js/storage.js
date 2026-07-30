/**
 * Sonance Storage - LocalStorage Data Persistence Engine
 * 
 * Saves & restores user audio state across sessions:
 * - VOLUME_UPDATED -> localStorage.setItem('sonance_volume', value)
 * - EQ_UPDATED -> localStorage.setItem('sonance_eq', gainsArray)
 * - Restores state on application boot before playback starts.
 */
export class Storage {
  /**
   * @param {import('./eventBus.js').EventBus} eventBus 
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.bindEvents();
    this.restoreState();
  }

  bindEvents() {
    this.eventBus.on('VOLUME_UPDATED', (vol) => this.save('sonance_volume', vol));
    this.eventBus.on('EQ_UPDATED', (gainsArray) => this.save('sonance_eq', gainsArray));
  }

  /**
   * Safely writes payload to localStorage.
   * @param {string} key 
   * @param {*} data 
   */
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[Sonance Storage Write Error]', e);
    }
  }

  /**
   * Reads persisted settings from localStorage and emits restore commands on boot.
   */
  restoreState() {
    try {
      const savedVol = localStorage.getItem('sonance_volume');
      if (savedVol !== null) {
        const volume = JSON.parse(savedVol);
        setTimeout(() => {
          this.eventBus.emit('VOLUME_CHANGE_COMMAND', volume);
        }, 150);
      }

      const savedEQ = localStorage.getItem('sonance_eq');
      if (savedEQ !== null) {
        const gains = JSON.parse(savedEQ);
        setTimeout(() => {
          if (Array.isArray(gains)) {
            gains.forEach((gain, bandIndex) => {
              this.eventBus.emit('EQ_CHANGE_COMMAND', { bandIndex, value: gain });
            });
            this.eventBus.emit('EQ_UPDATED', gains);
          }
        }, 200);
      }
    } catch (e) {
      console.warn('[Sonance Storage Restore Error]', e);
    }
  }
}
