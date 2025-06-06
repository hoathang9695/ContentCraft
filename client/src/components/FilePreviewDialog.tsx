
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
      // Clean up the URL string first by removing any extra encoding
      let cleanUrl = fileUrl.trim();
      
      // If it starts with { or [, try to parse as JSON
      if (cleanUrl.startsWith('{') || cleanUrl.startsWith('[')) {
        const parsed = JSON.parse(cleanUrl);
        if (Array.isArray(parsed)) {
          files = parsed;
        } else {
          files = [cleanUrl];
        }
      } else {
        // Check if it's a comma-separated list of URLs
        if (cleanUrl.includes(',')) {
          files = cleanUrl.split(',').map(url => url.trim().replace(/['"]/g, ''));
        } else {
          files = [cleanUrl];
        }
      }
    } catch {
      // If parsing fails, try to handle as comma-separated or single URL
      const cleanUrl = fileUrl.trim().replace(/['"]/g, '');
      if (cleanUrl.includes(',')) {
        files = cleanUrl.split(',').map(url => url.trim());
      } else {
        files = [cleanUrl];
      }
    }
  }

  // Filter out empty or invalid URLs and clean them up
  files = files
    .map(url => url.trim().replace(/['"]/g, ''))
    .filter(url => url && url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')));

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
          <div key={index} className="flex flex-col items-center mb-6">
            <div className="relative max-w-full">
              <img 
                src={url} 
                alt={displayName}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => window.open(url, '_blank')}
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNzBMMTMwIDEzMEg3MEwxMDAgNzBaIiBmaWxsPSIjOWNhM2FmIi8+CjxjaXJjbGUgY3g9IjE0MCIgY3k9IjYwIiByPSIxMCIgZmlsbD0iIzljYTNhZiIvPgo8L3N2Zz4K';
                }}
              />
              {/* Click to enlarge indicator */}
              <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity">
                Click để phóng to
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-3 text-center">{displayName}</p>
            <div className="flex gap-2 mt-2">
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

      case 'video':
        return (
          <div key={index} className="flex flex-col items-center mb-6">
            <video 
              controls 
              className="max-w-full max-h-[70vh] rounded-lg shadow-lg"
              preload="metadata"
              poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgdmlld0JveD0iMCAwIDMyMCAyNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMjQwIiBmaWxsPSIjMjEyMTIxIi8+Cjxwb2x5Z29uIHBvaW50cz0iMTMwLDkwIDE5MCwxMjAgMTMwLDE1MCIgZmlsbD0iI2ZmZmZmZiIvPgo8L3N2Zz4K"
            >
              <source src={url} />
              Trình duyệt không hỗ trợ video này.
            </video>
            <p className="text-sm text-gray-600 mt-3 text-center">{displayName}</p>
            <div className="flex gap-2 mt-2">
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

  if (files.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Xem file đính kèm</span>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-gray-500">Không có file đính kèm hợp lệ</p>
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Xem file đính kèm</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {files.length > 1 && (
            <p className="text-sm text-gray-600">
              Hiển thị {files.length} file đính kèm:
            </p>
          )}
          
          {/* Grid layout for multiple images */}
          {files.length > 1 && files.every(url => getFileType(url) === 'image') ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {files.map((url, index) => (
                <div key={index} className="aspect-square">
                  <img 
                    src={url} 
                    alt={`File ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => window.open(url, '_blank')}
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNzBMMTMwIDEzMEg3MEwxMDAgNzBaIiBmaWxsPSIjOWNhM2FmIi8+CjxjaXJjbGUgY3g9IjE0MCIgY3k9IjYwIiByPSIxMCIgZmlsbD0iIzljYTNhZiIvPgo8L3N2Zz4K';
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Single file or mixed types - vertical layout */
            <div className="space-y-4">
              {files.map((url, index) => renderFilePreview(url, index))}
            </div>
          )}
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
