import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {LogService} from './LogService';

/**
 * Ensures log snapshots cannot be mutated by subscribers.
 */
describe('LogService', () => {
  test('protects stored entries from external mutation', () => {
    const service = new LogService();

    service.info('first');
    service.info('second');

    const snapshot = service.getLogs();
    const mutableEntry = snapshot[0] as unknown as { message: string };
    mutableEntry.message = 'mutated';

    const refreshed = service.getLogs();

    assert.equal(refreshed.length, 2);
    assert.equal(refreshed[0]?.message, 'first');
  });
});
