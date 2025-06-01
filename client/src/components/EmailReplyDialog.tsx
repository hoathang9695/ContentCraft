
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

  // Auto fill form when request changes
  React.useEffect(() => {
    if (request) {
      setFormData({
        to: request.email,
        subject: `Re: ${request.subject}`,
        content: ""
      });
    }
  }, [request]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/support-requests/${request.id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: formData.to,
          subject: formData.subject,
          content: formData.content,
          response_content: formData.content
        })
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
            response_content: formData.content
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
      } else {
        throw new Error('Failed to send reply');
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

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px] h-[600px] p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-0">
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

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Email Fields */}
          <div className="p-4 space-y-3 border-b">
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
          <div className="px-4 py-3 bg-gray-50 border-b">
            <div className="text-sm text-gray-600 mb-2">Yêu cầu gốc từ {request.full_name}:</div>
            <div className="bg-white p-3 rounded border text-sm max-h-20 overflow-y-auto">
              {request.content}
            </div>
          </div>

          {/* Toolbar */}
          <div className="px-4 py-2 border-b bg-gray-50">
            <div className="flex items-center space-x-1">
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Bold className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Italic className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Underline className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-gray-300 mx-2" />
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Link className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content Editor */}
          <div className="flex-1 p-4">
            <Textarea
              placeholder="Nhập nội dung phản hồi..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full h-full resize-none border-0 focus:ring-0 text-sm"
              required
            />
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
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
