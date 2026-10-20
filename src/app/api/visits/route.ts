import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type {Prisma} from '@prisma/client';

export async function GET(request:Request) {
  try {
    const params=new URL(request.url).searchParams;
    if(params.get('history')==='1'){
      const q=params.get('q')?.trim()||'';const medication=params.get('medication')?.trim()||'';
      const grade=params.get('grade')||'';const room=params.get('room')||'';const service=params.get('service')||'';
      const from=params.get('from')||'';const to=params.get('to')||'';
      const page=Math.max(1,Math.min(100000,Math.floor(Number(params.get('page'))||1)));
      if(service&&!['DISPENSE','WOUND_CARE','REST'].includes(service))return NextResponse.json({error:'ประเภทบริการไม่ถูกต้อง'},{status:400});
      const range:Prisma.DateTimeFilter={};
      for(const [value,key] of [[from,'gte'],[to,'lt']] as const){if(!value)continue;if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return NextResponse.json({error:'รูปแบบวันที่ไม่ถูกต้อง'},{status:400});const date=new Date(`${value}T00:00:00+07:00`);if(!Number.isFinite(+date))return NextResponse.json({error:'วันที่ไม่ถูกต้อง'},{status:400});if(key==='lt')date.setUTCDate(date.getUTCDate()+1);range[key]=date;}
      if(from&&to&&from>to)return NextResponse.json({error:'วันเริ่มต้นต้องไม่เกินวันสิ้นสุด'},{status:400});
      const where:Prisma.InfirmaryVisitWhereInput={
        ...(service?{serviceType:service}:{}),...(from||to?{visitedAt:range}:{}),
        ...(grade||room?{student:{...(grade?{gradeLevel:grade}:{}),...(room?{classroom:room}:{})}}:{}),
        ...(medication?{dispensedItems:{some:{medication:{name:{contains:medication}}}}}:{}),
        ...(q?{OR:[{student:{fullName:{contains:q}}},{student:{studentCode:{contains:q}}},{symptoms:{contains:q}},{treatmentNotes:{contains:q}}]}:{}),
      };
      const [items,total,groups]=await prisma.$transaction([
        prisma.infirmaryVisit.findMany({where,include:{student:true,dispensedItems:{include:{medication:true}}},orderBy:[{visitedAt:'desc'},{id:'desc'}],skip:(page-1)*25,take:25}),
        prisma.infirmaryVisit.count({where}),
        prisma.student.groupBy({by:['gradeLevel','classroom'],orderBy:[{gradeLevel:'asc'},{classroom:'asc'}]}),
      ]);
      return NextResponse.json({items,total,groups,page,pageSize:25});
    }
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
      serviceType = 'DISPENSE',
    } = body;

    if (!studentId || typeof symptoms !== 'string' || !symptoms.trim()) {
      return NextResponse.json({ error: 'Student and symptoms are required' }, { status: 400 });
    }
    if (!['DISPENSE','WOUND_CARE','REST'].includes(serviceType)) return NextResponse.json({error:'ประเภทบริการไม่ถูกต้อง'}, {status:400});
    if (serviceType === 'DISPENSE' && (!Array.isArray(dispensedMedicines) || !dispensedMedicines.length)) return NextResponse.json({error:'กรุณาเลือกยาที่ต้องการจ่าย'}, {status:400});
    const student = await prisma.student.findFirst({where:{id:studentId,isActive:true}});
    if(!student) return NextResponse.json({error:'ไม่พบนักเรียนที่ใช้งานอยู่'}, {status:400});
    if (!Array.isArray(dispensedMedicines) || dispensedMedicines.some((item: { medicationId?: string; quantity?: number }) => !item.medicationId || !Number.isSafeInteger(item.quantity) || Number(item.quantity) <= 0)) {
      return NextResponse.json({ error: 'จำนวนยาต้องเป็นจำนวนเต็มมากกว่า 0' }, { status: 400 });
    }

    const createdVisit = await prisma.$transaction(async (tx) => {
      const visit = await tx.infirmaryVisit.create({
        data: {
          studentId,
          symptoms,
          serviceType,
          bodyTemperature: bodyTemperature ? parseFloat(bodyTemperature) : null,
          bloodPressure: bloodPressure || null,
          pulseRate: pulseRate ? parseInt(pulseRate, 10) : null,
          bedRest: serviceType === 'REST' || Boolean(bedRest),
          bedRestStart: bedRestStart ? new Date(bedRestStart) : null,
          bedRestEnd: bedRestEnd ? new Date(bedRestEnd) : null,
          treatmentNotes: treatmentNotes || null,
          status: 'COMPLETED',
        },
      });

      if (Array.isArray(dispensedMedicines) && dispensedMedicines.length > 0) {
        for (const item of dispensedMedicines) {
          const deducted = await tx.medication.updateMany({
            where: { id: item.medicationId, stockQuantity: { gte: item.quantity } },
            data: { stockQuantity: { decrement: item.quantity } },
          });
          if (deducted.count !== 1) throw new Error('INSUFFICIENT_STOCK');

          await tx.dispensedItem.create({
            data: {
              visitId: visit.id,
              medicationId: item.medicationId,
              quantity: item.quantity,
              instructions: item.instructions || null,
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
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') return NextResponse.json({ error: 'สต็อกยาไม่เพียงพอ กรุณาตรวจสอบจำนวนอีกครั้ง' }, { status: 409 });
    return NextResponse.json({ error: 'Failed to record visit' }, { status: 500 });
  }
}
