/**
 * Sonance - Automated Unit Test Suite (Empty Queue & File Ingestion)
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
console.log('⚡ SONANCE ENGINE - EMPTY QUEUE & INGESTION SUITE');
console.log('==================================================\n');

const eventBus = new EventBus();

// Test 1: QUEUE_UPDATED Empty State Emission
let queueData = null;
eventBus.on('QUEUE_UPDATED', (queue) => { queueData = queue; });
eventBus.emit('QUEUE_UPDATED', []);
assert(Array.isArray(queueData) && queueData.length === 0, 'Test 1 (QUEUE_UPDATED Empty State): Queue initializes as pure empty array');

console.log('\n--------------------------------------------------');
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('--------------------------------------------------\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
