import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllItems, searchItems, upsertItem, deleteItem } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

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
    const { name, category, vendor_price_copper, stack_size, notes } = body;

    if (!name || vendor_price_copper === undefined) {
      return NextResponse.json({ error: 'Item name and vendor price are required' }, { status: 400 });
    }

    const item = upsertItem({
      name: name.trim(),
      category: category?.trim() || 'Loot',
      vendor_price_copper: Math.max(0, parseInt(vendor_price_copper, 10) || 0),
      stack_size: Math.max(1, parseInt(stack_size, 10) || 1),
      notes: notes?.trim() || '',
      created_by: user.display_name
    });

    return NextResponse.json({ success: true, item });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    deleteItem(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
