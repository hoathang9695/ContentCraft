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

    console.log('FilePreviewDialog - Input fileUrl:', fileUrl, 'Type:', typeof fileUrl);

    // If it's already an array, return it
    if (Array.isArray(fileUrl)) {
      const validUrls = fileUrl.filter(url => url && typeof url === 'string' && url.trim() !== '');
      console.log('FilePreviewDialog - Array input, valid URLs:', validUrls);
      return validUrls;
    }

    // If it's a string, handle different cases
    if (typeof fileUrl === 'string') {
      const trimmed = fileUrl.trim();

      // Handle empty string
      if (trimmed === '') return [];

      // Try to parse as JSON first (for both array and string cases)
      try {
        const parsed = JSON.parse(trimmed);
        console.log('FilePreviewDialog - Parsed JSON:', parsed);
        
        // If parsed result is an array
        if (Array.isArray(parsed)) {
          const validUrls = parsed.filter(url => url && typeof url === 'string' && url.trim() !== '');
          console.log('FilePreviewDialog - JSON array, valid URLs:', validUrls);
          return validUrls;
        }
        
        // If parsed result is an empty object {}, treat as no files
        if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length === 0) {
          console.log('FilePreviewDialog - Empty JSON object, no URLs');
          return [];
        }
        
        // If parsed result is a string, treat as single URL
        if (typeof parsed === 'string' && parsed.trim() !== '') {
          console.log('FilePreviewDialog - JSON string, URL:', [parsed.trim()]);
          return [parsed.trim()];
        }
        
        return [];
      } catch (error) {
        console.log('FilePreviewDialog - JSON parse failed, error:', error);
        
        // If JSON parsing fails, check if it looks like a JSON array format but malformed
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          console.error('Malformed JSON array:', trimmed, error);
          
          // Try to extract URLs from malformed JSON array
          try {
            // Remove brackets and split by comma, then clean up
            const content = trimmed.slice(1, -1);
            const urls = content.split(',').map(url => {
              // Remove quotes and trim
              return url.replace(/['"]/g, '').trim();
            }).filter(url => url && url.length > 0);
            
            console.log('FilePreviewDialog - Extracted URLs from malformed JSON:', urls);
            return urls;
          } catch (extractError) {
            console.error('Failed to extract URLs from malformed JSON:', extractError);
            return [];
          }
        }
        
        // If it's not JSON, treat as a single URL
        console.log('FilePreviewDialog - Single URL string:', [trimmed]);
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
        // Use proxy endpoint for external URLs
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(currentFileUrl)}`;
        
        return (
          <div className="flex justify-center">
            <img 
              src={proxyUrl}
              alt={fileName || 'File đính kèm'}
              className="max-w-full max-h-96 object-contain rounded-lg"
              onLoad={() => {
                console.log('FilePreviewDialog - Image loaded successfully via proxy:', currentFileUrl);
              }}
              onError={(e) => {
                console.error('FilePreviewDialog - Image failed to load via proxy:', currentFileUrl);
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                // Show fallback message
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-64 text-gray-500 p-4">
                      <div class="h-16 w-16 mb-4 flex items-center justify-center border-2 border-red-300 rounded bg-red-50">
                        <span class="text-xs text-red-600 font-semibold">IMG</span>
                      </div>
                      <p class="text-red-600 font-medium mb-2">❌ Không thể tải ảnh</p>
                      <p class="text-xs text-gray-400 mb-3 text-center">Server không thể truy cập URL này hoặc URL đã hết hạn</p>
                      <p class="text-xs text-gray-600 mb-4 break-all max-w-md text-center bg-gray-100 p-2 rounded">
                        URL: ${currentFileUrl}
                      </p>
                      <div class="flex gap-2">
                        <button 
                          onclick="window.open('${currentFileUrl}', '_blank')"
                          class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs transition-colors"
                        >
                          🔗 Mở trong tab mới
                        </button>
                        <button 
                          onclick="navigator.clipboard.writeText('${currentFileUrl}')"
                          class="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs transition-colors"
                        >
                          📋 Copy URL
                        </button>
                      </div>
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