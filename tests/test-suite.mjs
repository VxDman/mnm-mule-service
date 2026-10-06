// Comprehensive automated test suite for M&M Mule Service
const BASE_URL = 'http://localhost:3088';

async function runTests() {
  console.log('🧪 Starting End-to-End Verification Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Check Settings API
  console.log('1. Checking Public Guild Settings...');
  const settingsRes = await fetch(`${BASE_URL}/api/settings`);
  const settingsData = await settingsRes.json();
  assert(settingsRes.ok, 'Settings endpoint returns 200 OK');
  assert(settingsData.settings.default_payout_percent === 75, 'Default payout rate is 75%');
  assert(settingsData.settings.guild_name.length > 0, 'Guild name is set');

  // 2. Check Item Catalog
  console.log('\n2. Checking Seeded Item Catalog...');
  const itemsRes = await fetch(`${BASE_URL}/api/items`);
  const itemsData = await itemsRes.json();
  assert(itemsRes.ok, 'Items endpoint returns 200 OK');
  assert(itemsData.items.length >= 20, `Catalog contains seeded items (found ${itemsData.items.length})`);
  const wolfPelt = itemsData.items.find((i) => i.name === 'Wolf Pelt');
  assert(wolfPelt && wolfPelt.vendor_price_copper === 50, 'Wolf Pelt seeded at 50 copper');

  // 3. Customer places order with 1 catalog item and 1 unknown item
  console.log('\n3. Customer Placing New Order...');
  const newOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Thorvald',
      zone: 'Blackburrow',
      camp_location: 'Lower gnoll pit /loc -45, 230',
      customer_notes: 'Group is pulling fast, please hurry',
      items: [
        { item_name: 'Wolf Pelt', quantity: 10 },
        { item_name: 'Mystic Gnoll Totem', quantity: 2, notes: 'Uncatalogued drop' }
      ]
    })
  });
  const newOrderData = await newOrderRes.json();
  assert(newOrderRes.ok, 'Order submitted successfully');
  assert(newOrderData.order.id.startsWith('MM-'), `Order ID format valid: ${newOrderData.order.id}`);
  assert(newOrderData.order.status === 'pending_quote', 'Status is pending_quote due to unlisted totem');
  assert(newOrderData.customer_token.length > 10, 'Customer secret token returned');
  const orderId = newOrderData.order.id;
  const customerToken = newOrderData.customer_token;

  // 4. Verify Single Order View
  console.log('\n4. Fetching Single Order Tracking Details...');
  const orderViewRes = await fetch(`${BASE_URL}/api/orders/${orderId}`);
  const orderViewData = await orderViewRes.json();
  assert(orderViewRes.ok, 'Order fetch returns 200 OK');
  assert(orderViewData.order.items.length === 2, 'Order has 2 items');
  const totemItem = orderViewData.order.items.find((i) => i.item_name === 'Mystic Gnoll Totem');
  assert(totemItem && totemItem.is_priced === 0, 'Totem item marked as unpriced (is_priced = 0)');

  // 5. Admin Login
  console.log('\n5. Logging in as Admin...');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'ironmule2026'
    })
  });
  const adminCookie = adminLoginRes.headers.get('set-cookie');
  const adminLoginData = await adminLoginRes.json();
  assert(adminLoginRes.ok, 'Admin login succeeded');
  assert(adminLoginData.user.role === 'admin', 'Admin user has role=admin');

  // 6. Admin creates new Runner account
  console.log('\n6. Admin Issuing Credentials to Guild Runner...');
  const createRunnerRes = await fetch(`${BASE_URL}/api/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: adminCookie
    },
    body: JSON.stringify({
      username: 'gorm',
      password: 'runnerpassword123',
      display_name: 'Gorm Stonehewer',
      role: 'runner'
    })
  });
  const createRunnerData = await createRunnerRes.json();
  assert(createRunnerRes.ok, 'Admin created runner user "gorm"');
  assert(createRunnerData.user.display_name === 'Gorm Stonehewer', 'Runner character display name saved');

  // 7. Runner Login
  console.log('\n7. Guild Runner Signing In...');
  const runnerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'gorm',
      password: 'runnerpassword123'
    })
  });
  const runnerCookie = runnerLoginRes.headers.get('set-cookie');
  assert(runnerLoginRes.ok, 'Runner gorm logged in successfully');

  // 8. Runner quotes the unknown item
  console.log('\n8. Runner Pricing the Unknown Item...');
  const quoteRes = await fetch(`${BASE_URL}/api/orders/${orderId}/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: runnerCookie
    },
    body: JSON.stringify({
      quotes: [
        {
          order_item_id: totemItem.id,
          vendor_unit_copper: 1500, // 1pp 5gp
          save_to_catalog: true,
          category: 'Quest / Totem'
        }
      ]
    })
  });
  const quoteData = await quoteRes.json();
  assert(quoteRes.ok, 'Quote saved successfully');
  assert(quoteData.order.status === 'quoted', 'Order status moved to "quoted" now that all items are priced');
  // Wolf Pelt: 50 * 10 = 500 vendor. Payout @ 75% = 37 * 10 = 370
  // Totem: 1500 * 2 = 3000 vendor. Payout @ 75% = 1125 * 2 = 2250
  assert(quoteData.order.total_vendor_copper === 3500, `Vendor total copper is 3500 (got ${quoteData.order.total_vendor_copper})`);
  assert(quoteData.order.total_payout_copper === 2620, `Payout total copper is 2620 (got ${quoteData.order.total_payout_copper})`);

  // 9. Verify that Mystic Gnoll Totem was persisted to the Master Item Catalog!
  console.log('\n9. Verifying Automatic Catalog Insertion...');
  const catalogCheckRes = await fetch(`${BASE_URL}/api/items?q=Totem`);
  const catalogCheckData = await catalogCheckRes.json();
  const savedTotem = catalogCheckData.items.find((i) => i.name === 'Mystic Gnoll Totem');
  assert(savedTotem !== undefined, 'Mystic Gnoll Totem is now permanently saved in the Item Catalog!');
  assert(savedTotem && savedTotem.vendor_price_copper === 1500, 'Catalog price matches 1500 copper');

  // 10. Runner Claims & Accepts Order with ETA
  console.log('\n10. Runner Claiming Order & Setting ETA...');
  const acceptRes = await fetch(`${BASE_URL}/api/orders/${orderId}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: runnerCookie
    },
    body: JSON.stringify({
      eta: '4 mins',
      notes: 'Sprinting through upper level'
    })
  });
  const acceptData = await acceptRes.json();
  assert(acceptRes.ok, 'Order accepted by runner');
  assert(acceptData.order.status === 'accepted', 'Status updated to accepted');
  assert(acceptData.order.assigned_runner_name === 'Gorm Stonehewer', 'Runner character name assigned');
  assert(acceptData.order.runner_eta === '4 mins', 'ETA saved as 4 mins');

  // 11. Customer Sends Camp Chat Message
  console.log('\n11. Customer Posting In-Order Message...');
  const chatRes = await fetch(`${BASE_URL}/api/orders/${orderId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Watch out for elite gnoll roamer near entrance',
      token: customerToken
    })
  });
  assert(chatRes.ok, 'Customer message posted to order timeline');

  // 12. Runner Marks "Arrived at Camp"
  console.log('\n12. Runner Marking Arrival at Camp...');
  const arrivedRes = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: runnerCookie
    },
    body: JSON.stringify({ status: 'arrived' })
  });
  const arrivedData = await arrivedRes.json();
  assert(arrivedRes.ok, 'Runner marked arrival');
  assert(arrivedData.order.status === 'arrived', 'Status is arrived');

  // 13. Runner Completes Trade
  console.log('\n13. Runner Completing Trade & Closing Order...');
  const completeRes = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: runnerCookie
    },
    body: JSON.stringify({ status: 'completed' })
  });
  const completeData = await completeRes.json();
  assert(completeRes.ok, 'Trade completed and closed');
  assert(completeData.order.status === 'completed', 'Order status is completed');
  assert(completeData.order.completed_at !== null, 'Completion timestamp recorded');

  // 14. Check Treasury & Guild Stats
  console.log('\n14. Verifying Guild Stats & Runner Profit Tracking...');
  const statsRes = await fetch(`${BASE_URL}/api/stats`, {
    headers: { cookie: runnerCookie }
  });
  const statsData = await statsRes.json();
  assert(statsRes.ok, 'Stats endpoint returns 200 OK');
  assert(statsData.stats.totalCompleted >= 1, `Total completed runs: ${statsData.stats.totalCompleted}`);
  assert(statsData.stats.totalProfitCopper > 0, `Guild runner profit: ${statsData.stats.totalProfitCopper} copper`);

  console.log(`\n========================================`);
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
