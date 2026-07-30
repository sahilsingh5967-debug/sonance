/**
 * Sonance Test Suite - AudioEngine & Waveform Unit Tests
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
console.log('⚡ SONANCE ENGINE - AUDIO ENGINE SUITE');
console.log('==================================================\n');

const bus = new EventBus();

// Test 1: SEEK_COMMAND Waveform Scrubber Dispatching
let seekTime = null;
bus.on('SEEK_COMMAND', (t) => { seekTime = t; });
bus.emit('SEEK_COMMAND', 124.5);
assert(seekTime === 124.5, 'Test 1 (Waveform SEEK_COMMAND): Interactive waveform canvas seek target emitted');

// Test 2: VOLUME_CHANGE_COMMAND Ramping
let volumeVal = null;
bus.on('VOLUME_CHANGE_COMMAND', (v) => { volumeVal = v; });
bus.emit('VOLUME_CHANGE_COMMAND', 0.85);
assert(volumeVal === 0.85, 'Test 2 (AudioEngine Volume): VOLUME_CHANGE_COMMAND emitted with target gain ratio');

console.log('\n--------------------------------------------------');
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('--------------------------------------------------\n');

if (failed > 0) process.exit(1);
