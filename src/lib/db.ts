import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Item, Order, OrderItem, OrderEvent, AppSettings, User, UserWithPassword } from '@/types';
import { calculatePayout } from './currency';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'mule.db');

// Singleton database instance across Next.js dev reloads
declare global {
  // eslint-disable-next-line no-var
  var __mule_db: Database.Database | undefined;
}

function getDatabase(): Database.Database {
  if (global.__mule_db) {
    return global.__mule_db;
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  seedInitialData(db);

  if (process.env.NODE_ENV !== 'production') {
    global.__mule_db = db;
  }

  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'runner',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE COLLATE NOCASE NOT NULL,
      category TEXT NOT NULL DEFAULT 'Loot',
      vendor_price_copper INTEGER NOT NULL DEFAULT 0,
      stack_size INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_by TEXT DEFAULT 'System',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_token TEXT NOT NULL,
      zone TEXT NOT NULL,
      camp_location TEXT NOT NULL,
      customer_notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending_quote',
      payout_percent INTEGER NOT NULL DEFAULT 75,
      total_vendor_copper INTEGER NOT NULL DEFAULT 0,
      total_payout_copper INTEGER NOT NULL DEFAULT 0,
      assigned_runner_id TEXT,
      assigned_runner_name TEXT,
      runner_eta TEXT,
      runner_notes TEXT,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_runner_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      item_id TEXT,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      vendor_unit_copper INTEGER NOT NULL DEFAULT 0,
      payout_unit_copper INTEGER NOT NULL DEFAULT 0,
      is_priced INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_events (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);
  `);
}

function seedInitialData(db: Database.Database) {
  // 1. Seed Settings
  const defaultSettings: Record<string, string> = {
    guild_name: 'Ironforge Courier & Mule Co.',
    guild_tag: '<MULE>',
    default_payout_percent: '75',
    motd: 'Active Camp Mule Service — We trek out to your monster camps and buy your heavy bags so you never have to leave your camp!'
  };

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }

  // 2. Seed Default Admin User if not already present
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('ironmule2026', salt);
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run('user-admin-default', 'admin', hash, 'Quartermaster Grimm', 'admin');
  }

  // 3. Seed starter catalog of popular M&M items if items table is empty
  const itemCount = db.prepare('SELECT COUNT(*) as count FROM items').get() as { count: number };
  if (itemCount.count === 0) {
    const starterItems = [
      { name: 'Bone Chips', category: 'Bone / Reagent', vendor_price_copper: 80, stack_size: 20 },
      { name: 'Fire Beetle Eye', category: 'Reagent / Light', vendor_price_copper: 120, stack_size: 20 },
      { name: 'Spider Silk', category: 'Trade Skill / Reagent', vendor_price_copper: 250, stack_size: 20 },
      { name: 'Spider Venom Sac', category: 'Poison / Alchemy', vendor_price_copper: 450, stack_size: 20 },
      { name: 'Wolf Pelt', category: 'Pelt / Tailoring', vendor_price_copper: 50, stack_size: 1 },
      { name: 'Medium Quality Wolf Pelt', category: 'Pelt / Tailoring', vendor_price_copper: 220, stack_size: 1 },
      { name: 'High Quality Wolf Pelt', category: 'Pelt / Tailoring', vendor_price_copper: 800, stack_size: 1 },
      { name: 'Ruined Bear Pelt', category: 'Pelt / Tailoring', vendor_price_copper: 40, stack_size: 1 },
      { name: 'Black Bear Pelt', category: 'Pelt / Tailoring', vendor_price_copper: 1200, stack_size: 1 },
      { name: 'High Quality Bear Skin', category: 'Pelt / Tailoring', vendor_price_copper: 2500, stack_size: 1 },
      { name: 'Lion Tail', category: 'Trophy', vendor_price_copper: 350, stack_size: 1 },
      { name: 'Snake Venom Sac', category: 'Poison / Alchemy', vendor_price_copper: 180, stack_size: 20 },
      { name: 'Snake Scales', category: 'Reagent', vendor_price_copper: 40, stack_size: 20 },
      { name: 'Gnoll Fang', category: 'Quest / Trophy', vendor_price_copper: 850, stack_size: 20 },
      { name: 'Orc Scalp', category: 'Quest / Trophy', vendor_price_copper: 600, stack_size: 20 },
      { name: 'Orc Centurion Bracer', category: 'Quest / Armor', vendor_price_copper: 950, stack_size: 1 },
      { name: 'Rusty Short Sword', category: 'Weapon (1HS)', vendor_price_copper: 150, stack_size: 1 },
      { name: 'Rusty Broad Sword', category: 'Weapon (1HS)', vendor_price_copper: 280, stack_size: 1 },
      { name: 'Rusty Two Handed Sword', category: 'Weapon (2HS)', vendor_price_copper: 420, stack_size: 1 },
      { name: 'Rusty Dagger', category: 'Weapon (Piercing)', vendor_price_copper: 95, stack_size: 1 },
      { name: 'Rusty Spear', category: 'Weapon (Piercing)', vendor_price_copper: 310, stack_size: 1 },
      { name: 'Rusty Halberd', category: 'Weapon (2H Slash)', vendor_price_copper: 520, stack_size: 1 },
      { name: 'Bronze Longsword', category: 'Weapon (1HS)', vendor_price_copper: 3500, stack_size: 1 },
      { name: 'Bronze Mace', category: 'Weapon (1HB)', vendor_price_copper: 2800, stack_size: 1 },
      { name: 'Bronze Armor Fragment', category: 'Metal', vendor_price_copper: 1100, stack_size: 5 },
      { name: 'Fine Steel Dagger', category: 'Weapon (Piercing)', vendor_price_copper: 4500, stack_size: 1 },
      { name: 'Fine Steel Scimitar', category: 'Weapon (1HS)', vendor_price_copper: 7200, stack_size: 1 },
      { name: 'Fine Steel Two Handed Sword', category: 'Weapon (2HS)', vendor_price_copper: 9800, stack_size: 1 },
      { name: 'Cracked Staff', category: 'Weapon (1HB)', vendor_price_copper: 180, stack_size: 1 },
      { name: 'Fire Opal', category: 'Gem / Jewelry', vendor_price_copper: 10000, stack_size: 20 },
      { name: 'Star Rose Quartz', category: 'Gem / Jewelry', vendor_price_copper: 5000, stack_size: 20 },
      { name: 'Raw Diamond', category: 'Gem / Jewelry', vendor_price_copper: 50000, stack_size: 20 },
      { name: 'Goblin Meat', category: 'Food', vendor_price_copper: 30, stack_size: 20 },
      { name: 'Zombie Flesh', category: 'Reagent', vendor_price_copper: 65, stack_size: 20 },
      { name: 'Bat Wing', category: 'Reagent', vendor_price_copper: 25, stack_size: 20 }
    ];

    const insertItem = db.prepare(`
      INSERT OR IGNORE INTO items (id, name, category, vendor_price_copper, stack_size, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'System')
    `);

    for (const item of starterItems) {
      insertItem.run(
        'item-' + crypto.randomUUID().slice(0, 8),
        item.name,
        item.category,
        item.vendor_price_copper,
        item.stack_size,
        'Standard starter catalog item'
      );
    }
  }
}

export const db = getDatabase();

// --- Database Query Helpers ---

export function getSettings(): AppSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return {
    guild_name: map.guild_name || 'Ironforge Courier & Mule Co.',
    guild_tag: map.guild_tag || '<MULE>',
    default_payout_percent: parseInt(map.default_payout_percent || '75', 10),
    motd: map.motd || ''
  };
}

export function updateSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

// User Queries
export function getUserByUsername(username: string): UserWithPassword | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as UserWithPassword | undefined;
}

export function getUserById(id: string): User | undefined {
  return db.prepare('SELECT id, username, display_name, role, created_at FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getAllUsers(): User[] {
  return db.prepare('SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at ASC').all() as User[];
}

export function createUser(data: { username: string; password: string; display_name: string; role: 'admin' | 'runner' }): User {
  const id = 'user-' + crypto.randomUUID().slice(0, 8);
  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(data.password, salt);
  db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, data.username.toLowerCase().trim(), password_hash, data.display_name.trim(), data.role);
  return getUserById(id)!;
}

export function updateUserPassword(id: string, newPassword: string): void {
  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(newPassword, salt);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, id);
}

export function updateUserProfile(id: string, display_name: string, role?: 'admin' | 'runner'): void {
  if (role) {
    db.prepare('UPDATE users SET display_name = ?, role = ? WHERE id = ?').run(display_name.trim(), role, id);
  } else {
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display_name.trim(), id);
  }
}

export function deleteUser(id: string): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

// Item Queries
export function findItemByName(name: string): Item | undefined {
  return db.prepare('SELECT * FROM items WHERE name = ? COLLATE NOCASE').get(name.trim()) as Item | undefined;
}

export function searchItems(query: string, limit = 20): Item[] {
  if (!query || query.trim() === '') {
    return db.prepare('SELECT * FROM items ORDER BY name ASC LIMIT ?').all(limit) as Item[];
  }
  const clean = `%${query.trim()}%`;
  return db.prepare('SELECT * FROM items WHERE name LIKE ? ORDER BY name ASC LIMIT ?').all(clean, limit) as Item[];
}

export function getAllItems(): Item[] {
  return db.prepare('SELECT * FROM items ORDER BY name ASC').all() as Item[];
}

export function upsertItem(item: {
  name: string;
  category?: string;
  vendor_price_copper: number;
  stack_size?: number;
  notes?: string;
  created_by?: string;
}): Item {
  const existing = findItemByName(item.name);
  if (existing) {
    db.prepare(`
      UPDATE items
      SET vendor_price_copper = ?,
          category = COALESCE(?, category),
          stack_size = COALESCE(?, stack_size),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      item.vendor_price_copper,
      item.category || null,
      item.stack_size || null,
      item.notes || null,
      existing.id
    );
    return findItemByName(item.name)!;
  } else {
    const id = 'item-' + crypto.randomUUID().slice(0, 8);
    db.prepare(`
      INSERT INTO items (id, name, category, vendor_price_copper, stack_size, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      item.name.trim(),
      item.category || 'Loot',
      item.vendor_price_copper,
      item.stack_size || 1,
      item.notes || null,
      item.created_by || 'Runner'
    );
    return findItemByName(item.name)!;
  }
}

export function deleteItem(id: string): void {
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
}

// Order Queries
function generateOrderId(): string {
  // Friendly short code: MM-XXXX (e.g. MM-4821)
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `MM-${randNum}`;
}

export function createOrder(data: {
  customer_name: string;
  zone: string;
  camp_location: string;
  customer_notes?: string;
  items: Array<{
    item_name: string;
    quantity: number;
    notes?: string;
  }>;
}): { order: Order; customer_token: string } {
  const settings = getSettings();
  const payout_percent = settings.default_payout_percent;

  let orderId = generateOrderId();
  // Ensure unique
  while (db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId)) {
    orderId = generateOrderId();
  }

  const customer_token = crypto.randomBytes(16).toString('hex');

  let hasUnpriced = false;
  let total_vendor = 0;
  let total_payout = 0;

  const preparedItems = data.items.map((it) => {
    const knownItem = findItemByName(it.item_name);
    const quantity = Math.max(1, it.quantity || 1);
    if (knownItem && knownItem.vendor_price_copper > 0) {
      const vendor_unit = knownItem.vendor_price_copper;
      const payout_unit = calculatePayout(vendor_unit, payout_percent);
      total_vendor += vendor_unit * quantity;
      total_payout += payout_unit * quantity;
      return {
        id: 'oi-' + crypto.randomUUID().slice(0, 8),
        item_id: knownItem.id,
        item_name: knownItem.name,
        quantity,
        vendor_unit_copper: vendor_unit,
        payout_unit_copper: payout_unit,
        is_priced: 1,
        notes: it.notes || ''
      };
    } else {
      hasUnpriced = true;
      return {
        id: 'oi-' + crypto.randomUUID().slice(0, 8),
        item_id: null,
        item_name: it.item_name.trim(),
        quantity,
        vendor_unit_copper: 0,
        payout_unit_copper: 0,
        is_priced: 0,
        notes: it.notes || ''
      };
    }
  });

  const initialStatus = hasUnpriced ? 'pending_quote' : 'quoted';

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO orders (
        id, customer_name, customer_token, zone, camp_location,
        customer_notes, status, payout_percent, total_vendor_copper,
        total_payout_copper
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      data.customer_name.trim(),
      customer_token,
      data.zone.trim(),
      data.camp_location.trim(),
      data.customer_notes?.trim() || null,
      initialStatus,
      payout_percent,
      total_vendor,
      total_payout
    );

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (
        id, order_id, item_id, item_name, quantity, vendor_unit_copper,
        payout_unit_copper, is_priced, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of preparedItems) {
      insertOrderItem.run(
        item.id,
        orderId,
        item.item_id,
        item.item_name,
        item.quantity,
        item.vendor_unit_copper,
        item.payout_unit_copper,
        item.is_priced,
        item.notes || null
      );
    }

    // Log initial event
    db.prepare(`
      INSERT INTO order_events (id, order_id, event_type, actor_name, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'ev-' + crypto.randomUUID().slice(0, 8),
      orderId,
      'created',
      data.customer_name,
      hasUnpriced
        ? `Order submitted with ${preparedItems.length} item(s). Waiting for runner quote on unpriced items.`
        : `Order submitted with ${preparedItems.length} item(s). All items priced from catalog!`
    );
  });

  transaction();

  const order = getOrderById(orderId)!;
  return { order, customer_token };
}

