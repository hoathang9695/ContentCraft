
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Calendar, CalendarIcon, Search, Plus } from "lucide-react";
import { Input } from "../components/ui/input";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import { Label } from "../components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "../components/ui/table";
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious,
} from "../components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { useDebounce } from "../hooks/use-debounce";
import { useToast } from "../hooks/use-toast";

interface InfringingContent {
  id: number;
  externalId: string;
  assigned_to_id: number;
  processing_time: string | null;
  violation_description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  processor?: {
    username: string;
    name: string;
  };
}

interface InfringingContentResponse {
  data: InfringingContent[];
  total: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
  dataLength: number;
}

function getStatusBadge(status: string) {
  const statusMap = {
    pending: { text: "Chờ xử lý", className: "bg-yellow-100 text-yellow-800" },
    processing: { text: "Đang xử lý", className: "bg-blue-100 text-blue-800" },
    completed: { text: "Hoàn thành", className: "bg-green-100 text-green-800" },
  };

  const statusInfo = statusMap[status as keyof typeof statusMap] || {
    text: status,
    className: "bg-gray-100 text-gray-800",
  };

  return (
    <Badge className={statusInfo.className}>
      {statusInfo.text}
    </Badge>
  );
}

export default function InfringingContentPage() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [externalIdInput, setExternalIdInput] = useState("");
  const [violationDescriptionInput, setViolationDescriptionInput] = useState("");

  // Fetch infringing contents data
  const {
    data: infringingContentsData,
    isLoading,
    error,
    refetch,
  } = useQuery<InfringingContentResponse>({
    queryKey: [
      "/api/infringing-content/paginated",
      currentPage,
      startDate,
      endDate,
      debouncedSearchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
      });

      if (startDate) {
        params.append("startDate", startDate.toISOString());
      }
      if (endDate) {
        params.append("endDate", endDate.toISOString());
      }
      if (debouncedSearchQuery.trim()) {
        params.append("search", debouncedSearchQuery.trim());
      }

      console.log("Fetching from queryKey:", `/api/infringing-content/paginated?${params}`);

      const response = await fetch(`/api/infringing-content/paginated?${params}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const result = await response.json();
      console.log("Backend paginated result:", result);

      return result;
    },
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    console.log("Search query:", e.target.value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleDateFilter = () => {
    console.log('Filtering by date range:', {
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString()
    });
    // Force refetch with new date range
    refetch();
  };

  const resetFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchQuery("");
    setCurrentPage(1);
    toast({
      title: "Đã đặt lại bộ lọc",
      description: "Hiển thị tất cả dữ liệu",
    });
  };

  const handleSearchDialogOpen = () => {
    setIsSearchDialogOpen(true);
    setExternalIdInput("");
    setViolationDescriptionInput("");
  };

  const handleSearchDialogCancel = () => {
    setIsSearchDialogOpen(false);
    setExternalIdInput("");
    setViolationDescriptionInput("");
  };

  const handleSearchDialogConfirm = async () => {
    if (!externalIdInput.trim() || !violationDescriptionInput.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ External ID và mô tả vi phạm",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Processing External ID:", externalIdInput);
      console.log("Violation Description:", violationDescriptionInput);

      const response = await fetch("/api/infringing-content/search-and-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          externalId: externalIdInput.trim(),
          violationDescription: violationDescriptionInput.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setIsSearchDialogOpen(false);
        setExternalIdInput("");
        setViolationDescriptionInput("");
        
        // Refresh the table data
        refetch();
        
        toast({
          title: "Thành công",
          description: result.message || "Đã xử lý thành công nội dung vi phạm",
        });
      } else {
        toast({
          title: "Lỗi",
          description: result.message || "Có lỗi xảy ra khi xử lý",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error processing infringing content:", error);
      toast({
        title: "Lỗi",
        description: "Không thể kết nối đến server",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-red-600">
                <p>Có lỗi xảy ra khi tải dữ liệu</p>
                <Button onClick={() => refetch()} className="mt-2">
                  Thử lại
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Responsive filters layout - horizontal on desktop, vertical on mobile */}
        <div className="mb-4">
          {/* Mobile layout (< md) - vertical stack */}
          <div className="md:hidden space-y-4">
            {/* Search - mobile */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">
                Tìm kiếm
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Tìm kiếm theo External ID, mô tả vi phạm..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date filters - mobile */}
            <div className="flex flex-col gap-3">
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
                        {startDate ? format(startDate, 'dd/MM/yyyy') : "Chọn ngày"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
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
                        locale={vi}
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
                        {endDate ? format(endDate, 'dd/MM/yyyy') : "Chọn ngày"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
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
                        locale={vi}
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
                  onClick={resetFilters}
                >
                  Đặt lại bộ lọc
                </Button>
              </div>
            </div>
          </div>

          {/* Desktop layout (>= md) - single row horizontal */}
          <div className="hidden md:flex md:items-end md:gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">
                Tìm kiếm
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Tìm kiếm theo External ID, mô tả vi phạm..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="pl-10"
                />
              </div>
            </div>

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
                    {startDate ? format(startDate, 'dd/MM/yyyy') : "Chọn ngày"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
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
                    locale={vi}
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
                    {endDate ? format(endDate, 'dd/MM/yyyy') : "Chọn ngày"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
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
                    locale={vi}
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
                onClick={resetFilters}
              >
                Đặt lại bộ lọc
              </Button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end">
          <Button
            onClick={handleSearchDialogOpen}
            className="text-white"
            style={{ backgroundColor: "#7165e0" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#5f56c7"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#7165e0"}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tìm kiếm và xử lý
          </Button>
        </div>

        {/* Content Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>External ID</TableHead>
                <TableHead>Người xử lý</TableHead>
                <TableHead>Thời gian xử lý</TableHead>
                <TableHead>Mô tả vi phạm</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex justify-center items-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-2"></div>
                      <span>Đang tải dữ liệu...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : infringingContentsData?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Không có dữ liệu nào được tìm thấy
                  </TableCell>
                </TableRow>
              ) : (
                infringingContentsData?.data.map((content) => (
                  <TableRow key={content.id}>
                    <TableCell className="font-mono text-sm">
                      {content.externalId}
                    </TableCell>
                    <TableCell>
                      {content.processor ? (
                        <div>
                          <div className="font-medium">
                            {content.processor.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            @{content.processor.username}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          Chưa phân công
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {content.processing_time ? (
                        format(
                          new Date(content.processing_time),
                          "dd/MM/yyyy HH:mm",
                          { locale: vi }
                        )
                      ) : (
                        <span className="text-muted-foreground">
                          Chưa xử lý
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {content.violation_description ? (
                        <div className="max-w-xs truncate" title={content.violation_description}>
                          {content.violation_description}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          Chưa có mô tả
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(content.status)}
                    </TableCell>
                    <TableCell>
                      {format(
                        new Date(content.created_at),
                        "dd/MM/yyyy HH:mm",
                        { locale: vi }
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!isLoading && infringingContentsData && infringingContentsData.totalPages > 1 && (
          <div className="mt-4 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    className={
                      currentPage === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>

                {Array.from(
                  { length: infringingContentsData.totalPages },
                  (_, i) => i + 1
                ).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => handlePageChange(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      handlePageChange(
                        Math.min(infringingContentsData.totalPages, currentPage + 1)
                      )
                    }
                    className={
                      currentPage === infringingContentsData.totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {/* Search and Process Dialog */}
        <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tìm kiếm và xử lý nội dung vi phạm</DialogTitle>
              <DialogDescription>
                Nhập External ID và mô tả vi phạm để tìm kiếm và xử lý nội dung vi phạm.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid gap-2">
                <Label htmlFor="externalId" className="text-sm font-medium">
                  External ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="externalId"
                  value={externalIdInput}
                  onChange={(e) => setExternalIdInput(e.target.value)}
                  placeholder="Nhập External ID..."
                  className="w-full"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="violationDescription" className="text-sm font-medium">
                  Mô tả vi phạm <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="violationDescription"
                  value={violationDescriptionInput}
                  onChange={(e) => setViolationDescriptionInput(e.target.value)}
                  placeholder="Nhập mô tả chi tiết về vi phạm..."
                  className="w-full min-h-[100px] px-3 py-2 border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md resize-y"
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleSearchDialogCancel}>
                Hủy
              </Button>
              <Button 
                onClick={handleSearchDialogConfirm}
                disabled={!externalIdInput.trim() || !violationDescriptionInput.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Xác nhận xóa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
