import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const required = [
      "id",
      "fullName",
      "studentCode",
      "gradeLevel",
      "classroom",
    ];
    if (
      required.some((key) => typeof body[key] !== "string" || !body[key].trim())
    ) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อ รหัสนักเรียน ชั้น และห้องให้ครบ" },
        { status: 400 },
      );
    }
    for (const key of ["allergies", "chronicDiseases", "guardianPhone"]) {
      if (body[key] != null && typeof body[key] !== "string")
        return NextResponse.json(
          { error: "รูปแบบข้อมูลไม่ถูกต้อง" },
          { status: 400 },
        );
    }
    const student = await prisma.student.update({
      where: { id: body.id },
      data: {
        fullName: body.fullName.trim(),
        studentCode: body.studentCode.trim(),
        gradeLevel: body.gradeLevel.trim(),
        classroom: body.classroom.trim(),
        allergies: body.allergies?.trim() || null,
        chronicDiseases: body.chronicDiseases?.trim() || null,
        guardianPhone: body.guardianPhone?.trim() || null,
      },
    });
    return NextResponse.json(student);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        return NextResponse.json(
          { error: "รหัสนักเรียนนี้มีในระบบแล้ว" },
          { status: 409 },
        );
      if (error.code === "P2025")
        return NextResponse.json(
          { error: "ไม่พบข้อมูลนักเรียน" },
          { status: 404 },
        );
    }
    return NextResponse.json(
      { error: "บันทึกข้อมูลนักเรียนไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";
    const directory = searchParams.get('directory') === '1';
    const grade = searchParams.get('grade') || '';
    const room = searchParams.get('room') || '';
    const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
    const where: Prisma.StudentWhereInput = {isActive:true,
      ...(grade ? {gradeLevel:grade} : {}), ...(room ? {classroom:room} : {}),
      ...(query ? {OR:[{studentCode:{contains:query}},{fullName:{contains:query}}]} : {})};
    if(directory){
      const [items,total,groups]=await prisma.$transaction([
        prisma.student.findMany({where,orderBy:[{gradeLevel:'asc'},{classroom:'asc'},{studentCode:'asc'}],skip:(page-1)*30,take:30}),
        prisma.student.count({where}),
        prisma.student.groupBy({by:['gradeLevel','classroom'],orderBy:[{gradeLevel:'asc'},{classroom:'asc'}],where:{isActive:true},_count:{_all:true}}),
      ]);
      return NextResponse.json({items,total,page,pageSize:30,groups});
    }

    const students = await prisma.student.findMany({
      where,
      orderBy: { studentCode: "asc" },
      take: 10,
    });

    return NextResponse.json(students);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 },
    );
  }
}
