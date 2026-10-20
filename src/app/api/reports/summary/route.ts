import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bangkokDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const today = new Date(`${bangkokDate}T00:00:00+07:00`);

    const [totalVisits, todayVisits, totalStudents, lowStockCount, recentVisits, topMeds] = await Promise.all([
      prisma.infirmaryVisit.count(),
      prisma.infirmaryVisit.count({
        where: { visitedAt: { gte: today } },
      }),
      prisma.student.count({where:{isActive:true}}),
      prisma.medication.count({
        where: { stockQuantity: { lte: 15 } },
      }),
      prisma.infirmaryVisit.findMany({
        take: 5,
        orderBy: { visitedAt: 'desc' },
        include: { student: true, dispensedItems: { include: { medication: true } } },
      }),
      prisma.dispensedItem.groupBy({
        by: ['medicationId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const medDetails = await prisma.medication.findMany({
      where: { id: { in: topMeds.map((m) => m.medicationId) } },
    });
    const allMeds = await prisma.medication.findMany();
    const todayDispensed = await prisma.dispensedItem.count({ where: { visit: { visitedAt: { gte: today } } } });

    const topMedicationsWithNames = topMeds.map((item) => {
      const med = medDetails.find((m) => m.id === item.medicationId);
      return {
        name: med ? med.name : 'Unknown',
        totalDispensed: item._sum.quantity || 0,
        unit: med?.unit || 'หน่วย',
      };
    });

    return NextResponse.json({
      summary: {
        totalVisits,
        todayVisits,
        totalStudents,
        lowStockCount: allMeds.filter(m => m.stockQuantity <= m.minThreshold).length,
        todayDispensed,
      },
      recentVisits,
      topMedications: topMedicationsWithNames,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate statistics' }, { status: 500 });
  }
}
