import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteLocation } from './locationStore.js';

test('deleteLocation trims and removes the requested location name', async () => {
  const deletedValues = [];
  const db = {
    run: async (_query, params) => {
      deletedValues.push(params[0]);
      return { changes: 1 };
    },
  };

  const removed = await deleteLocation(db, '  Flint PO  ');

  assert.equal(removed, true);
  assert.deepEqual(deletedValues, ['Flint PO']);
});

test('deleteLocation rejects empty location names', async () => {
  const db = { run: async () => ({ changes: 1 }) };

  await assert.rejects(() => deleteLocation(db, '   '), /Location name is required/);
});
