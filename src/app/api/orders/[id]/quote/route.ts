import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateOrderQuotes } from '@/lib/db';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Runner or Admin authentication required' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { quotes } = body;

    if (!Array.isArray(quotes) || quotes.length === 0) {
      return NextResponse.json({ error: 'Quotes array is required' }, { status: 400 });
    }

    const updated = updateOrderQuotes(id, quotes, user.display_name);
    if (!updated) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
