import type { Metadata } from 'next';
import './globals.css';
import InteractionGuards from './InteractionGuards';

export const metadata: Metadata = {
  title: 'ระบบห้องพยาบาลโรงเรียน | School Infirmary Management System',
  description: 'ระบบบันทึกการรักษาและจ่ายยาห้องพยาบาลโรงเรียนแบบ Walk-in คลินิก',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-emerald-500 selection:text-white">
        <InteractionGuards/>
        {children}
      </body>
    </html>
  );
}