export function getOrderById(id: string): Order | undefined {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;
  if (!row) return undefined;

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id) as OrderItem[];
  const events = db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC').all(id) as OrderEvent[];

  return {
    ...row,
    items,
    events
  };
}

export function getOrders(statusFilter?: string): Order[] {
  let query = 'SELECT * FROM orders';
  const params: string[] = [];

  if (statusFilter && statusFilter !== 'all') {
    if (statusFilter === 'active') {
      query += ` WHERE status IN ('pending_quote', 'quoted', 'accepted', 'arrived')`;
    } else {
      query += ` WHERE status = ?`;
      params.push(statusFilter);
    }
  }

  query += ' ORDER BY created_at DESC';
  const orders = db.prepare(query).all(...params) as Order[];

  for (const o of orders) {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id) as OrderItem[];
  }

  return orders;
}

export function updateOrderQuotes(
  orderId: string,
  quotes: Array<{ order_item_id: string; vendor_unit_copper: number; save_to_catalog?: boolean; category?: string }>,
  runnerName: string
): Order | undefined {
  const order = getOrderById(orderId);
  if (!order) return undefined;

  const transaction = db.transaction(() => {
    let allPriced = true;

    for (const q of quotes) {
      const oi = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(q.order_item_id, orderId) as OrderItem | undefined;
      if (!oi) continue;

      const vendor_unit = Math.max(0, q.vendor_unit_copper);
      const payout_unit = calculatePayout(vendor_unit, order.payout_percent);

      db.prepare(`
        UPDATE order_items
        SET vendor_unit_copper = ?,
            payout_unit_copper = ?,
            is_priced = 1
        WHERE id = ?
      `).run(vendor_unit, payout_unit, q.order_item_id);

      // Auto-save to permanent catalog if requested or by default
      if (q.save_to_catalog !== false && vendor_unit > 0) {
        upsertItem({
          name: oi.item_name,
          category: q.category || 'Loot',
          vendor_price_copper: vendor_unit,
          created_by: runnerName
        });
      }
    }

    // Recheck if all items in order are priced now
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as OrderItem[];
    let total_vendor = 0;
    let total_payout = 0;

    for (const it of items) {
      if (!it.is_priced || it.vendor_unit_copper <= 0) {
        allPriced = false;
      }
      total_vendor += it.vendor_unit_copper * it.quantity;
      total_payout += it.payout_unit_copper * it.quantity;
    }

    const newStatus = allPriced && order.status === 'pending_quote' ? 'quoted' : order.status;

    db.prepare(`
      UPDATE orders
      SET total_vendor_copper = ?,
          total_payout_copper = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(total_vendor, total_payout, newStatus, orderId);

    db.prepare(`
      INSERT INTO order_events (id, order_id, event_type, actor_name, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'ev-' + crypto.randomUUID().slice(0, 8),
      orderId,
      'quoted',
      runnerName,
      `Items evaluated and quotes updated by runner ${runnerName}. Total payout calculated.`
    );
  });

  transaction();
  return getOrderById(orderId);
}

export function acceptOrder(
  orderId: string,
  runnerId: string,
  runnerName: string,
  eta?: string,
  notes?: string
): Order | undefined {
  const order = getOrderById(orderId);
  if (!order) return undefined;

  db.prepare(`
    UPDATE orders
    SET status = 'accepted',
        assigned_runner_id = ?,
        assigned_runner_name = ?,
        runner_eta = ?,
        runner_notes = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(runnerId, runnerName, eta || 'En route', notes || null, orderId);

  db.prepare(`
    INSERT INTO order_events (id, order_id, event_type, actor_name, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'ev-' + crypto.randomUUID().slice(0, 8),
    orderId,
    'accepted',
    runnerName,
    `Runner ${runnerName} accepted order! Estimated travel time: ${eta || 'En route'}.`
  );

  return getOrderById(orderId);
}

export function updateOrderStatus(
  orderId: string,
  status: Order['status'],
  actorName: string,
  message?: string
): Order | undefined {
  const completedAt = status === 'completed' ? new Date().toISOString() : null;

  db.prepare(`
    UPDATE orders
    SET status = ?,
        completed_at = COALESCE(?, completed_at),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, completedAt, orderId);

  const defaultMsgMap: Record<string, string> = {
    arrived: `${actorName} has arrived at your camp! Please initiate trade in-game.`,
    completed: `Trade completed! Runner has safely purchased inventory. Thank you for using our Mule Service!`,
    cancelled: `Order was cancelled. Reason: ${message || 'No reason provided'}.`
  };

  db.prepare(`
    INSERT INTO order_events (id, order_id, event_type, actor_name, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'ev-' + crypto.randomUUID().slice(0, 8),
    orderId,
    status,
    actorName,
    message || defaultMsgMap[status] || `Order status updated to ${status}`
  );

  return getOrderById(orderId);
}

export function addOrderEvent(orderId: string, actorName: string, message: string, eventType = 'chat_message'): OrderEvent {
  const id = 'ev-' + crypto.randomUUID().slice(0, 8);
  db.prepare(`
    INSERT INTO order_events (id, order_id, event_type, actor_name, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, orderId, eventType, actorName, message);

  return {
    id,
    order_id: orderId,
    event_type: eventType,
    actor_name: actorName,
    message,
    created_at: new Date().toISOString()
  };
}

export function getStats() {
  const totalCompleted = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'completed'").get() as { count: number };
  const activeOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status IN ('pending_quote', 'quoted', 'accepted', 'arrived')").get() as { count: number };
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_vendor_copper), 0) as vendor, COALESCE(SUM(total_payout_copper), 0) as payout FROM orders WHERE status = 'completed'").get() as { vendor: number; payout: number };
  const itemCount = db.prepare("SELECT COUNT(*) as count FROM items").get() as { count: number };
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };

  const totalProfit = totalRevenue.vendor - totalRevenue.payout;

  return {
    totalCompleted: totalCompleted.count,
    activeOrders: activeOrders.count,
    totalVendorCopper: totalRevenue.vendor,
    totalPayoutCopper: totalRevenue.payout,
    totalProfitCopper: totalProfit,
    itemCount: itemCount.count,
    userCount: userCount.count
  };
}
