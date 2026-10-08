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
      is_online INTEGER NOT NULL DEFAULT 0,
      last_seen_at DATETIME,
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
      is_preferred INTEGER NOT NULL DEFAULT 0,
      preferred_payout_percent INTEGER,
      preferred_bounty_notes TEXT,
      can_buy INTEGER NOT NULL DEFAULT 1,
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
      is_preferred INTEGER NOT NULL DEFAULT 0,
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
  `);

  // Safe migrations for newly added columns if table previously existed
  const addColumnSafe = (table: string, columnDef: string) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    } catch {
      // Column already exists
    }
  };

  addColumnSafe('users', 'is_online INTEGER NOT NULL DEFAULT 0');
  addColumnSafe('users', 'last_seen_at DATETIME');
  addColumnSafe('items', 'is_preferred INTEGER NOT NULL DEFAULT 0');
  addColumnSafe('items', 'preferred_payout_percent INTEGER');
  addColumnSafe('items', 'preferred_bounty_notes TEXT');
  addColumnSafe('items', 'can_buy INTEGER NOT NULL DEFAULT 1');
  addColumnSafe('order_items', 'is_preferred INTEGER NOT NULL DEFAULT 0');

  // Create indexes now that columns are guaranteed to exist
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
    CREATE INDEX IF NOT EXISTS idx_items_preferred ON items(is_preferred);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);
  `);
}

export function parsePriceToCopper(str: string): number {
  if (!str || !str.trim()) return 0;
  const s = str.trim().toLowerCase();
  let total = 0;

  const ppMatch = s.match(/(\d+)\s*(?:plat|platinum|pp)/);
  if (ppMatch) total += parseInt(ppMatch[1], 10) * 1000000;

  const gpMatch = s.match(/(\d+)\s*(?:gold|gp)/);
  if (gpMatch) total += parseInt(gpMatch[1], 10) * 10000;

  const spMatch = s.match(/(\d+)\s*(?:silver|sp)/);
  if (spMatch) total += parseInt(spMatch[1], 10) * 100;

  const cpMatch = s.match(/(\d+)\s*(?:copper|cp)/);
  if (cpMatch) total += parseInt(cpMatch[1], 10);

  if (total === 0 && /^\d+$/.test(s)) {
    total = parseInt(s, 10);
  }
  return total;
}

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (/^t[1-4]\s/i.test(name) || n.includes("tier equipment")) {
    return "Tier Equipment";
  }
  if (n.includes('sword') || n.includes('dagger') || n.includes('axe') || n.includes('mace') || n.includes('spear') || n.includes('bow') || n.includes('staff') || n.includes('scythe') || n.includes('cleaver') || n.includes('lance') || n.includes('trident') || n.includes('hammer') || n.includes('maul')) {
    return 'Weapon';
  }
  if (n.includes('shield') || n.includes('buckler') || n.includes('tunic') || n.includes('boots') || n.includes('bracer') || n.includes('cap') || n.includes('robe') || n.includes('leggings') || n.includes('gloves') || n.includes('cloak') || n.includes('belt') || n.includes('gorget') || n.includes('mantle') || n.includes('veil') || n.includes('mask') || n.includes('vest') || n.includes('gambeson') || n.includes('shoulderg') || n.includes('shoulder')) {
    return 'Armor / Shield';
  }
  if (n.includes('pelt') || n.includes('fur') || n.includes('hide') || n.includes('skin')) {
    return 'Pelt / Leather';
  }
  if (n.includes('meat') || n.includes('pepper') || n.includes('carrot') || n.includes('cabbage') || n.includes('potato') || n.includes('tomato') || n.includes('garlic')) {
    return 'Food / Provision';
  }
  if (n.includes('silk') || n.includes('venom') || n.includes('eye') || n.includes('tooth') || n.includes('fang') || n.includes('bone') || n.includes('carapace') || n.includes('gland') || n.includes('leg') || n.includes('root') || n.includes('wing') || n.includes('foot') || n.includes('ear') || n.includes('wood')) {
    return 'Reagent / Trade Skill';
  }
  return 'Loot';
}

