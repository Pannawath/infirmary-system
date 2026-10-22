import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {Prisma} from '@prisma/client';

export async function DELETE(request:Request){
 try{
  const b=await request.json();if(typeof b.id!=='string'||!b.id||typeof b.updatedAt!=='string')return NextResponse.json({error:'ข้อมูลยาสำหรับลบไม่ครบ กรุณาเปิดรายการใหม่'},{status:400});
  await prisma.$transaction(async tx=>{
   const med=await tx.medication.findUnique({where:{id:b.id},include:{_count:{select:{dispensedItems:true}}}});
   if(!med)throw Error('NOT_FOUND');
   if(med.updatedAt.toISOString()!==b.updatedAt)throw Error('CONFLICT');
   if(med._count.dispensedItems>0)throw Error('USED');
   await tx.medication.delete({where:{id:med.id}});
  });return NextResponse.json({ok:true});
 }catch(e){const message=e instanceof Error?e.message:'';const used=message==='USED'||e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2003';return NextResponse.json({error:used?'ยานี้มีประวัติการจ่ายอยู่ จึงลบไม่ได้ เพื่อรักษาประวัติเดิม':message==='NOT_FOUND'?'ไม่พบรายการยา':message==='CONFLICT'?'ข้อมูลยามีการเปลี่ยนแปลง กรุณาปิดแล้วเปิดรายการใหม่':'ลบยาไม่สำเร็จ ไม่มีข้อมูลถูกลบ'},{status:message==='NOT_FOUND'?404:409})}
}

export async function GET() {
  try {
    const medications = await prisma.medication.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(medications);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch medications" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      category,
      unit,
      stockQuantity,
      minThreshold,
      indications,
    } = body;
    if (
      !id ||
      !name ||
      !unit ||
      !name.trim() || !unit.trim() ||
      !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 ||
      !Number.isSafeInteger(minThreshold) || minThreshold < 0
    ) {
      return NextResponse.json(
        { error: "Medication information is incomplete" },
        { status: 400 },
      );
    }
    const medication = await prisma.medication.update({
      where: { id },
      data: {
        name,
        category: category || "ยาทั่วไป",
        unit,
        stockQuantity: Number(stockQuantity),
        minThreshold: Number(minThreshold),
        indications: indications || null,
      },
    });
    return NextResponse.json(medication);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update medication" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category, unit, stockQuantity, minThreshold, indications } =
      body;
    if (
      !name ||
      !unit ||
      !name.trim() || !unit.trim() ||
      !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 ||
      !Number.isSafeInteger(minThreshold) || minThreshold < 0
    ) {
      return NextResponse.json(
        { error: "Medication information is incomplete" },
        { status: 400 },
      );
    }
    const medication = await prisma.medication.create({
      data: {
        name,
        category: category || "ยาทั่วไป",
        unit,
        stockQuantity: Number(stockQuantity),
        minThreshold: Number(minThreshold),
        indications: indications || null,
      },
    });
    return NextResponse.json(medication, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create medication" },
      { status: 500 },
    );
  }
}
