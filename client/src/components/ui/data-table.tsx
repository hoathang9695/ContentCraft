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

interface Column {
  key: string;
  header: string;
  render?: (row: any) => React.ReactNode;
  className?: string;
}

interface PaginationOptions {
  itemsPerPage: number;
  showPagination?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column[];
  caption?: string;
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  searchValue?: string;
  pagination?: PaginationOptions;
}

export function DataTable<T>({
  data = [],
  columns,
  caption,
  isLoading = false,
  searchable = false,
  searchPlaceholder = 'Tìm kiếm...',
  onSearch,
  searchValue = '',
  pagination = { itemsPerPage: 10, showPagination: true },
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const itemsPerPage = pagination.itemsPerPage;
  const totalPages = Math.ceil(data.length / itemsPerPage);

  const paginatedData = pagination.showPagination
    ? data.slice((page - 1) * itemsPerPage, page * itemsPerPage)
    : data;

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
              ) : paginatedData.length === 0 ? (
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
          {pagination.showPagination && totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, data.length)} of {data.length} entries
              </div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}