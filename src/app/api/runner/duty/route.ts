import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { setRunnerDutyStatus, getOnlineRunners, getSettings } from '@/lib/db';

export async function GET() {
  try {
    const settings = getSettings();
    const onlineRunners = getOnlineRunners();

    return NextResponse.json({
      is_service_open: settings.is_service_open,
      hours_of_operation: settings.hours_of_operation,
      online_runners: onlineRunners
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Runner or Admin authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { is_online } = body;

    setRunnerDutyStatus(user.id, !!is_online);

    const settings = getSettings();
    const onlineRunners = getOnlineRunners();

    return NextResponse.json({
      success: true,
      user_id: user.id,
      is_online: !!is_online,
      is_service_open: settings.is_service_open,
      online_runners: onlineRunners
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
