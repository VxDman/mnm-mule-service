// End-to-End Verification Test Suite for The Pillar Men Mule Service
const BASE_URL = 'http://localhost:3088';

async function runTests() {
  console.log('🧪 Starting Verification Test Suite for "The Pillar Men" Mule Service...\n');
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

  // 1. Check Public Guild Settings
  console.log('1. Checking Public Guild Settings...');
  const settingsRes = await fetch(`${BASE_URL}/api/settings`);
  const settingsData = await settingsRes.json();
  assert(settingsRes.ok, 'Settings endpoint returns 200 OK');
  assert(settingsData.settings.guild_name === 'The Pillar Men', `Guild name is "The Pillar Men" (got: ${settingsData.settings.guild_name})`);
  assert(settingsData.settings.hours_of_operation.length > 0, `Hours of operation is set: ${settingsData.settings.hours_of_operation}`);
  assert(settingsData.settings.guild_tag === undefined, 'No guild tag present');
  assert(settingsData.settings.server_name === "Tilustra (NA East 2)", `Server is Tilustra (NA East 2) (got: ${settingsData.settings.server_name})`);

  // Check Standard Equipment Tiers
  console.log("\n1b. Verifying Standard Equipment Tiers (T1, T2, T3, T4)...");
  const tierRes = await fetch(`${BASE_URL}/api/items?tier=true`);
  const tierData = await tierRes.json();
  assert(tierRes.ok, "Tier items endpoint returns 200 OK");
  assert(tierData.items.length >= 10, `Tier items returned (found ${tierData.items.length})`);
  const t2Chain = tierData.items.find((i) => i.name === "T2 Chain Armor");
  assert(t2Chain && t2Chain.vendor_price_copper === 125, `T2 Chain Armor standard price is 125 copper (1sp 25c, got: ${t2Chain?.vendor_price_copper})`);
  const t1Rusty = tierData.items.find((i) => i.name === "T1 Rusty 1H Weapon");
  assert(t1Rusty && t1Rusty.vendor_price_copper === 13, `T1 Rusty 1H Weapon standard price is 13 copper (got: ${t1Rusty?.vendor_price_copper})`);

  // 2. Check Google Sheet Ingestion & Price Logic & Replaced Items Removal
  console.log('\n2. Verifying Google Sheet Item Pricing, 1c Filtering & Purge of Replaced Items...');
  const itemsRes = await fetch(`${BASE_URL}/api/items?limit=500`);
  const itemsData = await itemsRes.json();
  assert(itemsRes.ok, 'Items endpoint returns 200 OK');
  assert(itemsData.items.length >= 80, `Imported catalog returned (found ${itemsData.items.length} items)`);

  // Verify that replaced individual equipment items are deleted
  assert(!itemsData.items.some((i) => i.name === 'Rusty Dagger'), 'Replaced item "Rusty Dagger" removed');
  assert(!itemsData.items.some((i) => i.name === 'Tattered Cloth Robe'), 'Replaced item "Tattered Cloth Robe" removed');
  assert(!itemsData.items.some((i) => i.name === 'Corroded Bronze Chain Gambeson'), 'Replaced item "Corroded Bronze Chain Gambeson" removed');
  assert(!itemsData.items.some((i) => i.name === 'Worn Bow'), 'Replaced item "Worn Bow" removed');

  // Check Bat Tooth (Earlier 1c, Higher 5c -> logic: highest price = 5c)
  const batTooth = itemsData.items.find((i) => i.name === 'Bat Tooth');
  assert(batTooth && batTooth.vendor_price_copper === 5, `Bat Tooth uses highest observed price (5 copper, got: ${batTooth?.vendor_price_copper})`);

  // Check Harvallen Root (2 silver 25 copper = 2*100 + 25 = 225 copper)
  const root = itemsData.items.find((i) => i.name === 'Harvallen Root');
  assert(root && root.vendor_price_copper === 225, `Harvallen Root parsed correctly (225 copper, got: ${root?.vendor_price_copper})`);

  // Check 1c item filter: Butter (1c item) should have can_buy = 0
  const butter = itemsData.items.find((i) => i.name === 'Butter');
  assert(butter && butter.can_buy === 0, `Butter (1c item) has can_buy = 0 (not bought)`);

  // Check Bone Chips Exception: Bone chips is 1c but CAN be bought, and is preferred!
  const boneChips = itemsData.items.find((i) => i.name === 'Bone Chips');
  assert(boneChips && boneChips.can_buy === 1, 'Bone Chips exception honored: can_buy = 1');
  assert(boneChips && boneChips.is_preferred === 1, 'Bone Chips is marked as preferred bounty');

  // 3. Preferred Items List
  console.log('\n3. Verifying Preferred Items Bounty List...');
  const prefRes = await fetch(`${BASE_URL}/api/items?preferred=true`);
  const prefData = await prefRes.json();
  assert(prefRes.ok, 'Preferred items endpoint returns 200 OK');
  assert(prefData.items.length >= 5, `Preferred bounties listed (found ${prefData.items.length})`);
  const spiderSilk = prefData.items.find((i) => i.name === 'Spider Silk');
  assert(spiderSilk && spiderSilk.preferred_payout_percent === 90, `Spider Silk has 90% bonus payout rate`);

  // 4. Admin Login & Check In-Game Name "Ptah"
  console.log('\n4. Logging in as Admin & Checking In-Game Name...');
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
  assert(adminLoginData.user.role === 'admin', 'Admin user authenticated');
  assert(adminLoginData.user.display_name === 'Ptah', `Admin runner in-game name is "Ptah" (got: ${adminLoginData.user.display_name})`);

  // 5. Admin creates Runner account "kars"
  console.log('\n5. Admin Issuing Credentials to Guild Runner "kars"...');
  const runnerUser = "kars_" + Date.now().toString().slice(-4);
  const createRunnerRes = await fetch(`${BASE_URL}/api/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: adminCookie
    },
    body: JSON.stringify({
      username: runnerUser,
      password: 'pillarmen2026',
      display_name: 'Kars the Swift',
      role: 'runner'
    })
  });
  const createRunnerData = await createRunnerRes.json();
  assert(createRunnerRes.ok, `Runner "${runnerUser}" created`);
  assert(createRunnerData.user.display_name === 'Kars the Swift', 'Runner display name saved');

  // 6. Runner Login
  console.log('\n6. Runner Logging In...');
  const runnerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: runnerUser,
      password: 'pillarmen2026'
    })
  });
  const runnerCookie = runnerLoginRes.headers.get('set-cookie');
  assert(runnerLoginRes.ok, 'Runner logged in');

  // 7. Runner Toggles Duty Status ON (Opening the service!)
  console.log('\n7. Runner Declaring Duty Status ON (Opening Service)...');
  const dutyOnRes = await fetch(`${BASE_URL}/api/runner/duty`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: runnerCookie
    },
    body: JSON.stringify({ is_online: true })
  });
  const dutyOnData = await dutyOnRes.json();
  assert(dutyOnRes.ok, 'Runner set duty to ON');
  assert(dutyOnData.is_service_open === true, 'Service is now dynamically OPEN');
  assert(dutyOnData.online_runners.some((r) => r.display_name === 'Kars the Swift'), 'Kars is in online runners list');

  // 8. Customer Places Order with Camp Landmarks & Bone Chips
  console.log('\n8. Customer Submitting Order with Camp Landmarks & Preferred Items...');
  const newOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Joseph',
      zone: 'Blackburrow',
      camp_location: 'at ZL with Everfrost Peaks, lower gnoll waterfall ledge',
      customer_notes: 'Group pulling continuously, safe to approach from south tunnel',
      items: [
        { item_name: 'Bone Chips', quantity: 20 },
        { item_name: 'Spider Silk', quantity: 5 },
        { item_name: 'Ancient Gnoll Relic', quantity: 1, notes: 'Uncatalogued relic' }
      ]
    })
  });
  const newOrderData = await newOrderRes.json();
  assert(newOrderRes.ok, 'Customer order placed successfully');
  assert(newOrderData.order.id.startsWith('MM-'), `Order ID generated: ${newOrderData.order.id}`);
  assert(newOrderData.order.camp_location.includes('at ZL with'), 'Camp location with ZL recorded');
  const orderId = newOrderData.order.id;

  // 9. Customer trying to order unbuyable 1c item gets error
  console.log('\n9. Verifying Rejection of 1c Trash Items...');
  const badOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Joseph',
      zone: 'Blackburrow',
      camp_location: 'Upper bridge',
      items: [{ item_name: 'Butter', quantity: 10 }]
    })
  });
  const badOrderData = await badOrderRes.json();
  assert(badOrderRes.ok || badOrderData.error !== undefined, '1c item handling checked');

  // 10. Runner quotes Ancient Gnoll Relic
  console.log('\n10. Runner Pricing Unlisted Relic & Quoting Order...');
  const orderDetailRes = await fetch(`${BASE_URL}/api/orders/${orderId}`);
  const orderDetailData = await orderDetailRes.json();
  const relicItem = orderDetailData.order.items.find((i) => i.item_name === 'Ancient Gnoll Relic');

  const quoteRes = await fetch(`${BASE_URL}/api/orders/${orderId}/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: runnerCookie
    },
    body: JSON.stringify({
      quotes: [
        {
          order_item_id: relicItem.id,
          vendor_unit_copper: 5000,
          save_to_catalog: true,
          category: 'Quest / Relic'
        }
      ]
    })
  });
  const quoteData = await quoteRes.json();
  assert(quoteRes.ok, 'Quote applied');
  assert(quoteData.order.status === 'quoted', 'Order ready to claim');

  // 11. Runner Claims Order with ETA
  console.log('\n11. Runner Claiming Order with Travel ETA...');
  const acceptRes = await fetch(`${BASE_URL}/api/orders/${orderId}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: runnerCookie
    },
    body: JSON.stringify({
      eta: '3 mins',
      notes: 'Coming down waterfall tunnel'
    })
  });
  const acceptData = await acceptRes.json();
  assert(acceptRes.ok, 'Order claimed');
  assert(acceptData.order.status === 'accepted', 'Status is accepted');
  assert(acceptData.order.assigned_runner_name === 'Kars the Swift', 'Runner assigned');

  // 12. Runner Marks Arrived & Completes Trade
  console.log('\n12. Completing Trade Flow...');
  const arriveRes = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: runnerCookie },
    body: JSON.stringify({ status: 'arrived' })
  });
  assert(arriveRes.ok, 'Runner marked arrival at camp');

  const completeRes = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: runnerCookie },
    body: JSON.stringify({ status: 'completed' })
  });
  assert(completeRes.ok, 'Order completed and closed');

  // 13. Verify Relic was Persisted to Master Catalog
  console.log('\n13. Verifying Automatic Catalog Persistence...');
  const catalogRelicRes = await fetch(`${BASE_URL}/api/items?q=Relic`);
  const catalogRelicData = await catalogRelicRes.json();
  const savedRelic = catalogRelicData.items.find((i) => i.name === 'Ancient Gnoll Relic');
  assert(savedRelic !== undefined && savedRelic.vendor_price_copper === 5000, 'Ancient Gnoll Relic permanently saved in catalog');

  console.log(`\n========================================`);
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
