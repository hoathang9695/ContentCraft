import React, { useState } from 'react';
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
  pagination?:
    | boolean
    | {
        currentPage: number;
        totalPages: number;
        total: number;
        pageSize: number;
        onPageChange: (page: number) => void;
        onPageSizeChange: (size: number) => void;
      }
    | {
        itemsPerPage: number;
        currentPage: number;
        totalPages: number;
        onPageChange: (page: number) => void;
      };
  pageSize?: number;
}

export function DataTable<T>({
  data = [],
  columns,
  caption,
  isLoading = false,
  searchable = false,
  searchPlaceholder = 'Tìm kiếm...',
  onSearch,
  searchValue,
  pagination = false,
  pageSize = 10,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);

  // Check if server-side pagination is being used
  const isServerPagination = typeof pagination === 'object';

  // Handle different pagination object structures
  const paginationObj = isServerPagination ? pagination : null;
  const hasPageSizeControl = paginationObj && 'pageSize' in paginationObj;
  const hasItemsPerPage = paginationObj && 'itemsPerPage' in paginationObj;

  const totalPages = isServerPagination
    ? paginationObj.totalPages
    : Math.ceil(data.length / currentPageSize);

  const currentPageNum = isServerPagination ? paginationObj.currentPage : currentPage;

  const total = isServerPagination 
    ? (hasPageSizeControl ? paginationObj.total : data.length)
    : data.length;

  const currentPageSizeForDisplay = hasPageSizeControl 
    ? paginationObj.pageSize 
    : hasItemsPerPage 
    ? paginationObj.itemsPerPage 
    : currentPageSize;

  const paginatedData = isServerPagination
    ? data
    : pagination
    ? data.slice((currentPage - 1) * currentPageSize, currentPage * currentPageSize)
    : data;

  const handlePageChange = (page: number) => {
    if (isServerPagination) {
      paginationObj.onPageChange(page);
    } else {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (size: number) => {
    if (isServerPagination && hasPageSizeControl) {
      paginationObj.onPageSizeChange(size);
    } else {
      setCurrentPageSize(size);
      setCurrentPage(1);
    }
  };

  const startIndex = (currentPage - 1) * currentPageSize;

  return (
    <div className="w-full">
      {searchable && (
        <div className="mb-4">
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearch?.(e.target.value)}
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
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, rowIndex) => (
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

      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Hiển thị{' '}
              {isServerPagination ? (currentPageNum - 1) * currentPageSizeForDisplay + 1 : startIndex + 1} -{' '}
              {isServerPagination
                ? Math.min(currentPageNum * currentPageSizeForDisplay, total)
                : Math.min(startIndex + currentPageSize, data.length)}{' '}
              của {total} kết quả
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Số dòng mỗi trang:</span>
            <select
              value={currentPageSizeForDisplay}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              disabled={!hasPageSizeControl && isServerPagination}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <button
              onClick={() => handlePageChange(currentPageNum - 1)}
              disabled={currentPageNum === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Trước
            </button>

            <span className="text-sm text-gray-600">
              Trang {currentPageNum} / {totalPages}
            </span>

            <button
              onClick={() => handlePageChange(currentPageNum + 1)}
              disabled={currentPageNum === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}