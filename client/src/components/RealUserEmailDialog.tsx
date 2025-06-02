
import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Send, Bold, Italic, Underline, Link, Paperclip, Maximize2, Minimize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RealUser {
  id: number;
  fullName: {
    id: string;
    name: string;
  };
  email: string;
}

interface RealUserEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: RealUser | null;
  onSuccess?: () => void;
}

export function RealUserEmailDialog({ isOpen, onClose, user, onSuccess }: RealUserEmailDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    to: "",
    subject: "",
    content: ""
  });
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto fill form when user changes
  React.useEffect(() => {
    if (user) {
      setFormData({
        to: user.email,
        subject: `Thông báo từ EMSO System`,
        content: ""
      });
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
      }
    }
  }, [user]);

  // Update content when editor changes
  const handleEditorChange = () => {
    if (editorRef.current) {
      setFormData({ ...formData, content: editorRef.current.innerHTML });
    }
  };

  // Handle paste events to capture images
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check if the item is an image
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (file) {
          // Create a unique filename for the pasted image
          const timestamp = Date.now();
          const fileName = `pasted-image-${timestamp}.${file.type.split('/')[1]}`;
          
          // Create a new File object with a proper name
          const namedFile = new File([file], fileName, { type: file.type });
          
          // Add to attached files
          setAttachedFiles(prev => [...prev, namedFile]);
          
          // Create a data URL for display in editor
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            
            // Insert image into editor at cursor position
            if (editorRef.current) {
              const selection = window.getSelection();
              if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const img = document.createElement('img');
                img.src = dataUrl;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.alt = fileName;
                
                range.deleteContents();
                range.insertNode(img);
                
                // Move cursor after image
                range.setStartAfter(img);
                range.setEndAfter(img);
                selection.removeAllRanges();
                selection.addRange(range);
                
                handleEditorChange();
              }
            }
          };
          reader.readAsDataURL(file);
          
          toast({
            title: "Hình ảnh đã được thêm",
            description: `${fileName} đã được thêm vào email và danh sách đính kèm`,
          });
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Get HTML content to preserve formatting
    const htmlContent = editorRef.current?.innerHTML || "";
    // Get plain text as fallback
    const plainTextContent = editorRef.current?.innerText || "";

    setIsLoading(true);
    try {
      // Create FormData to handle file uploads
      const submitFormData = new FormData();
      submitFormData.append('to', formData.to);
      submitFormData.append('subject', formData.subject);
      submitFormData.append('content', htmlContent);
      submitFormData.append('plain_content', plainTextContent);
      
      // Add attached files
      attachedFiles.forEach((file, index) => {
        submitFormData.append('attachments', file);
      });

      const response = await fetch(`/api/real-users/${user.id}/send-email`, {
        method: 'POST',
        body: submitFormData
      });

      if (response.ok) {
        toast({
          title: "Thành công",
          description: "Email đã được gửi thành công",
        });

        onSuccess?.();
        onClose();
        setFormData({ to: "", subject: "", content: "" });
        setAttachedFiles([]);
        if (editorRef.current) {
          editorRef.current.innerHTML = "";
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        const errorData = await response.json();
        toast({
          title: "Lỗi",
          description: errorData.message || "Không thể gửi email. Vui lòng kiểm tra cấu hình SMTP.",
          variant: "destructive"
        });
        console.error('Email send error:', errorData);
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể gửi email",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleEditorChange();
  };

  const insertLink = () => {
    const url = prompt("Nhập URL:");
    if (url) {
      execCommand('createLink', url);
    }
  };

  const insertAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed the limit of 3 files
    const newTotalFiles = attachedFiles.length + files.length;
    if (newTotalFiles > 3) {
      toast({
        title: "Giới hạn file đính kèm",
        description: `Tối đa 3 file đính kèm. Hiện tại có ${attachedFiles.length} file, chỉ có thể thêm ${3 - attachedFiles.length} file nữa.`,
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Calculate total size including existing files
    const existingSize = attachedFiles.reduce((total, file) => total + file.size, 0);
    const newFilesSize = files.reduce((total, file) => total + file.size, 0);
    const totalSize = existingSize + newFilesSize;

    // Check if total size exceeds 25MB (25 * 1024 * 1024 bytes)
    const maxSize = 25 * 1024 * 1024;
    if (totalSize > maxSize) {
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      toast({
        title: "Giới hạn dung lượng",
        description: `Tổng dung lượng file đính kèm không được vượt quá 25MB. Dung lượng hiện tại sẽ là ${totalSizeMB}MB.`,
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // If validation passes, add files
    setAttachedFiles(prev => [...prev, ...files]);
    toast({
      title: "File đính kèm",
      description: `Đã thêm ${files.length} file`,
    });

    // Reset file input for next selection
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Check if current selection has formatting
  const isFormatActive = (command: string) => {
    return document.queryCommandState(command);
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={`real-user-email-dialog dialog-content ${isExpanded ? 'max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] m-0' : 'max-w-[800px] max-h-[90vh]'} p-0 gap-0 flex flex-col`}
      >
        {/* Header */}
        <DialogHeader className="p-4 pb-0 flex-shrink-0">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-lg font-medium">Gửi Email cho {user.fullName.name}</DialogTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8"
                title={isExpanded ? "Thu nhỏ" : "Mở rộng"}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Email Fields */}
          <div className="p-4 space-y-3 border-b flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Label className="w-16 text-sm text-gray-600">Đến:</Label>
              <Input
                value={formData.to}
                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                className="flex-1"
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Label className="w-16 text-sm text-gray-600">Chủ đề:</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="flex-1"
                required
              />
            </div>
          </div>

          {/* User Info */}
          <div className="px-4 py-3 bg-gray-50 border-b flex-shrink-0">
            <div className="text-sm text-gray-600 mb-2">Thông tin người nhận:</div>
            <div className="bg-white p-3 rounded border text-sm">
              <div className="font-medium">{user.fullName.name}</div>
              <div className="text-gray-600">{user.email}</div>
              <div className="text-xs text-gray-500 mt-1">ID: {user.fullName.id}</div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="px-4 py-2 border-b bg-gray-50 flex-shrink-0">
            <div className="flex items-center space-x-1">
              <Button 
                type="button" 
                variant={isFormatActive('bold') ? 'default' : 'ghost'}
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => execCommand('bold')}
                title="Bold"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button 
                type="button" 
                variant={isFormatActive('italic') ? 'default' : 'ghost'}
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => execCommand('italic')}
                title="Italic"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button 
                type="button" 
                variant={isFormatActive('underline') ? 'default' : 'ghost'}
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => execCommand('underline')}
                title="Underline"
              >
                <Underline className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-gray-300 mx-2" />
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={insertLink}
                title="Insert Link"
              >
                <Link className="h-4 w-4" />
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={insertAttachment}
                disabled={attachedFiles.length >= 3}
                title={attachedFiles.length >= 3 ? "Đã đạt giới hạn 3 file đính kèm" : "Attach File"}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* File Input (Hidden) */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.txt,.zip,.rar"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Attached Files Display */}
          {attachedFiles.length > 0 && (
            <div className="px-4 py-2 border-b bg-gray-50 flex-shrink-0">
              <div className="text-sm text-gray-600 mb-2">
                File đính kèm ({attachedFiles.length}/3) - 
                Tổng dung lượng: {((attachedFiles.reduce((total, file) => total + file.size, 0)) / (1024 * 1024)).toFixed(2)}MB/25MB
              </div>
              <div className="flex flex-wrap gap-2 max-h-16 overflow-y-auto">
                {attachedFiles.map((file, index) => {
                  const truncatedName = file.name.length > 25
                    ? `${file.name.substring(0, 12)}...${file.name.substring(file.name.lastIndexOf('.'))}`
                    : file.name;
                  
                  const fileSizeKB = (file.size / 1024).toFixed(1);
                  const fileSizeDisplay = file.size > 1024 * 1024 
                    ? `${(file.size / (1024 * 1024)).toFixed(1)}MB`
                    : `${fileSizeKB}KB`;
                  
                  return (
                    <div 
                      key={index} 
                      className="flex items-center bg-white px-2 py-1 rounded border text-xs max-w-[200px]"
                      title={`${file.name} (${fileSizeDisplay})`}
                    >
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="truncate">
                          {truncatedName}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {fileSizeDisplay}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-red-100 flex-shrink-0 ml-1"
                        onClick={() => removeAttachment(index)}
                        title="Xóa file"
                      >
                        <X className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Content Editor - Scrollable area */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex-1 p-4 overflow-y-auto">
              <div
                ref={editorRef}
                contentEditable
                className="w-full min-h-[150px] outline-none text-sm border-0 focus:ring-0 p-2 border rounded"
                style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                onInput={handleEditorChange}
                onBlur={handleEditorChange}
                onPaste={handlePaste}
                suppressContentEditableWarning={true}
                data-placeholder="Nhập nội dung email..."
              />
              <style>{`
                [contenteditable]:empty:before {
                  content: attr(data-placeholder);
                  color: #9CA3AF;
                  pointer-events: none;
                }
                [contenteditable] {
                  line-height: 1.5;
                }
                [contenteditable] b, [contenteditable] strong {
                  font-weight: bold;
                }
                [contenteditable] i, [contenteditable] em {
                  font-style: italic;
                }
                [contenteditable] u {
                  text-decoration: underline;
                }
                [contenteditable] a {
                  color: #3B82F6;
                  text-decoration: underline;
                }
                /* Hide default dialog close button only for RealUserEmailDialog */
                .real-user-email-dialog .dialog-content > button[data-radix-dialog-close],
                .real-user-email-dialog [data-radix-dialog-content] > button[data-radix-dialog-close],
                .real-user-email-dialog button[data-radix-dialog-close],
                .real-user-email-dialog [data-radix-dialog-content] button[class*="absolute"][class*="right-4"][class*="top-4"] {
                  display: none !important;
                  visibility: hidden !important;
                  opacity: 0 !important;
                  pointer-events: none !important;
                  position: absolute !important;
                  left: -9999px !important;
                  width: 0 !important;
                  height: 0 !important;
                  overflow: hidden !important;
                }
                
                /* Additional specific selector for the exact button structure */
                .dialog-content button.absolute.right-4.top-4 {
                  display: none !important;
                }
              `}</style>
            </div>
          </div>

          {/* Footer - Always at bottom */}
          <div className="p-4 border-t bg-gray-50 flex justify-between items-center flex-shrink-0">
            <div className="text-xs text-gray-500">
              Email sẽ được gửi từ hệ thống SMTP đã cấu hình
            </div>
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="text-white"
                style={{ 
                  backgroundColor: '#7367e0',
                  '&:hover': { backgroundColor: '#5a52cc' }
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a52cc'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#7367e0'}
              >
                {isLoading ? (
                  "Đang gửi..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Gửi Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
