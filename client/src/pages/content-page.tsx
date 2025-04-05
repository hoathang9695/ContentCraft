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

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState('all');
  // Sử dụng ngày hiện tại làm giá trị mặc định
  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(today);
  
  const handleSearch = (query: string) => {
    // In a real app, this might filter by API
    console.log('Search query:', query);
  };
  
  // Hàm xử lý khi thay đổi ngày
  const handleDateFilter = () => {
    // Tại đây, bạn có thể thêm logic lọc dữ liệu theo ngày
    console.log('Filtering by date range:', { startDate, endDate });
  };
  
  return (
    <DashboardLayout onSearch={handleSearch}>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Content Management</h1>
          <p className="text-muted-foreground mt-1">Create, edit, and manage your content</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center border rounded-md p-2">
            <div className="grid w-full items-center gap-1.5">
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
                        handleDateFilter();
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="grid w-full items-center gap-1.5">
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
                        handleDateFilter();
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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
          />
        </TabsContent>
        
        <TabsContent value="processed">
          <ContentTable 
            title="Nội dung đã xử lý" 
            statusFilter="published"
            startDate={startDate}
            endDate={endDate}
          />
        </TabsContent>
        
        <TabsContent value="unprocessed">
          <ContentTable 
            title="Nội dung chưa xử lý" 
            statusFilter="draft"
            startDate={startDate}
            endDate={endDate}
          />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
