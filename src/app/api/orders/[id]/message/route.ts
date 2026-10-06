import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOrderById, addOrderEvent } from '@/lib/db';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { message, token } = body;

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    const order = getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const user = await getCurrentUser();
    let actorName = 'Runner';

    if (user) {
      actorName = `Runner ${user.display_name}`;
    } else if (token && token === order.customer_token) {
      actorName = `Customer ${order.customer_name}`;
    } else {
      return NextResponse.json({ error: 'Unauthorized to post messages' }, { status: 401 });
    }

    const event = addOrderEvent(id, actorName, message.trim(), 'chat_message');
    return NextResponse.json({ success: true, event });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
