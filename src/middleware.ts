import {NextRequest,NextResponse} from 'next/server';

export function middleware(request:NextRequest){
  const token=process.env.INFIRMARY_DESKTOP_TOKEN;
  if(!token)return NextResponse.next();
  if(request.nextUrl.pathname==='/api/desktop-health'&&request.headers.get('x-desktop-token')===token)return NextResponse.next();
  if(request.nextUrl.pathname==='/'&&request.nextUrl.searchParams.get('desktop_token')===token){
    const clean=request.nextUrl.clone();clean.searchParams.delete('desktop_token');
    const response=NextResponse.redirect(clean);
    response.cookies.set('spk_desktop',token,{httpOnly:true,sameSite:'strict',path:'/'});
    return response;
  }
  if(request.cookies.get('spk_desktop')?.value!==token)return NextResponse.json({error:'เปิดระบบผ่านแอปห้องพยาบาลเท่านั้น'},{status:403});
  const origin=request.headers.get('origin');
  if(!['GET','HEAD','OPTIONS'].includes(request.method)&&origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:'Origin not allowed'},{status:403});
  return NextResponse.next();
}