function seedInitialData(db: Database.Database) {
  // 1. Seed Settings (Guild Name: "The Pillar Men", no guild tag)
  const defaultSettings: Record<string, string> = {
    guild_name: 'The Pillar Men',
    server_name: 'Tilustra (NA East 2)',
    hours_of_operation: 'Daily 6:00 PM - 2:00 AM EST (or whenever runners are on duty)',
    default_payout_percent: '75',
    service_status_mode: 'auto',
    motd: 'The Pillar Men Mule Service — Full bags at camp? Stay put, we come to your camp and buy your inventory on the spot!'
  };

  const insertSetting = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }

  // Remove old guild_tag setting if it existed
  db.prepare("DELETE FROM settings WHERE key = 'guild_tag'").run();

  // 2. Seed Default Admin User (Ptah)
  const existingAdmin = db.prepare('SELECT id, display_name FROM users WHERE username = ?').get('admin') as { id: string; display_name: string } | undefined;
  if (!existingAdmin) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('ironmule2026', salt);
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role, is_online)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run('user-admin-default', 'admin', hash, 'Ptah', 'admin');
  } else if (existingAdmin.display_name === 'Santana (Quartermaster)' || existingAdmin.display_name === 'Quartermaster Grimm') {
    db.prepare('UPDATE users SET display_name = ? WHERE username = ?').run('Ptah', 'admin');
  }

  // Purge any individual equipment entries replaced by Tier Equipments
  const replacedEquipment = [
    'Cleaver', 'Cracked Staff', 'Rusty Axe', 'Rusty Battle Axe', 'Rusty Dagger',
    'Rusty Great Scythe', 'Rusty Greatsword', 'Rusty Kite Shield', 'Rusty Long Spear',
    'Rusty Longsword', 'Rusty Mace', 'Rusty Maul', 'Rusty Scimitar', 'Rusty Scythe',
    'Rusty Shortsword', 'Rusty Spear', 'Rusty Tower Shield', 'Rusty Trident',
    'Rusty War Lance', 'Rusty Warhammer', 'Worn Bow', 'Worn Buckler',
    'Worn Fine Wood Bow', 'Worn Fine Wood Buckler', 'Worn Great Staff',
    'Corroded Bronze Chain Gambeson', 'Corroded Bronze Chain Shoulderguards',
    'Corroded Bronze Chain Wristguard', 'Corroded Bronze Dagger', 'Corroded Bronze Kite Shield',
    'Corroded Bronze Scythe', 'Corroded Bronze War Lance', 'Spider Silk Cape',
    'Tattered Cloth Belt', 'Tattered Cloth Boots', 'Tattered Cloth Bracer',
    'Tattered Cloth Cap', 'Tattered Cloth Cape', 'Tattered Cloth Gloves',
    'Tattered Cloth Gorget', 'Tattered Cloth Mantle', 'Tattered Cloth Robe',
    'Tattered Cloth Tunic', 'Tattered Cloth Veil', 'Tattered Rawhide Belt',
    'Tattered Rawhide Boots', 'Tattered Rawhide Bracer', 'Tattered Rawhide Cap',
    'Tattered Rawhide Cloak', 'Tattered Rawhide Gloves', 'Tattered Rawhide Gorget',
    'Tattered Rawhide Leggings', 'Tattered Rawhide Mask', 'Tattered Rawhide Shoulderpads',
    'Tattered Rawhide Tunic', 'Tattered Rawhide Vest',
    'Rusty Short Sword', 'Rusty Broad Sword', 'Rusty Two Handed Sword', 'Rusty Halberd',
    'Bronze Longsword', 'Bronze Mace', 'Fine Steel Dagger', 'Fine Steel Scimitar', 'Fine Steel Two Handed Sword'
  ];
  for (const itName of replacedEquipment) {
    db.prepare('DELETE FROM items WHERE name = ? COLLATE NOCASE').run(itName);
  }

  // 3. Import & Seed items from Google Sheet CSV (data/imported_prices.csv)
  const csvPath = path.join(process.cwd(), 'data', 'imported_prices.csv');
  if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    lines.shift(); // Remove header

    
        const upsertItemStmt = db.prepare(`
      INSERT INTO items (
        id, name, category, vendor_price_copper, stack_size, notes,
        is_preferred, preferred_payout_percent, preferred_bounty_notes, can_buy, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GoogleSheet Import')
      ON CONFLICT(name) DO UPDATE SET
        vendor_price_copper = excluded.vendor_price_copper,
        can_buy = excluded.can_buy,
        is_preferred = excluded.is_preferred,
        preferred_payout_percent = excluded.preferred_payout_percent,
        preferred_bounty_notes = excluded.preferred_bounty_notes
    `);

    const standardTierItems = [
      { name: 'T1 Cloth Armor', category: 'Tier Equipment', price: 25, notes: 'Standard T1 Cloth Armor piece (Tattered Cloth Robe, Tunic, Boots, Veil, etc.)' },
      { name: 'T1 Leather Armor', category: 'Tier Equipment', price: 40, notes: 'Standard T1 Leather / Rawhide piece (Tattered Rawhide Tunic, Leggings, Boots, etc.)' },
      { name: 'T1 Rusty 1H Weapon', category: 'Tier Equipment', price: 13, notes: 'Standard T1 1H Weapon (Rusty Dagger, Shortsword, Mace, Axe, Spear, etc.)' },
      { name: 'T1 Rusty 2H Weapon', category: 'Tier Equipment', price: 25, notes: 'Standard T1 2H Weapon (Rusty Greatsword, Battle Axe, Maul, War Lance, etc.)' },
      { name: 'T1 Rusty Shield', category: 'Tier Equipment', price: 25, notes: 'Standard T1 Shield (Rusty Kite Shield, Tower Shield, Buckler)' },
      { name: 'T1 Worn Bow / Staff', category: 'Tier Equipment', price: 50, notes: 'Standard T1 Wooden Bow or Caster Staff (Cracked Staff, Worn Staff, Worn Bow)' },
      { name: 'T2 Chain Armor', category: 'Tier Equipment', price: 125, notes: 'Standard T2 Chain piece (Corroded Bronze Chain Gambeson, Shoulderguards, Wristguards)' },
      { name: 'T2 Leather Armor', category: 'Tier Equipment', price: 80, notes: 'Standard T2 Cured Leather piece' },
      { name: 'T2 Bronze Weapon', category: 'Tier Equipment', price: 125, notes: 'Standard T2 Bronze 1H Weapon (Corroded Bronze Dagger, etc.)' },
      { name: 'T2 Bronze 2H Weapon', category: 'Tier Equipment', price: 150, notes: 'Standard T2 Bronze 2H Weapon (Corroded Bronze War Lance, Scythe, etc.)' },
      { name: 'T2 Bronze Shield', category: 'Tier Equipment', price: 62, notes: 'Standard T2 Shield (Corroded Bronze Kite Shield)' },
      { name: 'T2 Fine Wood Bow', category: 'Tier Equipment', price: 250, notes: 'Standard T2 Fine Wood Bow (Worn Fine Wood Bow)' },
      { name: 'T3 Bronze Weapon', category: 'Tier Equipment', price: 300, notes: 'Standard T3 Bronze Weapon (Pristine Bronze 1H/2H)' },
      { name: 'T3 Bronze 2H Weapon', category: 'Tier Equipment', price: 400, notes: 'Standard T3 Heavy Bronze 2H Weapon' },
      { name: 'T3 Chain Armor', category: 'Tier Equipment', price: 350, notes: 'Standard T3 Chain Armor piece' },
      { name: 'T3 Leather Armor', category: 'Tier Equipment', price: 180, notes: 'Standard T3 Hardened Leather piece' },
      { name: 'T3 Iron Weapon', category: 'Tier Equipment', price: 450, notes: 'Standard T3 Iron Weapon' },
      { name: 'T3 Iron Shield', category: 'Tier Equipment', price: 200, notes: 'Standard T3 Iron Shield' },
      { name: 'T3 Iron Plate Armor', category: 'Tier Equipment', price: 500, notes: 'Standard T3 Iron Plate piece' },
      { name: 'T4 Steel Weapon', category: 'Tier Equipment', price: 800, notes: 'Standard T4 Fine Steel Weapon' },
      { name: 'T4 Plate / Chain Armor', category: 'Tier Equipment', price: 1000, notes: 'Standard T4 Fine Plate or Chain piece (10 silver)' },
    ];

    for (const tItem of standardTierItems) {
      upsertItemStmt.run(
        'item-' + crypto.randomUUID().slice(0, 8),
        tItem.name,
        tItem.category,
        tItem.price,
        1,
        tItem.notes,
        0,
        null,
        null,
        1
      );
    }



    // Define Preferred Bounty Items & custom payout rates
    const preferredBounties: Record<string, { percent: number; notes: string }> = {
      'Bone Chips': { percent: 100, notes: '⭐ Guild Research Bounty: Necromancer Spell Component (Bought even at 1c!)' },
      'Spider Silk': { percent: 90, notes: '⭐ High Demand Tailoring Crafting Bounty' },
      'Spider Venom Sac': { percent: 90, notes: '⭐ Poison & Alchemy Guild Reagent Bounty' },
      'Immature Snake Venom Sac': { percent: 85, notes: '⭐ Alchemy Component Bounty' },
      'Fire Beetle Eye': { percent: 90, notes: '⭐ Light Source & Spell Reagent Bounty' },
      'Harvallen Root': { percent: 90, notes: '⭐ High-Value Foraged Root Bounty' },
      'Crocodile Hide': { percent: 85, notes: '⭐ Heavy Armor & Crafting Leather Bounty' },
      'Ashira Warrior Pelt': { percent: 85, notes: '⭐ Trophy & Tailoring Bounty' }
    };

    const transaction = db.transaction(() => {
      for (const line of lines) {
        const parts = line.split(',');
        const name = parts[0]?.trim();
        if (!name) continue;

        const earlierCopper = parsePriceToCopper(parts[1] || '');
        const higherCopper = parsePriceToCopper(parts[2] || '');
        const otherCopper = parsePriceToCopper(parts[3] || '');

        // Logic: "use the highest price if available, or earliest price"
        let finalPrice = higherCopper > 0 ? higherCopper : earlierCopper;
        if (otherCopper > finalPrice) {
          finalPrice = otherCopper;
        }

        // Logic: "Any 1c item would not be bought, except for bone chips (make an exception)."
        const isBoneChips = name.toLowerCase() === 'bone chips';
        const canBuy = isBoneChips || finalPrice > 1;

        const bounty = preferredBounties[name];
        const isPreferred = bounty ? 1 : 0;
        const preferredPercent = bounty ? bounty.percent : null;
        const bountyNotes = bounty ? bounty.notes : null;

        let adaptedNotes = bountyNotes || (canBuy ? 'Imported from verified price registry' : '1c vendor trash - not purchased by runners');


        const category = guessCategory(name);
        const stackSize = category.includes('Reagent') || category.includes('Food') || isBoneChips ? 20 : 1;

        upsertItemStmt.run(
          'item-' + crypto.randomUUID().slice(0, 8),
          name,
          category,
          finalPrice,
          stackSize,
          adaptedNotes,
          isPreferred,
          preferredPercent,
          bountyNotes,
          canBuy ? 1 : 0
        );
      }
    });

    transaction();
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

  const onlineRunners = getOnlineRunners();
  const serviceMode = map.service_status_mode || 'auto';
  const isOpen = serviceMode === 'open' || (serviceMode === 'auto' && onlineRunners.length > 0);

  return {
    guild_name: map.guild_name || 'The Pillar Men',
    server_name: map.server_name || 'Tilustra (NA East 2)',
    hours_of_operation: map.hours_of_operation || 'Daily 6:00 PM - 2:00 AM EST (or whenever runners are on duty)',
    default_payout_percent: parseInt(map.default_payout_percent || '75', 10),
    motd: map.motd || '',
    service_status_mode: serviceMode,
    is_service_open: isOpen,
    online_runners: onlineRunners
  };
}

