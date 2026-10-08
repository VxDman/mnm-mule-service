# The Pillar Men — Camp Mule & Courier Service

A dedicated trade and camp courier web application for the *Monsters & Memories* guild **The Pillar Men** on server **Tilustra (NA East 2)**. 

Players camping in dungeons or wilderness zones can sell full inventories on the spot without breaking camp, while guild couriers run out coins, collect items, and sell to town vendors for profit.

---

## ✨ Core Features

### 🛒 Customer Ordering (Zero Login Required)
- **Instant Camp Quotes**: Customers enter items or pick standard **Equipment Tiers (T1–T4)** or **Guild Wanted Bounties** (e.g. Bone Chips, Spider Silk) for instant coin quotes.
- **Uncataloged Items**: Custom items can be submitted; runners quote them upon review, and prices are saved automatically for future orders.
- **Camp Location & Landmarks**: Describe camp landmarks, spawns, or group position (e.g., *"at ZL with East Commonlands, lower gnoll pit"*).
- **Live Order Tracking (`/order/[id]`)**: Real-time status updates, runner ETA, `/tell [Runner]` command copy button, and interactive camp dispatch log.

### 🏃 Guild Runner Operations (`/dashboard`)
- **Duty Toggle (`ON/OFF DUTY`)**: Service dynamically shows as OPEN when runners are on duty.
- **Orders Queue**: Accept incoming requests, price unlisted items, announce travel ETAs, and mark arrival/completion.
- **Audio Chime**: Web Audio sound alert on new incoming orders.
- **Master Price Catalog (`/items`)**: Manage base prices, standard tiers, and bonus payout bounties.

### 🛡️ Guild Administration (`/admin`)
- **Runner Credentials**: Add guildmates, manage roles (`admin` / `runner`), reset passwords, and edit in-game character names.
- **Service Configuration**: Update guild name, server realm, operational hours, default payout rate, and announcement banner (MOTD).

---

## 🔑 Default Administrator Login

On first run, the admin account is seeded with:
- **URL**: `/login`
- **Username**: `admin`
- **Password**: `ironmule2026`
- **Runner In-Game Name**: `Ptah`

*Credentials and in-game names can be updated anytime in `/admin`.*

---

## 🪙 Currency System

Uses *Monsters & Memories* 100:1 coin denominations:
- **1 Platinum (pp)** = 100 Gold = 10,000 Silver = 1,000,000 Copper
- **1 Gold (gp)** = 100 Silver = 10,000 Copper
- **1 Silver (sp)** = 100 Copper
- **1 Copper (cp)** = 1 Copper

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

```bash
# Production build
npm run build
npm start -- -p 3000

# Automated tests
node tests/test-suite.mjs
```
