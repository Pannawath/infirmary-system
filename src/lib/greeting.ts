export function timeGreeting(now=new Date()){
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',hourCycle:'h23'}).format(now));
 return hour<12?'สวัสดีตอนเช้า':hour<17?'สวัสดีตอนบ่าย':'สวัสดีตอนเย็น';
}
