import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSettings, updateSetting } from '@/lib/db';

export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json({ settings });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await req.json();

    if (body.guild_name !== undefined) updateSetting('guild_name', String(body.guild_name));
    if (body.guild_tag !== undefined) updateSetting('guild_tag', String(body.guild_tag));
    if (body.default_payout_percent !== undefined) updateSetting('default_payout_percent', String(body.default_payout_percent));
    if (body.motd !== undefined) updateSetting('motd', String(body.motd));

    const updated = getSettings();
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
