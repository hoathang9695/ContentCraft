import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ExternalLink, File as FileIcon } from "lucide-react";

interface FilePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | string[] | null;
  fileName?: string;
}

export function FilePreviewDialog({ isOpen, onClose, fileUrl, fileName }: FilePreviewDialogProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  // Convert to array for consistent handling
  const fileUrls = useMemo(() => {
    if (!fileUrl) return [];

    // If it's already an array, return it
    if (Array.isArray(fileUrl)) {
      return fileUrl.filter(url => url && url.trim() !== '');
    }

    // If it's a string, check if it looks like JSON array
    if (typeof fileUrl === 'string') {
      const trimmed = fileUrl.trim();

      // Check if it starts with [ and ends with ] (JSON array)
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          return Array.isArray(parsed) ? parsed.filter(url => url && url.trim() !== '') : [];
        } catch (error) {
          console.error('Error parsing JSON array:', error);
          return [];
        }
      }

      // If it's a single URL string
      if (trimmed !== '') {
        return [trimmed];
      }
    }

    return [];
  }, [fileUrl]);

  const currentFileUrl = fileUrls[selectedFileIndex];

  const getFileType = (url: string) => {
    if (!url) return 'unknown';
    const lowercaseUrl = url.toLowerCase();
    if (lowercaseUrl.includes('.jpg') || lowercaseUrl.includes('.jpeg') || lowercaseUrl.includes('.png') || lowercaseUrl.includes('.gif') || lowercaseUrl.includes('.webp') || lowercaseUrl.includes('.svg')) {
      return 'image';
    }
    if (lowercaseUrl.includes('.pdf')) {
      return 'pdf';
    }
    if (lowercaseUrl.includes('.mp4') || lowercaseUrl.includes('.webm') || lowercaseUrl.includes('.ogg')) {
      return 'video';
    }
    return 'unknown';
  };

  const fileType = getFileType(currentFileUrl || '');

  if (!isOpen) {
    return null;
  }

  // If no files or empty array
  if (!fileUrls.length || !currentFileUrl) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Xem file đính kèm</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileIcon className="h-16 w-16 mb-4" />
            <p>Không có file đính kèm hợp lệ</p>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const handleDownload = (url: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const renderFilePreview = () => {
    if (!currentFileUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <FileIcon className="h-16 w-16 mb-4" />
          <p>Không có file để hiển thị</p>
        </div>
      );
    }

    switch (fileType) {
      case 'image':
        return (
          <div className="flex justify-center">
            <img 
              src={currentFileUrl} 
              alt={fileName || 'File đính kèm'}
              className="max-w-full max-h-96 object-contain rounded-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                // Show fallback message
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-64 text-gray-500">
                      <div class="h-16 w-16 mb-4 flex items-center justify-center border-2 border-gray-300 rounded">
                        <span class="text-xs">IMG</span>
                      </div>
                      <p>Không thể tải ảnh</p>
                      <p class="text-sm mt-2 break-all">URL: ${currentFileUrl}</p>
                    </div>
                  `;
                }
              }}
            />
          </div>
        );
      case 'video':
        return (
          <div className="flex justify-center">
            <video 
              src={currentFileUrl} 
              controls
              className="max-w-full max-h-96 rounded-lg"
              onError={(e) => {
                const target = e.target as HTMLVideoElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-64 text-gray-500">
                      <div class="h-16 w-16 mb-4 flex items-center justify-center border-2 border-gray-300 rounded">
                        <span class="text-xs">VID</span>
                      </div>
                      <p>Không thể tải video</p>
                      <p class="text-sm mt-2 break-all">URL: ${currentFileUrl}</p>
                    </div>
                  `;
                }
              }}
            />
          </div>
        );
      case 'pdf':
        return (
          <div className="flex flex-col items-center justify-center h-64">
            <FileIcon className="h-16 w-16 mb-4 text-red-500" />
            <p className="text-lg font-medium mb-2">{fileName || 'PDF File'}</p>
            <p className="text-gray-500 mb-4">Không thể xem trước file PDF</p>
            <Button onClick={() => handleDownload(currentFileUrl)} variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              Mở trong tab mới
            </Button>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-64">
            <FileIcon className="h-16 w-16 mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">{fileName || 'File đính kèm'}</p>
            <p className="text-gray-500 mb-4">Không thể xem trước file này</p>
            <p className="text-xs text-gray-400 mb-4 break-all max-w-md">URL: {currentFileUrl}</p>
            <div className="flex gap-2">
              <Button onClick={() => handleDownload(currentFileUrl)} variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" />
                Mở trong tab mới
              </Button>
              <Button onClick={() => handleDownload(currentFileUrl)} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Tải xuống
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Xem file đính kèm</DialogTitle>
        </DialogHeader>
        {renderFilePreview()}
        <DialogFooter>
          <Button onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}