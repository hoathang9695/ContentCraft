import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ContentTable } from '@/components/ContentTable';
import { format } from 'date-fns';
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

export default function ContentPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  // Thiết lập ngày bắt đầu là ngày 1 của tháng hiện tại và ngày kết thúc là ngày hiện tại
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState<Date>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<Date>(today);
  // State cho bộ lọc trạng thái nguồn (mặc định là "Chưa xác minh")
  const [sourceStatus, setSourceStatus] = useState('unverified');
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  
  // Query to get editor users
  const { data: editorUsers } = useQuery<Array<{id: number, username: string, name: string}>>({
    queryKey: ['/api/editors'],
    queryFn: async () => {
      const response = await fetch('/api/editors');
      if (!response.ok) throw new Error('Failed to fetch editors');
      return response.json();
    }
  });

  const handleSearch = (query: string) => {
    // In a real app, this might filter by API
    console.log('Search query:', query);
  };
  
  // Hàm xử lý khi thay đổi ngày
  const handleDateFilter = () => {
    // Tại đây, bạn có thể thêm logic lọc dữ liệu theo ngày
    console.log('Filtering by date range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    // Cho phép hệ thống có thời gian để cập nhật state trước khi render
    setTimeout(() => {
      // Kích hoạt re-render để áp dụng bộ lọc
      setStartDate(new Date(startDate));
      setEndDate(new Date(endDate));
    }, 0);
  };
  
  // Hàm xử lý khi thay đổi trạng thái nguồn
  const toggleSourceStatus = () => {
    setSourceStatus(prev => prev === 'unverified' ? 'verified' : 'unverified');
  };
  
  return (
    <DashboardLayout onSearch={handleSearch}>
      <div className="mb-4">
        <div className="flex items-center">
          <div className="flex-shrink-0 mr-auto">
            <div className="bg-background border rounded-md p-1">
              <div className="flex space-x-1">
                <Button 
                  variant={activeTab === 'all' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => {
                    setActiveTab('all');
                    // Kích hoạt re-render của ContentTable khi chuyển tab
                    setTimeout(() => {
                      const newStart = new Date(startDate);
                      setStartDate(newStart);
                    }, 0);
                  }}
                >
                  Tất cả
                </Button>
                <Button 
                  variant={activeTab === 'processed' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => {
                    setActiveTab('processed');
                    // Kích hoạt re-render của ContentTable khi chuyển tab
                    setTimeout(() => {
                      const newStart = new Date(startDate);
                      setStartDate(newStart);
                    }, 0);
                  }}
                >
                  Đã xử lý
                </Button>
                <Button 
                  variant={activeTab === 'unprocessed' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => {
                    setActiveTab('unprocessed');
                    // Kích hoạt re-render của ContentTable khi chuyển tab
                    setTimeout(() => {
                      const newStart = new Date(startDate);
                      setStartDate(newStart);
                    }, 0);
                  }}
                >
                  Chưa xử lý
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className={cn(
                  "whitespace-nowrap h-10 px-4 py-2 mr-5",
                  sourceStatus === 'unverified' ? "bg-muted" : ""
                )}
                onClick={toggleSourceStatus}
              >
                {sourceStatus === 'unverified' ? "Chưa xác minh" : "Đã xác minh"}
              </Button>
              
              {user?.role === 'admin' && (
                <Select 
                  value={selectedUser?.toString() || ""} 
                  onValueChange={(value) => setSelectedUser(value ? parseInt(value) : null)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Chọn nhân sự" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tất cả</SelectItem>
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
                      {startDate ? format(startDate, 'dd/MM/yyyy') : <span>Chọn ngày</span>}
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
                      {endDate ? format(endDate, 'dd/MM/yyyy') : <span>Chọn ngày</span>}
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
                  className="h-10 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800" 
                  onClick={() => {
                    const today = new Date();
                    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                    setStartDate(firstDayOfMonth);
                    setEndDate(today);
                    toast({
                      title: "Đã đặt lại bộ lọc",
                      description: `Hiển thị dữ liệu từ ${format(firstDayOfMonth, 'dd/MM/yyyy')} đến ${format(today, 'dd/MM/yyyy')}`,
                    });
                    setTimeout(handleDateFilter, 100);
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {activeTab === 'all' && (
        <ContentTable 
          title="Tất cả nội dung" 
          startDate={startDate}
          endDate={endDate}
          sourceVerification={sourceStatus as 'verified' | 'unverified'}
          assignedUserId={selectedUser}
        />
      )}
      
      {activeTab === 'processed' && (
        <ContentTable 
          title="Nội dung đã xử lý" 
          statusFilter="completed" // Trạng thái "completed" trong database
          startDate={startDate}
          endDate={endDate}
          sourceVerification={sourceStatus as 'verified' | 'unverified'}
        />
      )}
      
      {activeTab === 'unprocessed' && (
        <ContentTable 
          title="Nội dung chưa xử lý" 
          statusFilter="pending" // "pending" là giá trị trong database cho nội dung chưa xử lý
          startDate={startDate}
          endDate={endDate}
          sourceVerification={sourceStatus as 'verified' | 'unverified'}
        />
      )}
    </DashboardLayout>
  );
}