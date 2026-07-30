import { EventBus } from './eventBus.js';
import { Storage } from './storage.js';
import { AudioEngine } from './audioEngine.js';
import { UIController } from './uiController.js';
import { Visualizer } from './visualizer.js';
import { PartySync } from './partySync.js';
import { Playlist } from './playlist.js';

/**
 * Sonance Bootstrapper & macOS Web Audio Unlocker
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('⚡ [SONANCE HI-FI ENGINE] Bootstrapping ES6 Event-Driven Architecture...');

  // Initialize central EventBus
  const eventBus = new EventBus();

  // Instantiate Subsystems into Application Container
  const app = {
    eventBus,
    storage: new Storage(eventBus),
    audioEngine: new AudioEngine(eventBus),
    uiController: new UIController(eventBus),
    visualizer: new Visualizer(eventBus),
    partySync: new PartySync(eventBus),
    playlist: new Playlist(eventBus)
  };

  // Apple / Safari / macOS Physical DOM Interaction Audio Unlocker
  const unlock = () => {
    eventBus.emit('UNLOCK_AUDIO');
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('✅ [Sonance PWA] ServiceWorker Registered:', reg.scope))
      .catch(err => console.warn('⚠️ [Sonance PWA] ServiceWorker Registration Failed:', err));
  }

  console.log('✅ [SONANCE HI-FI ENGINE] All Subsystems & Application State Active:', app);
});
