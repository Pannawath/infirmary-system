import {prisma} from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET list of staff in a specific year to rollover
export async function GET(request: Request) {
  try {
    const {searchParams} = new URL(request.url);
    const sourceYearId = searchParams.get('sourceYearId');
    const targetYearId = searchParams.get('targetYearId');

    if (!sourceYearId) {
      return Response.json({error: 'กรุณาระบุปีการศึกษาต้นทาง'}, {status: 400});
    }

    // Get all staff active in source year
    const sourceEnrollments = await prisma.studentEnrollment.findMany({
      where: {
        yearId: sourceYearId,
        student: {
          personType: 'STAFF',
        },
      },
      include: {
        student: true,
      },
      orderBy: {
        student: {
          fullName: 'asc',
        },
      },
    });

    // Check who is already in target year
    let existingInTarget = new Set<string>();
    if (targetYearId) {
      const targetEnrollments = await prisma.studentEnrollment.findMany({
        where: {
          yearId: targetYearId,
          student: {
            personType: 'STAFF',
          },
        },
        select: {
          studentId: true,
        },
      });
      existingInTarget = new Set(targetEnrollments.map(e => e.studentId));
    }

    const items = sourceEnrollments.map(e => ({
      studentId: e.student.id,
      studentCode: e.student.studentCode,
      fullName: e.student.fullName,
      department: e.student.department || e.classroom || '',
      position: e.student.position || '',
      gradeLevel: e.gradeLevel,
      classroom: e.classroom,
      alreadyInTarget: existingInTarget.has(e.student.id),
    }));

    return Response.json({items});
  } catch (e) {
    return Response.json({error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลบุคลากร'}, {status: 500});
  }
}

// POST rollover selected staff into target year
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {targetYearId, studentIds} = body as {
      targetYearId: string;
      studentIds: string[];
    };

    if (!targetYearId || !Array.isArray(studentIds) || !studentIds.length) {
      return Response.json({error: 'กรุณาเลือกบุคลากรและปีปลายทาง'}, {status: 400});
    }

    const result = await prisma.$transaction(async tx => {
      const year = await tx.schoolYear.findUnique({where: {id: targetYearId}});
      if (!year) throw Error('ไม่พบปีการศึกษาปลายทาง');

      const students = await tx.student.findMany({
        where: {
          id: {in: studentIds},
          personType: 'STAFF',
        },
      });

      let added = 0;
      let alreadyExisted = 0;

      for (const student of students) {
        const existing = await tx.studentEnrollment.findUnique({
          where: {
            studentId_yearId: {
              studentId: student.id,
              yearId: targetYearId,
            },
          },
        });

        if (existing) {
          if (existing.status !== 'ACTIVE') {
            await tx.studentEnrollment.update({
              where: {id: existing.id},
              data: {status: 'ACTIVE'},
            });
            added++;
          } else {
            alreadyExisted++;
          }
        } else {
          await tx.studentEnrollment.create({
            data: {
              studentId: student.id,
              yearId: targetYearId,
              gradeLevel: 'บุคลากร',
              classroom: student.department || student.classroom || 'ทั่วไป',
              status: 'ACTIVE',
            },
          });
          added++;
        }
      }

      return {added, alreadyExisted, total: students.length};
    });

    return Response.json(result);
  } catch (e) {
    return Response.json({error: e instanceof Error ? e.message : 'ไม่สามารถนำรายชื่อมาใช้ได้'}, {status: 400});
  }
}

