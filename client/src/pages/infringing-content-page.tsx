
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
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
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { queryClient } from '@/lib/queryClient';

export default function InfringingContentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 800);

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

  return (
    <DashboardLayout onSearch={handleSearch}>
      {/* Date filters only */}
      <div className="mb-4">
        {/* Mobile layout (< md) - vertical stack */}
        <div className="md:hidden space-y-4">
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="startDate" className="text-xs mb-1 block">Ngày bắt đầu</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-9 w-full justify-start text-left font-normal text-xs",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
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
                      "h-9 w-full justify-start text-left font-normal text-xs",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
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
          </div>

          <div className="flex gap-2">
            <Button 
              variant="default" 
              className="h-9 flex-1 bg-green-600 hover:bg-green-700 text-white text-xs px-3" 
              onClick={() => {
                if (startDate && endDate) {
                  handleDateFilter();
                  toast({
                    title: "Đã áp dụng bộ lọc",
                    description: `Hiển thị dữ liệu từ ${format(startDate, 'dd/MM/yyyy')} đến ${format(endDate, 'dd/MM/yyyy')}`,
                  });
                } else {
                  toast({
                    title: "Vui lòng chọn ngày",
                    description: "Hãy chọn cả ngày bắt đầu và ngày kết thúc trước khi áp dụng bộ lọc",
                    variant: "destructive",
                  });
                }
              }}
            >
              Áp dụng
            </Button>

            <Button 
              variant="outline" 
              className="h-9 flex-1 text-xs px-3" 
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

        {/* Desktop layout (>= md) - horizontal */}
        <div className="hidden md:flex md:items-end md:gap-4">
          {/* Start date */}
          <div>
            <Label htmlFor="startDate" className="text-sm mb-1 block">Ngày bắt đầu</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 w-[150px] justify-start text-left font-normal text-sm",
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

          {/* End date */}
          <div>
            <Label htmlFor="endDate" className="text-sm mb-1 block">Ngày kết thúc</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 w-[150px] justify-start text-left font-normal text-sm",
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

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button 
              variant="default" 
              className="h-9 bg-green-600 hover:bg-green-700 text-white text-sm px-4" 
              onClick={() => {
                if (startDate && endDate) {
                  handleDateFilter();
                  toast({
                    title: "Đã áp dụng bộ lọc",
                    description: `Hiển thị dữ liệu từ ${format(startDate, 'dd/MM/yyyy')} đến ${format(endDate, 'dd/MM/yyyy')}`,
                  });
                } else {
                  toast({
                    title: "Vui lòng chọn ngày",
                    description: "Hãy chọn cả ngày bắt đầu và ngày kết thúc trước khi áp dụng bộ lọc",
                    variant: "destructive",
                  });
                }
              }}
            >
              Áp dụng
            </Button>

            <Button 
              variant="outline" 
              className="h-9 text-sm px-4" 
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

      <ContentTable 
        title="Nội dung vi phạm" 
        searchQuery={debouncedSearchQuery}
        onSearchChange={handleSearch}
        startDate={startDate}
        endDate={endDate}
      />
    </DashboardLayout>
  );
}
