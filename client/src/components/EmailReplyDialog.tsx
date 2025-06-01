import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Send, Bold, Italic, Underline, Link, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SupportRequest {
  id: number;
  full_name: string;
  email: string;
  subject: string;
  content: string;
  status: string;
}

interface EmailReplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: SupportRequest | null;
  onSuccess?: () => void;
}

export function EmailReplyDialog({ isOpen, onClose, request, onSuccess }: EmailReplyDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    to: "",
    subject: "",
    content: ""
  });
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]); // State to manage attached files

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto fill form when request changes
  React.useEffect(() => {
    if (request) {
      setFormData({
        to: request.email,
        subject: `Re: ${request.subject}`,
        content: ""
      });
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
      }
    }
  }, [request]);

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
    if (!request) return;

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
      submitFormData.append('response_content', plainTextContent);
      
      // Add attached files
      attachedFiles.forEach((file, index) => {
        submitFormData.append('attachments', file);
      });

      const response = await fetch(`/api/support-requests/${request.id}/reply`, {
        method: 'POST',
        body: submitFormData // Send FormData instead of JSON
      });

      if (response.ok) {
        // Update support request status to completed
        const updateResponse = await fetch(`/api/support-requests/${request.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'completed',
            response_content: plainTextContent
          })
        });

        if (updateResponse.ok) {
          toast({
            title: "Thành công",
            description: "Email phản hồi đã được gửi và yêu cầu đã được đánh dấu hoàn thành",
          });
        } else {
          toast({
            title: "Thành công",
            description: "Email đã gửi nhưng không thể cập nhật trạng thái yêu cầu",
          });
        }

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
          description: errorData.message || "Không thể gửi email phản hồi. Vui lòng kiểm tra cấu hình SMTP.",
          variant: "destructive"
        });
        console.error('Email send error:', errorData);
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể gửi email phản hồi",
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
    if (files.length > 0) {
      setAttachedFiles(prev => [...prev, ...files]);
      toast({
        title: "File đính kèm",
        description: `Đã thêm ${files.length} file`,
      });
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Check if current selection has formatting
  const isFormatActive = (command: string) => {
    return document.queryCommandState(command);
  };

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px] max-h-[90vh] p-0 gap-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 pb-0 flex-shrink-0">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-lg font-medium">Phản hồi khách hàng</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
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

          {/* Original Request */}
          <div className="px-4 py-3 bg-gray-50 border-b flex-shrink-0">
            <div className="text-sm text-gray-600 mb-2">Yêu cầu gốc từ {request.full_name}:</div>
            <div className="bg-white p-3 rounded border text-sm max-h-20 overflow-y-auto">
              {request.content}
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
                title="Attach File"
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
              <div className="text-sm text-gray-600 mb-2">File đính kèm ({attachedFiles.length}):</div>
              <div className="flex flex-wrap gap-2 max-h-16 overflow-y-auto">
                {attachedFiles.map((file, index) => {
                  const truncatedName = file.name.length > 25
                    ? `${file.name.substring(0, 12)}...${file.name.substring(file.name.lastIndexOf('.'))}`
                    : file.name;
                  
                  return (
                    <div 
                      key={index} 
                      className="flex items-center bg-white px-2 py-1 rounded border text-xs max-w-[180px]"
                      title={file.name}
                    >
                      <span className="mr-1 truncate flex-1 min-w-0">
                        {truncatedName}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-red-100 flex-shrink-0"
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
                data-placeholder="Nhập nội dung phản hồi..."
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
              `}</style>
            </div>
          </div>

          {/* Footer - Always at bottom */}
          <div className="p-4 border-t bg-gray-50 flex justify-between items-center flex-shrink-0">
            <div className="text-xs text-gray-500">
              Phản hồi sẽ được gửi từ hệ thống SMTP đã cấu hình
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
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  "Đang gửi..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Gửi phản hồi
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