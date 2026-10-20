import {NextResponse} from 'next/server';
import {serviceReport} from '@/lib/service-report';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return NextResponse.json(await serviceReport(new URL(request.url).searchParams))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'โหลดรายงานไม่สำเร็จ'},{status:400})}}
