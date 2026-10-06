# Monsters & Memories Mule & Camp Courier Service

A dedicated trade and courier web application tailored for *Monsters & Memories* guilds. It allows players camping deep in dungeons and wilderness zones to sell their loot on the spot without breaking camp, while guild runners travel to them, buy their heavy inventory at a fair quote, and vendor the items in town for profit.

---

## ✨ Key Features

### 🛒 1. Customer Experience (Zero-Friction Order System)
- **No Account Required**: Customers place orders with their in-game character name and receive a unique Order Code (e.g. `MM-7530`) and secure link.
- **Location & /loc Coordinates**: Supports zone selection, camp descriptions, and exact in-game `/loc` coordinates.
- **Instant Quotes & Unknown Item Submission**:
  - Live item catalog search with autocomplete.
  - Items in catalog immediately show instant coin quotes in **Platinum (pp)**, **Gold (gp)**, **Silver (sp)**, and **Copper (cp)**.
  - Custom / unlisted items can be freely added; runners price them on review, and the prices are **automatically saved into the catalog for future customers**.
- **Live Order Tracking (`/order/[id]`)**:
  - 5-stage visual progress stepper: *Order Placed* → *Quote Ready* → *Runner Dispatched* → *Arrived at Camp* → *Trade Complete*.
  - Real-time polling updates when runners claim, travel, and arrive.
  - One-click **/tell [RunnerName]** whisper command copy button.
  - Interactive camp chat and dispatch updates.

### 🏃 2. Guild Runner Dashboard (`/dashboard`)
- **Real-Time Incoming Queue**:
  - Filter by *Needs Quote*, *Ready to Claim*, *My Active Runs*, and *History*.
  - Audio Chime on new incoming orders (synthesized Web Audio, no external sound files required).
- **Interactive Evaluation & Quoting**:
  - Enter town vendor prices with coin inputs (PP, GP, SP, CP).
  - Configurable auto-save to master catalog.
- **Dispatch Controls**:
  - Claim order and broadcast travel ETA (e.g., 2m, 5m, 10m).
  - Mark *Arrived at Camp* to notify customer to initiate trade.
  - Mark *Complete* to log successful transaction.
- **Guild Profit Tracking**: Real-time treasury calculations showing runner margins and total guild earnings.

### 📜 3. Master Price Catalog (`/items`)
- Search, filter by category, add, edit, and delete items.
- Pre-seeded with 35 classic Monsters & Memories items (pelts, weapons, gems, reagents, trophies).
- Displays Vendor Sell Value, Customer Payout, and Runner Profit Margin side-by-side.

### 🛡️ 4. Guild Administration (`/admin`)
- **Guildmate Credential Management**:
  - Create login accounts for runners with username, password, and in-game character name.
  - Assign roles (`Runner` or `Admin`).
  - One-click password reset.
- **Guild Configuration**:
  - Custom Guild Name & Tag (e.g., `[MULE] Ironforge Courier`).
  - Adjustable Payout Percentage (slider from 50% to 95%, default: **75%**).
  - Announcement banner (MOTD) displayed on the customer landing page.

---

## 🔑 Default Administrator Credentials

On first run, the system initializes with:
- **URL**: `/login`
- **Username**: `admin`
- **Password**: `ironmule2026`

*You can change this password or add other admins and runners inside the Admin Panel.*

---

## 🪙 Currency Denominations

The currency system follows standard retro fantasy MMO conversions:
- **1 Platinum (pp)** = 10 Gold = 1,000 Copper
- **1 Gold (gp)** = 10 Silver = 100 Copper
- **1 Silver (sp)** = 10 Copper
- **1 Copper (cp)** = 1 Copper

All values are stored with integer precision in copper units.

---

## 🚀 Running the Service

### Development Mode:
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000)

### Production Mode:
```bash
pnpm build
pnpm start -p 3000
```

### Running Automated Test Suite:
```bash
node tests/test-suite.mjs
```