export function updateSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

// Runner Duty & Online Status
export function setRunnerDutyStatus(userId: string, isOnline: boolean): void {
  db.prepare(`
    UPDATE users
    SET is_online = ?,
        last_seen_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(isOnline ? 1 : 0, userId);
}

export function getOnlineRunners(): Array<{ id: string; display_name: string }> {
  return db.prepare(`
    SELECT id, display_name
    FROM users
    WHERE is_online = 1
    ORDER BY display_name ASC
  `).all() as Array<{ id: string; display_name: string }>;
}

// User Queries
export function getUserByUsername(username: string): UserWithPassword | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as UserWithPassword | undefined;
}

export function getUserById(id: string): User | undefined {
  return db.prepare('SELECT id, username, display_name, role, is_online, last_seen_at, created_at FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getAllUsers(): User[] {
  return db.prepare('SELECT id, username, display_name, role, is_online, last_seen_at, created_at FROM users ORDER BY created_at ASC').all() as User[];
}

export function createUser(data: { username: string; password: string; display_name: string; role: 'admin' | 'runner' }): User {
  const id = 'user-' + crypto.randomUUID().slice(0, 8);
  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(data.password, salt);
  db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role, is_online)
    VALUES (?, ?, ?, ?, ?, 0)
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

export function searchItems(query: string, limit = 50): Item[] {
  if (!query || query.trim() === '') {
    return db.prepare('SELECT * FROM items WHERE can_buy = 1 ORDER BY is_preferred DESC, name ASC LIMIT ?').all(limit) as Item[];
  }
  const clean = `%${query.trim()}%`;
  return db.prepare('SELECT * FROM items WHERE name LIKE ? AND can_buy = 1 ORDER BY is_preferred DESC, name ASC LIMIT ?').all(clean, limit) as Item[];
}

export function getTierItems(): Item[] {
  return db.prepare("SELECT * FROM items WHERE category = 'Tier Equipment' AND can_buy = 1 ORDER BY name ASC").all() as Item[];
}

export function getPreferredItems(): Item[] {
  return db.prepare('SELECT * FROM items WHERE is_preferred = 1 AND can_buy = 1 ORDER BY name ASC').all() as Item[];
}

export function getAllItems(): Item[] {
  return db.prepare('SELECT * FROM items ORDER BY is_preferred DESC, name ASC').all() as Item[];
}

export function upsertItem(item: {
  name: string;
  category?: string;
  vendor_price_copper: number;
  stack_size?: number;
  notes?: string;
  is_preferred?: number;
  preferred_payout_percent?: number | null;
  preferred_bounty_notes?: string | null;
  can_buy?: number;
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
          is_preferred = COALESCE(?, is_preferred),
          preferred_payout_percent = COALESCE(?, preferred_payout_percent),
          preferred_bounty_notes = COALESCE(?, preferred_bounty_notes),
          can_buy = COALESCE(?, can_buy),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      item.vendor_price_copper,
      item.category || null,
      item.stack_size || null,
      item.notes || null,
      item.is_preferred !== undefined ? item.is_preferred : null,
      item.preferred_payout_percent !== undefined ? item.preferred_payout_percent : null,
      item.preferred_bounty_notes !== undefined ? item.preferred_bounty_notes : null,
      item.can_buy !== undefined ? item.can_buy : null,
      existing.id
    );
    return findItemByName(item.name)!;
  } else {
    const id = 'item-' + crypto.randomUUID().slice(0, 8);
    db.prepare(`
      INSERT INTO items (
        id, name, category, vendor_price_copper, stack_size, notes,
        is_preferred, preferred_payout_percent, preferred_bounty_notes, can_buy, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      item.name.trim(),
      item.category || 'Loot',
      item.vendor_price_copper,
      item.stack_size || 1,
      item.notes || null,
      item.is_preferred || 0,
      item.preferred_payout_percent || null,
      item.preferred_bounty_notes || null,
      item.can_buy !== undefined ? item.can_buy : 1,
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
  const base_payout_percent = settings.default_payout_percent;

  let orderId = generateOrderId();
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
      const effectivePayoutPercent = (knownItem.is_preferred && knownItem.preferred_payout_percent)
        ? knownItem.preferred_payout_percent
        : base_payout_percent;

      const vendor_unit = knownItem.vendor_price_copper;
      let payout_unit = calculatePayout(vendor_unit, effectivePayoutPercent);

      if (knownItem.name.toLowerCase() === 'bone chips' && payout_unit === 0) {
        payout_unit = 1;
      }

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
        is_preferred: knownItem.is_preferred || 0,
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
        is_preferred: 0,
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
      base_payout_percent,
      total_vendor,
      total_payout
    );

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (
        id, order_id, item_id, item_name, quantity, vendor_unit_copper,
        payout_unit_copper, is_priced, is_preferred, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        item.is_preferred,
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
        ? `Order placed with ${preparedItems.length} item(s). Runner review needed for unpriced items.`
        : `Order placed with ${preparedItems.length} item(s). All items priced from catalog!`
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
  quotes: Array<{
    order_item_id: string;
    vendor_unit_copper: number;
    save_to_catalog?: boolean;
    category?: string;
    is_preferred?: boolean;
    preferred_payout_percent?: number;
  }>,
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
      const effectiveRate = q.is_preferred && q.preferred_payout_percent ? q.preferred_payout_percent : order.payout_percent;
      let payout_unit = calculatePayout(vendor_unit, effectiveRate);

      if (oi.item_name.toLowerCase() === 'bone chips' && payout_unit === 0 && vendor_unit > 0) {
        payout_unit = 1;
      }

      db.prepare(`
        UPDATE order_items
        SET vendor_unit_copper = ?,
            payout_unit_copper = ?,
            is_priced = 1,
            is_preferred = ?
        WHERE id = ?
      `).run(vendor_unit, payout_unit, q.is_preferred ? 1 : 0, q.order_item_id);

      // Auto-save to permanent catalog
      if (q.save_to_catalog !== false && vendor_unit > 0) {
        upsertItem({
          name: oi.item_name,
          category: q.category || 'Loot',
          vendor_price_copper: vendor_unit,
          is_preferred: q.is_preferred ? 1 : 0,
          preferred_payout_percent: q.preferred_payout_percent || null,
          created_by: runnerName
        });
      }
    }

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
    completed: `Trade completed! Runner has safely purchased inventory. Thank you for using The Pillar Men Mule Service!`,
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
  const itemCount = db.prepare("SELECT COUNT(*) as count FROM items WHERE can_buy = 1").get() as { count: number };
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  const onlineRunnersCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE is_online = 1").get() as { count: number };
  const preferredCount = db.prepare("SELECT COUNT(*) as count FROM items WHERE is_preferred = 1 AND can_buy = 1").get() as { count: number };

  const totalProfit = totalRevenue.vendor - totalRevenue.payout;

  return {
    totalCompleted: totalCompleted.count,
    activeOrders: activeOrders.count,
    totalVendorCopper: totalRevenue.vendor,
    totalPayoutCopper: totalRevenue.payout,
    totalProfitCopper: totalProfit,
    itemCount: itemCount.count,
    userCount: userCount.count,
    onlineRunnersCount: onlineRunnersCount.count,
    preferredCount: preferredCount.count
  };
}
