import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  X,
  Download,
  ExternalLink,
  File as FileIcon,
  RefreshCw,
} from "lucide-react";

// Component for image with retry mechanism
function ImageWithRetry({
  src,
  originalUrl,
  alt,
  className,
}: {
  src: string;
  originalUrl: string;
  alt: string;
  className: string;
}) {
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const handleLoad = () => {
    console.log(
      "FilePreviewDialog - Image loaded successfully via proxy:",
      originalUrl,
    );
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    console.error(
      "FilePreviewDialog - Image failed to load via proxy (attempt " +
        (retryCount + 1) +
        "):",
      originalUrl,
    );
    setIsLoading(false);

    if (retryCount < 2) {
      // Auto retry up to 2 times
      setTimeout(
        () => {
          setRetryCount((prev) => prev + 1);
          setRetryKey((prev) => prev + 1);
          setIsLoading(true);
          setHasError(false);
        },
        1000 * (retryCount + 1),
      ); // Increase delay with each retry
    } else {
      setHasError(true);
    }
  };

  const handleManualRetry = () => {
    setRetryCount(0);
    setRetryKey((prev) => prev + 1);
    setIsLoading(true);
    setHasError(false);
  };

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 p-4">
        <div className="h-16 w-16 mb-4 flex items-center justify-center border-2 border-red-300 rounded bg-red-50">
          <span className="text-xs text-red-600 font-semibold">IMG</span>
        </div>
        <p className="text-red-600 font-medium mb-2">❌ Không thể tải ảnh</p>
        <p className="text-xs text-gray-400 mb-3 text-center">
          Server không thể truy cập URL này hoặc URL đã hết hạn (Đã thử{" "}
          {retryCount + 1} lần)
        </p>
        <p className="text-xs text-gray-600 mb-4 break-all max-w-md text-center bg-gray-100 p-2 rounded">
          URL: {originalUrl}
        </p>
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={handleManualRetry}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs transition-colors flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Thử lại
          </button>
          <button
            onClick={() => window.open(originalUrl, "_blank")}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs transition-colors"
          >
            🔗 Mở trong tab mới
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(originalUrl)}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs transition-colors"
          >
            📋 Copy URL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="flex flex-col items-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mb-2" />
            <p className="text-sm text-gray-500">
              Đang tải ảnh... {retryCount > 0 && `(Lần thử ${retryCount + 1})`}
            </p>
          </div>
        </div>
      )}
      <img
        key={retryKey}
        src={src}
        alt={alt}
        className={className}
        onLoad={handleLoad}
        onError={handleError}
        style={{ display: hasError ? "none" : "block" }}
      />
    </div>
  );
}

interface FilePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | string[] | null;
  fileName?: string;
}

