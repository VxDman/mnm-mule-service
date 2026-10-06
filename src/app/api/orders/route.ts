import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createOrder, getOrders } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required for order list' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';

    const orders = getOrders(status);
    return NextResponse.json({ orders });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer_name, zone, camp_location, customer_notes, items } = body;

    if (!customer_name || !zone || !camp_location) {
      return NextResponse.json({
        error: 'Character name, Zone, and Camp location are required'
      }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        error: 'At least one item must be added to your order'
      }, { status: 400 });
    }

    // Clean up items
    const validItems = items
      .filter((it: { item_name?: string }) => it && it.item_name && it.item_name.trim().length > 0)
      .map((it: { item_name: string; quantity?: number; notes?: string }) => ({
        item_name: it.item_name.trim(),
        quantity: Math.max(1, parseInt(String(it.quantity || 1), 10) || 1),
        notes: it.notes?.trim() || ''
      }));

    if (validItems.length === 0) {
      return NextResponse.json({
        error: 'Please provide at least one valid item name'
      }, { status: 400 });
    }

    const { order, customer_token } = createOrder({
      customer_name: customer_name.trim(),
      zone: zone.trim(),
      camp_location: camp_location.trim(),
      customer_notes: customer_notes?.trim() || '',
      items: validItems
    });

    return NextResponse.json({
      success: true,
      order,
      customer_token
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
