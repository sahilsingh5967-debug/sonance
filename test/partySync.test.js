/**
 * Sonance Test Suite - PartySync WebRTC Resilient Networking Unit Tests
 */
import { EventBus } from '../js/eventBus.js';
import { PartySync } from '../js/partySync.js';

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
console.log('⚡ SONANCE ENGINE - WEBRTC NETWORKING RESILIENCE SUITE');
console.log('==================================================\n');

const eventBus = new EventBus();
const partySync = new PartySync(eventBus);

// Test 1: NETWORK_ERROR Emission for peer-unavailable
let networkErrorData = null;
eventBus.on('NETWORK_ERROR', (err) => { networkErrorData = err; });

partySync.handlePeerError({ type: 'peer-unavailable', message: 'Host Room ID is invalid' });

assert(networkErrorData && networkErrorData.type === 'peer-unavailable', 'Test 1 (Peer Unavailable Error): NETWORK_ERROR emitted with type peer-unavailable');
assert(networkErrorData && networkErrorData.message.includes('invalid'), 'Test 2 (Human Readable Message): NETWORK_ERROR contains human-readable string');

// Test 3: NETWORK_ERROR Emission for socket-error
networkErrorData = null;
partySync.handlePeerError({ type: 'socket-error' });
assert(networkErrorData && networkErrorData.type === 'socket-error', 'Test 3 (Socket Error Mapping): WebSocket failure correctly mapped and emitted');

console.log('\n--------------------------------------------------');
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('--------------------------------------------------\n');

if (failed > 0) process.exit(1);
