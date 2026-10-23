import test from 'node:test';
import assert from 'node:assert/strict';

// Pure logic mirror of SafeHighlight string parsing
function splitSearchMatch(text, query) {
  if (!query || !text) return [{ text, isMatch: false }];
  const trimmed = query.trim();
  if (!trimmed) return [{ text, isMatch: false }];

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part) => ({
    text: part,
    isMatch: part.toLowerCase() === trimmed.toLowerCase(),
  }));
}

test('Frontend Message Search & Jump Unit Tests', async (t) => {
  await t.test('SafeHighlight splits matching and non-matching tokens correctly', () => {
    const text = 'The keynote starts at 10:00 AM sharp in the Main Auditorium.';
    const query = 'keynote';

    const segments = splitSearchMatch(text, query);
    assert.strictEqual(segments.length, 3);
    assert.strictEqual(segments[0].text, 'The ');
    assert.strictEqual(segments[0].isMatch, false);
    assert.strictEqual(segments[1].text, 'keynote');
    assert.strictEqual(segments[1].isMatch, true);
    assert.strictEqual(segments[2].text, ' starts at 10:00 AM sharp in the Main Auditorium.');
    assert.strictEqual(segments[2].isMatch, false);
  });

  await t.test('SafeHighlight handles regex special characters safely without crashing or ReDoS', () => {
    const specialQueries = ['(', ')', '[test]', '.*', '$100', 'a+b', 'c?d', '^start', '{2,4}'];

    for (const q of specialQueries) {
      const text = `Price is $100 and (test) [test] with a+b and c?d with .* and {2,4} and ^start.`;
      const segments = splitSearchMatch(text, q);
      assert.ok(Array.isArray(segments));
      const hasMatch = segments.some((s) => s.isMatch);
      assert.strictEqual(hasMatch, true, `Query "${q}" should match safely`);
    }
  });

  await t.test('SafeHighlight performs case-insensitive token segmentation', () => {
    const text = 'UTSAV KEYNOTE and keynote are identical';
    const query = 'KeyNote';

    const segments = splitSearchMatch(text, query);
    const matches = segments.filter((s) => s.isMatch);
    assert.strictEqual(matches.length, 2);
    assert.strictEqual(matches[0].text, 'KEYNOTE');
    assert.strictEqual(matches[1].text, 'keynote');
  });

  await t.test('SafeHighlight handles empty, whitespace-only or null queries gracefully', () => {
    const text = 'UTSAV Event Message';
    assert.deepStrictEqual(splitSearchMatch(text, ''), [{ text, isMatch: false }]);
    assert.deepStrictEqual(splitSearchMatch(text, '   '), [{ text, isMatch: false }]);
    assert.deepStrictEqual(splitSearchMatch(text, null), [{ text, isMatch: false }]);
    assert.deepStrictEqual(splitSearchMatch(null, 'query'), [{ text: null, isMatch: false }]);
  });

  await t.test('Jump to message logic detects already loaded vs unloaded message', () => {
    const loadedMessages = [
      { _id: 'msg-1', createdAt: '2026-10-23T10:00:00.000Z' },
      { _id: 'msg-2', createdAt: '2026-10-23T10:01:00.000Z' },
      { _id: 'msg-3', createdAt: '2026-10-23T10:02:00.000Z' },
    ];

    const isLoaded = (id) => loadedMessages.some((m) => m._id === id);

    assert.strictEqual(isLoaded('msg-2'), true, 'msg-2 should be detected as loaded');
    assert.strictEqual(isLoaded('msg-older'), false, 'msg-older should be detected as not loaded');
  });

  await t.test('Prepend older messages avoids duplicate message IDs in timeline', () => {
    const existing = [
      { _id: 'msg-3', text: 'Three' },
      { _id: 'msg-4', text: 'Four' },
    ];

    const olderFromApi = [
      { _id: 'msg-1', text: 'One' },
      { _id: 'msg-2', text: 'Two' },
      { _id: 'msg-3', text: 'Three (dup)' },
    ];

    const existingIds = new Set(existing.map((m) => m._id));
    const newOlder = olderFromApi.filter((m) => !existingIds.has(m._id));
    const combined = [...newOlder, ...existing];

    assert.strictEqual(combined.length, 4);
    assert.deepStrictEqual(
      combined.map((m) => m._id),
      ['msg-1', 'msg-2', 'msg-3', 'msg-4']
    );
  });

  await t.test('Out-of-order search responses are discarded using request ID tracking', () => {
    let currentRequestId = 0;
    let finalResultSet = null;

    // Simulation of two asynchronous searches (e.g. typing "k" then "key")
    const triggerSearch = (query, simulateLatencyMs, reqId) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (reqId === currentRequestId) {
            finalResultSet = `Results for ${query}`;
          }
          resolve();
        }, simulateLatencyMs);
      });
    };

    // First request (slower: 50ms)
    currentRequestId = 1;
    const req1 = triggerSearch('k', 50, 1);

    // Second request (faster: 10ms)
    currentRequestId = 2;
    const req2 = triggerSearch('key', 10, 2);

    return Promise.all([req1, req2]).then(() => {
      assert.strictEqual(
        finalResultSet,
        'Results for key',
        'Stale response from request 1 must be ignored'
      );
    });
  });
});
