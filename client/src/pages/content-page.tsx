import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ContentTable } from '@/components/ContentTable';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
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
  // Sử dụng ngày hiện tại làm giá trị mặc định
  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(today);
  // State cho bộ lọc trạng thái nguồn (mặc định là "Chưa xác minh")
  const [sourceStatus, setSourceStatus] = useState('unverified');
  
  const handleSearch = (query: string) => {
    // In a real app, this might filter by API
    console.log('Search query:', query);
  };
  
  // Hàm xử lý khi thay đổi ngày
  const handleDateFilter = () => {
    // Tại đây, bạn có thể thêm logic lọc dữ liệu theo ngày
    console.log('Filtering by date range:', { startDate, endDate });
  };
  
  // Hàm xử lý khi thay đổi trạng thái nguồn
  const toggleSourceStatus = () => {
    setSourceStatus(prev => prev === 'unverified' ? 'verified' : 'unverified');
  };
  
  return (
    <DashboardLayout onSearch={handleSearch}>
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="outline"
              className={cn(
                "whitespace-nowrap min-w-[100px] h-10 px-4 py-2",
                sourceStatus === 'unverified' ? "bg-muted" : ""
              )}
              onClick={toggleSourceStatus}
            >
              {sourceStatus === 'unverified' ? "Chưa xác minh" : "Đã xác minh"}
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap md:flex-nowrap gap-2 items-center">
              <div className="grid items-center">
                <Label htmlFor="startDate" className="text-xs">Ngày bắt đầu</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
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
                          // Nếu ngày bắt đầu mới lớn hơn ngày kết thúc, cập nhật ngày kết thúc
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
              
              <div className="grid items-center">
                <Label htmlFor="endDate" className="text-xs">Ngày kết thúc</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
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
                          // Nếu ngày kết thúc mới nhỏ hơn ngày bắt đầu, cập nhật ngày bắt đầu
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
              
              <div className="flex items-end gap-1">
                <Button 
                  variant="default" 
                  className="h-10 bg-green-600 hover:bg-green-700 text-white" 
                  onClick={() => {
                    // Áp dụng bộ lọc theo ngày
                    handleDateFilter();
                    
                    // Thông báo cho người dùng
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
                    // Đặt lại ngày về ngày hôm nay
                    const today = new Date();
                    setStartDate(today);
                    setEndDate(today);
                    
                    // Thông báo cho người dùng biết đã xóa bộ lọc
                    toast({
                      title: "Đã đặt lại bộ lọc",
                      description: "Hiển thị tất cả dữ liệu cho ngày hiện tại",
                    });
                    
                    // Áp dụng ngay bộ lọc mới
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
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="processed">Đã xử lý</TabsTrigger>
          <TabsTrigger value="unprocessed">Chưa xử lý</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <ContentTable 
            title="Tất cả nội dung" 
            startDate={startDate}
            endDate={endDate}
            sourceVerification={sourceStatus as 'verified' | 'unverified'}
          />
        </TabsContent>
        
        <TabsContent value="processed">
          <ContentTable 
            title="Nội dung đã xử lý" 
            statusFilter="completed" // Trạng thái "completed" trong database
            startDate={startDate}
            endDate={endDate}
            sourceVerification={sourceStatus as 'verified' | 'unverified'}
          />
        </TabsContent>
        
        <TabsContent value="unprocessed">
          <ContentTable 
            title="Nội dung chưa xử lý" 
            statusFilter="processing" // Sửa từ "pending" thành "processing" để khớp với trạng thái trong database
            startDate={startDate}
            endDate={endDate}
            sourceVerification={sourceStatus as 'verified' | 'unverified'}
          />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}