import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ContentTable } from '@/components/ContentTable';
import { format } from 'date-fns';
import {
  Select,
  SelectContent, 
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from '@/components/ui/calendar';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { queryClient } from '@/lib/queryClient';

export default function ContentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [sourceStatus, setSourceStatus] = useState('unverified');
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 800);

  const { data: editorUsers } = useQuery<Array<{id: number, username: string, name: string}>>({
    queryKey: ['/api/editors'],
    queryFn: async () => {
      const response = await fetch('/api/editors');
      if (!response.ok) throw new Error('Failed to fetch editors');
      return response.json();
    }
  });

  const handleSearch = (query: string) => {
    console.log('Search query:', query);
    setSearchQuery(query);
  };

  // Listen for search updates from DataTable
  useEffect(() => {
    const handleSearchUpdate = (event: CustomEvent) => {
      setSearchQuery(event.detail);
    };

    window.addEventListener('searchUpdate', handleSearchUpdate as EventListener);
    return () => {
      window.removeEventListener('searchUpdate', handleSearchUpdate as EventListener);
    };
  }, []);

  const handleDateFilter = () => {
    console.log('Filtering by date range:', {
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString()
    });
    // Force refetch with new date range
    queryClient.invalidateQueries(['/api/contents']);
  };

  const toggleSourceStatus = () => {
    setSourceStatus(prev => prev === 'unverified' ? 'verified' : 'unverified');
  };

  return (
    <DashboardLayout onSearch={handleSearch}>
      <div className="mb-4 flex items-center justify-between"> {/* Modified to align filters */}
        <div className="flex items-center gap-4">
          <div className="bg-background border rounded-md p-1">
            <div className="flex space-x-1">
              <Button 
                variant={activeTab === 'all' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setActiveTab('all')}
              >
                Tất cả
              </Button>
              <Button 
                variant={activeTab === 'processed' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setActiveTab('processed')}
              >
                Đã xử lý
              </Button>
              <Button 
                variant={activeTab === 'unprocessed' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setActiveTab('unprocessed')}
              >
                Chưa xử lý
              </Button>
            </div>
          </div>

          <div className="bg-background border rounded-md p-1">
            <Button
              variant={sourceStatus === 'verified' ? 'default' : 'ghost'}
              size="sm"
              onClick={toggleSourceStatus}
            >
              {sourceStatus === 'verified' ? "Đã xác minh" : "Chưa xác minh"}
            </Button>
          </div>

          {user?.role === 'admin' && (
            <Select 
              value={selectedUser?.toString() || "all"} 
              onValueChange={(value) => setSelectedUser(value === "all" ? null : parseInt(value))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {editorUsers?.map(user => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div>
            <Label htmlFor="startDate" className="text-xs mb-1 block">Ngày bắt đầu</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-10 justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd/MM/yyyy') : "Tất cả"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    if (date) {
                      setStartDate(date);
                      if (date > endDate) {
                        setEndDate(date);
                      }
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="endDate" className="text-xs mb-1 block">Ngày kết thúc</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-10 justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'dd/MM/yyyy') : "Tất cả"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    if (date) {
                      setEndDate(date);
                      if (date < startDate) {
                        setStartDate(date);
                      }
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-end gap-2 h-[74px]">
            <Button 
              variant="default" 
              className="h-10 bg-green-600 hover:bg-green-700 text-white" 
              onClick={() => {
                handleDateFilter();
                toast({
                  title: "Đã áp dụng bộ lọc",
                  description: `Hiển thị dữ liệu từ ${format(startDate, 'dd/MM/yyyy')} đến ${format(endDate, 'dd/MM/yyyy')}`,
                });
              }}
            >
              Áp dụng
            </Button>

            <Button 
              variant="outline" 
              className="h-10" 
              onClick={() => {
                setStartDate(undefined);
                setEndDate(undefined);
                toast({
                  title: "Đã đặt lại bộ lọc",
                  description: "Hiển thị tất cả dữ liệu",
                });
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        </div>
      </div>

      {activeTab === 'all' && (
        <ContentTable 
          title="Tất cả nội dung" 
          sourceVerification={sourceStatus as 'verified' | 'unverified'}
          assignedUserId={selectedUser}
          searchQuery={debouncedSearchQuery}
          onSearchChange={handleSearch}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {activeTab === 'processed' && (
        <ContentTable 
          title="Nội dung đã xử lý" 
          statusFilter="completed" 
          sourceVerification={sourceStatus as 'verified' | 'unverified'}
          searchQuery={debouncedSearchQuery}
          onSearchChange={handleSearch}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {activeTab === 'unprocessed' && (
        <ContentTable 
          title="Nội dung chưa xử lý" 
          statusFilter="pending" 
          sourceVerification={sourceStatus as 'verified' | 'unverified'}
          searchQuery={debouncedSearchQuery}
          onSearchChange={handleSearch}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </DashboardLayout>
  );
}