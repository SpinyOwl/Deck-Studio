import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {ExportStatusService} from './ExportStatusService';

/**
 * Verifies export status updates notify subscribers incrementally.
 */
describe('ExportStatusService', () => {
  test('tracks steps and hides after completion', async () => {
    const service = new ExportStatusService();
    const snapshots: string[] = [];

    service.subscribe(status => {
      snapshots.push(`${status.result}-${status.steps.length}-${status.isVisible}`);
    });

    service.beginExport();
    const stepId = service.startStep('Create output folder');
    service.completeStep(stepId);
    service.completeExport();

    assert.equal(snapshots.at(-1), 'success-1-true');

    await new Promise(resolve => {
      setTimeout(resolve, 1300);
    });

    const latest = service.getStatus();
    assert.equal(latest.isVisible, false);
    assert.equal(latest.result, 'idle');
  });
});
