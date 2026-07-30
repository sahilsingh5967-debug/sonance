/**
 * Auralis EventBus - Pub/Sub Event Manager
 * Central nervous system decoupling UI, Audio Engine, Visualizer, WebRTC & Storage.
 */
export class EventBus {
  constructor() {
    this.listeners = {};
  }

  /**
   * Subscribes a listener callback to an event channel.
   * @param {string} event - Channel name.
   * @param {Function} callback - Callback function.
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Unsubscribes a listener callback from an event channel.
   * @param {string} event - Channel name.
   * @param {Function} callback - Callback function to remove.
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * Publishes an event payload to all subscribed callbacks.
   * @param {string} event - Channel name.
   * @param {*} data - Payload.
   */
  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[EventBus Error] Event "${event}":`, err);
      }
    });
  }
}
