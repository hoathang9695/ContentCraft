import React from 'react';
import { cn } from '@/lib/utils';

interface MuiCardProps {
  children: React.ReactNode;
  className?: string;
}

export function MuiCard({ children, className }: MuiCardProps) {
  return (
    <div className={cn("bg-white rounded-lg shadow-md overflow-hidden transition-shadow hover:shadow-lg", className)}>
      {children}
    </div>
  );
}

interface MuiCardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function MuiCardContent({ children, className }: MuiCardContentProps) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

interface MuiCardActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function MuiCardActions({ children, className }: MuiCardActionsProps) {
  return <div className={cn("bg-gray-50 px-5 py-3 flex justify-end", className)}>{children}</div>;
}

interface MuiCardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function MuiCardTitle({ children, className }: MuiCardTitleProps) {
  return <h2 className={cn("text-lg font-medium mb-2", className)}>{children}</h2>;
}

interface MuiCardSubtitleProps {
  children: React.ReactNode;
  className?: string;
}

export function MuiCardSubtitle({ children, className }: MuiCardSubtitleProps) {
  return <p className={cn("text-sm text-gray-500 mb-4", className)}>{children}</p>;
}
