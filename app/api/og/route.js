import { ImageResponse } from 'next/og';
import { connection } from 'next/server';

export async function GET(request) {
  await connection();
  const { searchParams } = new URL(request.url);
  const rawName = searchParams.get('name') || 'SteamVault';
  // Strip special Unicode symbols that default Satori fonts render as [ ]
  const name = rawName.replace(/[^\x20-\x7E]/g, '').trim() || rawName;
  const avatar = searchParams.get('avatar') || '';
  const games = searchParams.get('games') || '0';
  const hours = searchParams.get('hours') || '0';
  const value = searchParams.get('value') || '0';
  const unplayed = searchParams.get('unplayed') || '0%';
