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
        return {
          className: 'bg-green-100 text-green-800 hover:bg-green-100',
          label: 'Published'
        };
      case 'draft':
        return {
          className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
          label: 'Draft'
        };
      case 'review':
        return {
          className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
          label: 'Review'
        };
      default:
        return {
          className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
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
