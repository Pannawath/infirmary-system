import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';

    const students = await prisma.student.findMany({
      where: query
        ? {
            OR: [
              { studentCode: { contains: query } },
              { fullName: { contains: query } },
            ],
          }
        : undefined,
      orderBy: { studentCode: 'asc' },
      take: 20,
    });

    return NextResponse.json(students);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}
