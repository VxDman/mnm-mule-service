import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getUserById } from './db';
import { User } from '@/types';

const SECRET_KEY = process.env.JWT_SECRET || 'mule-trade-secret-guild-key-2026-m&m';
const encodedKey = new TextEncoder().encode(SECRET_KEY);
const COOKIE_NAME = 'mule_auth_session';

export async function createSessionToken(user: User): Promise<string> {
  return await new SignJWT({
    userId: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, encodedKey);
    return payload as { userId: string; username: string; role: 'admin' | 'runner'; displayName: string };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload || !payload.userId) return null;

  const user = getUserById(payload.userId);
  return user || null;
}

export { COOKIE_NAME };
