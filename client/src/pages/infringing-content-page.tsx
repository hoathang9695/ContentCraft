
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Calendar, CalendarIcon, Search } from "lucide-react";
import { Input } from "../components/ui/input";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
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
import { useDebounce } from "../hooks/use-debounce";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

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

  const resetFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
    console.log("Search query:", e.target.value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Xử lý nội dung vi phạm</h1>
            <p className="text-muted-foreground">
              Quản lý và xử lý các nội dung vi phạm quy định
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Bộ lọc</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
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

              {/* Start Date */}
              <div className="min-w-[140px]">
                <label className="text-sm font-medium mb-2 block">
                  Ngày bắt đầu
                </label>
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
                      {startDate ? (
                        format(startDate, "dd/MM/yyyy", { locale: vi })
                      ) : (
                        <span>Chọn ngày</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      locale={vi}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="min-w-[140px]">
                <label className="text-sm font-medium mb-2 block">
                  Ngày kết thúc
                </label>
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
                      {endDate ? (
                        format(endDate, "dd/MM/yyyy", { locale: vi })
                      ) : (
                        <span>Chọn ngày</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      locale={vi}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Reset Button */}
              <Button variant="outline" onClick={resetFilters}>
                Đặt lại bộ lọc
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Danh sách nội dung vi phạm
              {infringingContentsData && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({infringingContentsData.total} kết quả)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-2 text-muted-foreground">Đang tải dữ liệu...</p>
              </div>
            ) : infringingContentsData?.data.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Không có dữ liệu nào được tìm thấy</p>
              </div>
            ) : (
              <>
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
                      {infringingContentsData?.data.map((content) => (
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
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {infringingContentsData && infringingContentsData.totalPages > 1 && (
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
