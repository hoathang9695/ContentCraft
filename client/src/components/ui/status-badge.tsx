import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'published':
      case 'completed':
        return {
          className: 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950',
          label: 'Đã xử lý'
        };
      case 'draft':
      case 'pending':
        return {
          className: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950',
          label: 'Chưa xử lý'
        };
      case 'review':
        return {
          className: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950',
          label: 'Đang xem xét'
        };
      default:
        return {
          className: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
          label: status.charAt(0).toUpperCase() + status.slice(1)
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge 
      variant="outline" 
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
