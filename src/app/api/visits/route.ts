import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const visits = await prisma.infirmaryVisit.findMany({
      include: {
        student: true,
        dispensedItems: {
          include: {
            medication: true,
          },
        },
      },
      orderBy: { visitedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(visits);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch visits' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      studentId,
      symptoms,
      bodyTemperature,
      bloodPressure,
      pulseRate,
      bedRest,
      bedRestStart,
      bedRestEnd,
      treatmentNotes,
      dispensedMedicines,
    } = body;

    if (!studentId || !symptoms) {
      return NextResponse.json({ error: 'Student and symptoms are required' }, { status: 400 });
    }

    const createdVisit = await prisma.$transaction(async (tx) => {
      const visit = await tx.infirmaryVisit.create({
        data: {
          studentId,
          symptoms,
          bodyTemperature: bodyTemperature ? parseFloat(bodyTemperature) : null,
          bloodPressure: bloodPressure || null,
          pulseRate: pulseRate ? parseInt(pulseRate, 10) : null,
          bedRest: Boolean(bedRest),
          bedRestStart: bedRestStart ? new Date(bedRestStart) : null,
          bedRestEnd: bedRestEnd ? new Date(bedRestEnd) : null,
          treatmentNotes: treatmentNotes || null,
          status: 'COMPLETED',
        },
      });

      if (Array.isArray(dispensedMedicines) && dispensedMedicines.length > 0) {
        for (const item of dispensedMedicines) {
          if (!item.medicationId || !item.quantity || item.quantity <= 0) continue;

          await tx.dispensedItem.create({
            data: {
              visitId: visit.id,
              medicationId: item.medicationId,
              quantity: item.quantity,
              instructions: item.instructions || null,
            },
          });

          await tx.medication.update({
            where: { id: item.medicationId },
            data: {
              stockQuantity: {
                decrement: item.quantity,
              },
            },
          });
        }
      }

      return visit;
    });

    const fullVisit = await prisma.infirmaryVisit.findUnique({
      where: { id: createdVisit.id },
      include: {
        student: true,
        dispensedItems: {
          include: {
            medication: true,
          },
        },
      },
    });

    return NextResponse.json(fullVisit, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to record visit' }, { status: 500 });
  }
}
