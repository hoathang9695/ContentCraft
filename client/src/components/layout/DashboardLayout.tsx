import { useState, useEffect } from 'react';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardLayoutProps {
  children: React.ReactNode;
  onSearch?: (query: string) => void;
  onNewContent?: () => void;
  onQueueReport?: () => void;
}

export function DashboardLayout({ 
  children, 
  onSearch, 
  onNewContent,
  onQueueReport 
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // Close sidebar when clicked outside on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        // On desktop, sidebar is always visible
        setSidebarOpen(true);
      }
    };

    // Set initial state based on screen size
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader onMenuClick={toggleSidebar} onSearch={onSearch}  onNewContent={onNewContent} onQueueReport={onQueueReport}/>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for mobile - with overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 md:hidden bg-black/30" onClick={closeSidebar}>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white"
              onClick={(e) => {
                e.stopPropagation();
                closeSidebar();
              }}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        )}

        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        {/* Main content */}
        <main className={cn(
          "flex-1 relative overflow-y-auto focus:outline-none transition-all duration-200",
          sidebarOpen ? "md:ml-0" : "md:ml-0"
        )}>
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}