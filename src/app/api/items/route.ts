import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllItems, searchItems, getPreferredItems, getTierItems, upsertItem, deleteItem } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const preferredOnly = searchParams.get('preferred') === 'true';
    const tierOnly = searchParams.get('tier') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;

    if (preferredOnly) {
      const items = getPreferredItems();
      return NextResponse.json({ items });
    }

    if (tierOnly) {
      const items = getTierItems();
      return NextResponse.json({ items });
    }

    if (query !== null) {
      const items = searchItems(query, limit);
      return NextResponse.json({ items });
    }

    const items = getAllItems();
    return NextResponse.json({ items });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      category,
      vendor_price_copper,
      stack_size,
      notes,
      is_preferred,
      preferred_payout_percent,
      preferred_bounty_notes,
      can_buy
    } = body;

    if (!name || vendor_price_copper === undefined) {
      return NextResponse.json({ error: 'Item name and vendor price are required' }, { status: 400 });
    }

    const item = upsertItem({
      name: name.trim(),
      category: category?.trim() || 'Loot',
      vendor_price_copper: Math.max(0, parseInt(vendor_price_copper, 10) || 0),
      stack_size: Math.max(1, parseInt(stack_size, 10) || 1),
      notes: notes?.trim() || '',
      is_preferred: is_preferred ? 1 : 0,
      preferred_payout_percent: preferred_payout_percent ? parseInt(preferred_payout_percent, 10) : null,
      preferred_bounty_notes: preferred_bounty_notes?.trim() || null,
      can_buy: can_buy !== undefined ? (can_buy ? 1 : 0) : 1,
      created_by: user.display_name
    });

    return NextResponse.json({ item });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
    }

    deleteItem(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
