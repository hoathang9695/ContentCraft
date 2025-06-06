
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ExternalLink } from "lucide-react";

interface FilePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | string[] | null;
  fileName?: string;
}

export function FilePreviewDialog({ isOpen, onClose, fileUrl, fileName }: FilePreviewDialogProps) {
  if (!fileUrl) return null;

  // Handle both single file and array of files
  let files: string[] = [];
  
  if (Array.isArray(fileUrl)) {
    files = fileUrl;
  } else if (typeof fileUrl === 'string') {
    try {
      // Try to parse as JSON array first (for cases where it's a JSON string)
      const parsed = JSON.parse(fileUrl);
      if (Array.isArray(parsed)) {
        files = parsed;
      } else {
        files = [fileUrl];
      }
    } catch {
      // If not JSON, treat as single URL
      files = [fileUrl];
    }
  }

  // Filter out empty or invalid URLs
  files = files.filter(url => url && typeof url === 'string' && url.trim().length > 0);

  const getFileType = (url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
      return 'image';
    }
    if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(extension || '')) {
      return 'video';
    }
    if (['pdf'].includes(extension || '')) {
      return 'pdf';
    }
    return 'other';
  };

  const getFileName = (url: string) => {
    return url.split('/').pop() || 'File';
  };

  const renderFilePreview = (url: string, index: number) => {
    const fileType = getFileType(url);
    const displayName = fileName || getFileName(url);

    switch (fileType) {
      case 'image':
        return (
          <div key={index} className="flex flex-col items-center mb-4">
            <div className="relative">
              <img 
                src={url} 
                alt={displayName}
                className="max-w-full max-h-96 object-contain rounded-lg shadow-lg"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNzBMMTMwIDEzMEg3MEwxMDAgNzBaIiBmaWxsPSIjOWNhM2FmIi8+CjxjaXJjbGUgY3g9IjE0MCIgY3k9IjYwIiByPSIxMCIgZmlsbD0iIzljYTNhZiIvPgo8L3N2Zz4K';
                }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">{displayName}</p>
          </div>
        );

      case 'video':
        return (
          <div key={index} className="flex flex-col items-center mb-4">
            <video 
              controls 
              className="max-w-full max-h-96 rounded-lg shadow-lg"
              preload="metadata"
            >
              <source src={url} />
              Trình duyệt không hỗ trợ video này.
            </video>
            <p className="text-sm text-gray-600 mt-2">{displayName}</p>
          </div>
        );

      case 'pdf':
        return (
          <div key={index} className="flex flex-col items-center mb-4">
            <iframe 
              src={url} 
              className="w-full h-96 border rounded-lg"
              title={displayName}
            />
            <p className="text-sm text-gray-600 mt-2">{displayName}</p>
          </div>
        );

      default:
        return (
          <div key={index} className="flex flex-col items-center justify-center mb-4 p-12 border border-gray-200 rounded-lg bg-gray-50">
            {/* File Icon */}
            <div className="flex items-center justify-center w-16 h-20 mb-4">
              <svg width="64" height="80" viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 0H48L64 16V72C64 76.4183 60.4183 80 56 80H8C3.58172 80 0 76.4183 0 72V8C0 3.58172 3.58172 0 8 0Z" fill="#E5E7EB"/>
                <path d="M48 0V16H64L48 0Z" fill="#D1D5DB"/>
                <rect x="8" y="32" width="24" height="2" fill="#9CA3AF"/>
                <rect x="8" y="40" width="32" height="2" fill="#9CA3AF"/>
                <rect x="8" y="48" width="28" height="2" fill="#9CA3AF"/>
                <rect x="8" y="56" width="20" height="2" fill="#9CA3AF"/>
              </svg>
            </div>
            
            {/* File Name */}
            <h3 className="text-lg font-medium text-gray-900 mb-2 text-center">{displayName}</h3>
            
            {/* Message */}
            <p className="text-sm text-gray-500 mb-6 text-center">Không thể xem trước file này</p>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
                onClick={() => window.open(url, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Mở trong tab mới
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = displayName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                <Download className="h-4 w-4" />
                Tải xuống
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Xem file đính kèm</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {files.length > 1 && (
            <p className="text-sm text-gray-600">
              Hiển thị {files.length} file đính kèm:
            </p>
          )}
          
          {files.map((url, index) => renderFilePreview(url, index))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
