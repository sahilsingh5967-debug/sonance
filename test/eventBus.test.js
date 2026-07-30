/**
 * Sonance Test Suite - EventBus Unit Tests
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
console.log('⚡ SONANCE ENGINE - EVENT BUS SUITE');
console.log('==================================================\n');

const bus = new EventBus();

// Test 1: Subscribe & Emit
let receivedPayload = null;
bus.on('TEST_EVENT', (data) => { receivedPayload = data; });
bus.emit('TEST_EVENT', { foo: 'bar' });
assert(receivedPayload && receivedPayload.foo === 'bar', 'Test 1 (EventBus Pub/Sub): Payload delivered to subscriber');

// Test 2: Unsubscribe (off)
let count = 0;
const handler = () => { count++; };
bus.on('COUNT_EVENT', handler);
bus.emit('COUNT_EVENT');
bus.off('COUNT_EVENT', handler);
bus.emit('COUNT_EVENT');
assert(count === 1, 'Test 2 (EventBus Unsubscribe): Handler removed after off()');

console.log('\n--------------------------------------------------');
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('--------------------------------------------------\n');

if (failed > 0) process.exit(1);
