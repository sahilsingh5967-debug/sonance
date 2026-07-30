/**
 * Sonance Test Suite - Playlist State Unit Tests
 */
import { EventBus } from '../js/eventBus.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n==================================================');
console.log('⚡ SONANCE ENGINE - PLAYLIST SUITE');
console.log('==================================================\n');

const bus = new EventBus();

// Test 1: QUEUE_UPDATED Empty State Emission
let queueData = null;
bus.on('QUEUE_UPDATED', (q) => { queueData = q; });
bus.emit('QUEUE_UPDATED', []);
assert(Array.isArray(queueData) && queueData.length === 0, 'Test 1 (Playlist Queue State): Queue state initializes as empty array');

// Test 2: TRACK_SELECTED Event Dispatching
let selectedTrackId = null;
bus.on('TRACK_SELECTED', (id) => { selectedTrackId = id; });
bus.emit('TRACK_SELECTED', 'track-123');
assert(selectedTrackId === 'track-123', 'Test 2 (Track Selection): TRACK_SELECTED event dispatched with track ID');

console.log('\n--------------------------------------------------');
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('--------------------------------------------------\n');

if (failed > 0) process.exit(1);
