
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
  const files = Array.isArray(fileUrl) ? fileUrl : [fileUrl];

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
          <div key={index} className="flex flex-col items-center justify-center mb-4 p-8 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-6xl text-gray-400 mb-4">📄</div>
            <p className="text-lg font-medium text-gray-700">{displayName}</p>
            <p className="text-sm text-gray-500 mb-4">Không thể xem trước file này</p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Mở trong tab mới
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = displayName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
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
