import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex bg-bg min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 px-8 md:px-10 py-8 max-w-[1440px] w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