export function FilePreviewDialog({
  isOpen,
  onClose,
  fileUrl,
  fileName,
}: FilePreviewDialogProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  // Convert to array for consistent handling
  const fileUrls = useMemo(() => {
    if (!fileUrl) return [];

    console.log(
      "FilePreviewDialog - Input fileUrl:",
      fileUrl,
      "Type:",
      typeof fileUrl,
    );

    // If it's already an array, return it
    if (Array.isArray(fileUrl)) {
      const validUrls = fileUrl.filter(
        (url) => url && typeof url === "string" && url.trim() !== "",
      );
      console.log("FilePreviewDialog - Array input, valid URLs:", validUrls);
      return validUrls;
    }

    // If it's a string, handle different cases
    if (typeof fileUrl === "string") {
      const trimmed = fileUrl.trim();

      // Handle empty string
      if (trimmed === "") return [];

      // Try to parse as JSON first (for both array and string cases)
      try {
        const parsed = JSON.parse(trimmed);
        console.log("FilePreviewDialog - Parsed JSON:", parsed);

        // If parsed result is an array
        if (Array.isArray(parsed)) {
          const validUrls = parsed.filter(
            (url) => url && typeof url === "string" && url.trim() !== "",
          );
          console.log("FilePreviewDialog - JSON array, valid URLs:", validUrls);
          return validUrls;
        }

        // If parsed result is an empty object {}, treat as no files
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          Object.keys(parsed).length === 0
        ) {
          console.log("FilePreviewDialog - Empty JSON object, no URLs");
          return [];
        }

        // If parsed result is a string, treat as single URL
        if (typeof parsed === "string" && parsed.trim() !== "") {
          console.log("FilePreviewDialog - JSON string, URL:", [parsed.trim()]);
          return [parsed.trim()];
        }

        return [];
      } catch (error) {
        console.log("FilePreviewDialog - JSON parse failed, error:", error);

        // If JSON parsing fails, check if it looks like a JSON array format but malformed
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          console.error("Malformed JSON array:", trimmed, error);

          // Try to extract URLs from malformed JSON array
          try {
            // Remove brackets and split by comma, then clean up
            const content = trimmed.slice(1, -1);
            const urls = content
              .split(",")
              .map((url) => {
                // Remove quotes and trim
                return url.replace(/['"]/g, "").trim();
              })
              .filter((url) => url && url.length > 0);

            console.log(
              "FilePreviewDialog - Extracted URLs from malformed JSON:",
              urls,
            );
            return urls;
          } catch (extractError) {
            console.error(
              "Failed to extract URLs from malformed JSON:",
              extractError,
            );
            return [];
          }
        }

        // If it's not JSON, treat as a single URL
        console.log("FilePreviewDialog - Single URL string:", [trimmed]);
        return [trimmed];
      }
    }

    return [];
  }, [fileUrl]);

  const currentFileUrl = fileUrls[selectedFileIndex];

  const getFileType = (url: string) => {
    if (!url) return "unknown";
    const lowercaseUrl = url.toLowerCase();
    if (
      lowercaseUrl.includes(".jpg") ||
      lowercaseUrl.includes(".jpeg") ||
      lowercaseUrl.includes(".png") ||
      lowercaseUrl.includes(".gif") ||
      lowercaseUrl.includes(".webp") ||
      lowercaseUrl.includes(".svg")
    ) {
      return "image";
    }
    if (lowercaseUrl.includes(".pdf")) {
      return "pdf";
    }
    if (
      lowercaseUrl.includes(".mp4") ||
      lowercaseUrl.includes(".webm") ||
      lowercaseUrl.includes(".ogg")
    ) {
      return "video";
    }
    return "unknown";
  };

  const fileType = getFileType(currentFileUrl || "");

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
            <DialogDescription>
              Hiển thị nội dung file đính kèm được tải lên
            </DialogDescription>
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
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const renderFilePreview = () => {
    if (!fileUrls.length) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <FileIcon className="h-16 w-16 mb-4" />
          <p>Không có file để hiển thị</p>
        </div>
      );
    }

    // If multiple files, show grid view
    if (fileUrls.length > 1) {
      return (
        <div className="space-y-4">
          {/* File thumbnails grid */}
          <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-lg">
            {fileUrls.map((url, index) => {
              const isSelected = index === selectedFileIndex;
              const fileType = getFileType(url);

              return (
                <div
                  key={index}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-200"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedFileIndex(index)}
                >
                  {fileType === "image" ? (
                    <ImageWithRetry
                      src={`/api/proxy-image?url=${encodeURIComponent(url)}`}
                      originalUrl={url}
                      alt={`File ${index + 1}`}
                      className="w-full h-20 object-cover"
                    />
                  ) : fileType === "video" ? (
                    <div className="w-full h-20 bg-gray-100 flex items-center justify-center">
                      <span className="text-xs font-semibold text-gray-600">
                        VID
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-20 bg-gray-100 flex items-center justify-center">
                      <FileIcon className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                    {index + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected file preview */}
          <div className="text-center text-sm text-gray-600 mb-2">
            File {selectedFileIndex + 1} / {fileUrls.length}
          </div>

          {renderSingleFilePreview(currentFileUrl)}
        </div>
      );
    }

    // Single file view
    return renderSingleFilePreview(currentFileUrl);
  };

  const renderSingleFilePreview = (url: string | undefined) => {
    if (!url) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <FileIcon className="h-16 w-16 mb-4" />
          <p>Không có file để hiển thị</p>
        </div>
      );
    }

    const fileType = getFileType(url);

    switch (fileType) {
      case "image":
        // Use proxy endpoint for external URLs with retry mechanism
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;

        return (
          <div className="flex justify-center">
            <ImageWithRetry
              src={proxyUrl}
              originalUrl={url}
              alt={fileName || "File đính kèm"}
              className="max-w-full max-h-96 object-contain rounded-lg"
            />
          </div>
        );
      case "video":
        return (
          <div className="flex justify-center">
            <video
              src={url}
              controls
              className="max-w-full max-h-96 rounded-lg"
              onError={(e) => {
                const target = e.target as HTMLVideoElement;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-64 text-gray-500">
                      <div class="h-16 w-16 mb-4 flex items-center justify-center border-2 border-gray-300 rounded">
                        <span class="text-xs">VID</span>
                      </div>
                      <p>Không thể tải video</p>
                      <p class="text-sm mt-2 break-all">URL: ${url}</p>
                    </div>
                  `;
                }
              }}
            />
          </div>
        );
      case "pdf":
        return (
          <div className="flex flex-col items-center justify-center h-64">
            <FileIcon className="h-16 w-16 mb-4 text-red-500" />
            <p className="text-lg font-medium mb-2">{fileName || "PDF File"}</p>
            <p className="text-gray-500 mb-4">Không thể xem trước file PDF</p>
            <Button onClick={() => handleDownload(url)} variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              Mở trong tab mới
            </Button>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-64">
            <FileIcon className="h-16 w-16 mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">
              {fileName || "File đính kèm"}
            </p>
            <p className="text-gray-500 mb-4">Không thể xem trước file này</p>
            <p className="text-xs text-gray-400 mb-4 break-all max-w-md">
              URL: {url}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => handleDownload(url)} variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" />
                Mở trong tab mới
              </Button>
              <Button onClick={() => handleDownload(url)} variant="outline">
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
          <DialogTitle>
            Xem file đính kèm{" "}
            {fileUrls.length > 1 && `(${fileUrls.length} files)`}
          </DialogTitle>
          <DialogDescription>
            {fileUrls.length > 1 
              ? `Xem và tải xuống ${fileUrls.length} file đính kèm` 
              : "Xem và tải xuống file đính kèm"
            }
          </DialogDescription>
        </DialogHeader>
        {renderFilePreview()}
        <DialogFooter className="flex justify-between items-center">
          <div className="flex gap-2">
            {fileUrls.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedFileIndex((prev) =>
                      prev > 0 ? prev - 1 : fileUrls.length - 1,
                    )
                  }
                >
                  ← Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedFileIndex((prev) =>
                      prev < fileUrls.length - 1 ? prev + 1 : 0,
                    )
                  }
                >
                  Sau →
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {currentFileUrl && (
              <Button
                variant="outline"
                onClick={() => handleDownload(currentFileUrl)}
              >
                <Download className="mr-2 h-4 w-4" />
                Tải xuống
              </Button>
            )}
            <Button onClick={onClose}>Đóng</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
