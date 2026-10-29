export function withVisitSnapshot<T extends {student:{fullName:string;gradeLevel?:string;classroom?:string};studentNameSnapshot?:string|null;gradeSnapshot?:string|null;classroomSnapshot?:string|null}>(visit:T){
 return {...visit,student:{...visit.student,fullName:visit.studentNameSnapshot??visit.student.fullName,gradeLevel:visit.gradeSnapshot??visit.student.gradeLevel,classroom:visit.classroomSnapshot??visit.student.classroom}};
}
