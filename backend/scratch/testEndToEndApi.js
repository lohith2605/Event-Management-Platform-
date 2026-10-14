import fetch from 'node:http';

async function testApi() {
  console.log('Testing UTSAV Real Endpoints...');

  const BASE = 'http://localhost:5000';

  // 1. All published events
  const res1 = await (await globalThis.fetch(`${BASE}/api/events`)).json();
  console.log('1. /api/events -> total:', res1.total, 'events returned:', res1.events?.length);
  if (!res1.success || res1.events.some(e => e.status !== 'published')) {
    throw new Error('Test 1 failed: non-published events or success false');
  }

  // 2. Categories aggregate
  const res2 = await (await globalThis.fetch(`${BASE}/api/events/categories`)).json();
  console.log('2. /api/events/categories ->', res2.categories);
  if (!res2.success || typeof res2.categories !== 'object') {
    throw new Error('Test 2 failed: categories response invalid');
  }

  // 3. Category filter
  const res3 = await (await globalThis.fetch(`${BASE}/api/events?category=Music%20%26%20Concerts`)).json();
  console.log('3. Filter category -> count:', res3.count, res3.events?.map(e => e.title));
  if (res3.events?.length !== 1 || res3.events[0].category !== 'Music & Concerts') {
    throw new Error('Test 3 failed: category filter incorrect');
  }

  // 4. Free filter
  const res4 = await (await globalThis.fetch(`${BASE}/api/events?pricing=free`)).json();
  console.log('4. Filter free -> count:', res4.count, res4.events?.map(e => e.title));
  if (res4.events?.length !== 1 || res4.events[0].priceNumber !== 0) {
    throw new Error('Test 4 failed: free filter incorrect');
  }

  // 5. Empty search (no match)
  const res5 = await (await globalThis.fetch(`${BASE}/api/events?search=randomXYZ123NonExistent`)).json();
  console.log('5. Empty search -> count:', res5.count, 'events:', res5.events);
  if (res5.count !== 0 || res5.events?.length !== 0) {
    throw new Error('Test 5 failed: empty state did not return 0 events');
  }

  // 6. Admin Login & Stats
  const loginRes = await (await globalThis.fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'lohith2605' }),
  }));
  const loginData = await loginRes.json();
  console.log('6. Admin Login ->', loginData.success, 'user role:', loginData.user?.role);

  const cookie = loginRes.headers.get('set-cookie');
  if (cookie) {
    const statsRes = await (await globalThis.fetch(`${BASE}/api/admin/stats`, {
      headers: { cookie },
    })).json();
    console.log('7. /api/admin/stats ->', statsRes.stats);
    if (!statsRes.success || statsRes.stats.totalUsers === undefined) {
      throw new Error('Test 7 failed: admin stats failed');
    }
  }

  console.log('\nAll Real API Tests PASSED successfully!');
}

testApi().catch(err => {
  console.error('API Test Error:', err);
  process.exit(1);
});
