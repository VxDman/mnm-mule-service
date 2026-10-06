import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOrderById, updateOrderStatus } from '@/lib/db';
import { OrderStatus } from '@/types';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { status, message, token } = body;

    const validStatuses: OrderStatus[] = ['pending_quote', 'quoted', 'accepted', 'arrived', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const order = getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const user = await getCurrentUser();

    // Check permissions
    if (user) {
      // Logged in guild member
      const updated = updateOrderStatus(id, status, user.display_name, message);
      return NextResponse.json({ success: true, order: updated });
    } else if (token && token === order.customer_token) {
      // Customer is updating their order (e.g. cancelling before it completes)
      if (status !== 'cancelled') {
        return NextResponse.json({ error: 'Customers may only cancel their own order' }, { status: 403 });
      }
      if (order.status === 'completed') {
        return NextResponse.json({ error: 'Completed orders cannot be cancelled' }, { status: 400 });
      }
      const updated = updateOrderStatus(id, 'cancelled', `Customer (${order.customer_name})`, message || 'Cancelled by customer');
      return NextResponse.json({ success: true, order: updated });
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
