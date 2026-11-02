export const dynamic = 'force-dynamic';
import {prisma} from '@/lib/db';

export async function GET() {
  try { await prisma.$queryRaw`SELECT 1`; }
  catch { return Response.json({application:'spk-infirmary',ready:false},{status:503}); }
  return Response.json(
    { application: 'spk-infirmary', startupNonce: process.env.INFIRMARY_STARTUP_NONCE || null },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    }
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
