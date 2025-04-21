import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface DataTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string;
    render?: (row: T) => React.ReactNode;
    className?: string;
  }[];
  caption?: string;
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  searchValue?: string;
  pagination?: boolean;
  pageSize?: number;
}

export function DataTable<T>({
  data = [],
  columns,
  caption,
  isLoading = false,
  searchable = false,
  searchPlaceholder = 'Tìm kiếm...',
  pagination = false,
  pageSize = 10,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = useMemo(() => {
    let filtered = data;
    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      filtered = data.filter((item) => {
        return columns.some(column => {
          const value = item[column.key];
          return value && value.toString().toLowerCase().includes(lowercasedQuery);
        });
      });
    }
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [data, searchQuery, currentPage, pageSize, columns]);


  return (
    <div className="w-full">
      {searchable && (
        <div className="mb-4">
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
      )}

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            {caption && <TableCaption>{caption}</TableCaption>}
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.className}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <div className="flex justify-center items-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      <span>Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-muted/50">
                    {columns.map((column) => (
                      <TableCell key={`${rowIndex}-${column.key}`} className={column.className}>
                        {column.render
                          ? column.render(row)
                          : row[column.key] !== undefined
                          ? String(row[column.key])
                          : null}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {pagination && filteredData.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="flex-1 text-sm text-muted-foreground">
            Hiển thị {((currentPage - 1) * pageSize) + 1} đến {Math.min(currentPage * pageSize, filteredData.length)} trong tổng số {filteredData.length} kết quả
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                <span className="sr-only">Trang trước</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                Trang {currentPage} / {Math.ceil(filteredData.length / pageSize)}
              </div>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(page => Math.min(Math.ceil(data.length / pageSize), page + 1))}
                disabled={currentPage === Math.ceil(data.length / pageSize)}
              >
                <span className="sr-only">Trang sau</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}