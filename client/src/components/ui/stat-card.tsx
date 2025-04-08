import React from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

type StatCardProps = {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  viewAllLink?: string;
  onViewAll?: () => void;
  className?: string;
};

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-white",
  iconBgColor = "bg-primary",
  viewAllLink,
  onViewAll,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden transition-all hover:shadow-md", className)}>
      <CardContent className="p-5">
        <div className="flex items-center">
          <div className={cn("flex-shrink-0 rounded-md p-3", iconBgColor)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <div className="text-sm font-medium text-muted-foreground">{title}</div>
            <div className="text-lg font-medium">{value}</div>
          </div>
        </div>
      </CardContent>
      {(viewAllLink || onViewAll) && (
        <CardFooter className="bg-muted/20 p-3">
          <a
            href={viewAllLink}
            onClick={(e) => {
              if (onViewAll) {
                e.preventDefault();
                onViewAll();
              }
            }}
            className="text-sm font-medium text-primary hover:text-primary/90 transition-colors"
          >
            View all
          </a>
        </CardFooter>
      )}
    </Card>
  );
}
