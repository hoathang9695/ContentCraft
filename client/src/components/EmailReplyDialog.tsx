
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { X, Send, Paperclip, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, ListUnordered, ListOrdered } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SupportRequest {
  id: number;
  full_name: string;
  email: string;
  subject: string;
  content: string;
  status: 'pending' | 'processing' | 'completed';
}

interface EmailReplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: SupportRequest | null;
  onSent?: () => void;
}

export function EmailReplyDialog({ isOpen, onClose, request, onSent }: EmailReplyDialogProps) {
  const { toast } = useToast();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Auto-fill email fields when request changes
  useState(() => {
    if (request) {
      setTo(request.email);
      setSubject(`Re: ${request.subject}`);
      setMessage(`Xin chào ${request.full_name},\n\nCảm ơn bạn đã liên hệ với chúng tôi. Chúng tôi đã nhận được yêu cầu hỗ trợ của bạn và sẽ phản hồi sớm nhất có thể.\n\nYêu cầu của bạn:\n"${request.content}"\n\nTrân trọng,\nĐội ngũ hỗ trợ EMSO`);
    }
  }, [request]);

  const handleSend = async () => {
    if (!request || !to.trim() || !subject.trim() || !message.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    
    try {
      // Send email
      const emailResponse = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: to,
          subject: subject,
          content: message
        })
      });

      if (!emailResponse.ok) {
        throw new Error('Failed to send email');
      }

      // Update support request status
      const updateResponse = await fetch(`/api/support-requests/${request.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'completed',
          response_content: message
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update support request');
      }

      toast({
        title: "Thành công",
        description: "Đã gửi email phản hồi thành công",
      });

      onSent?.();
      onClose();
      
      // Reset form
      setTo("");
      setSubject("");
      setMessage("");
      
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Lỗi",
        description: "Không thể gửi email phản hồi",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setTo("");
    setSubject("");
    setMessage("");
    onClose();
  };

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[800px] max-h-[90vh] p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-medium">Soạn email phản hồi</DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Email Form */}
        <div className="flex flex-col h-[500px]">
          {/* To field */}
          <div className="px-6 py-3 border-b">
            <div className="flex items-center space-x-3">
              <Label htmlFor="to" className="text-sm font-medium w-12">
                Đến:
              </Label>
              <Input
                id="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Nhập email người nhận"
                className="flex-1 border-0 focus-visible:ring-0 shadow-none"
              />
            </div>
          </div>

          {/* Subject field */}
          <div className="px-6 py-3 border-b">
            <div className="flex items-center space-x-3">
              <Label htmlFor="subject" className="text-sm font-medium w-12">
                Chủ đề:
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Nhập chủ đề email"
                className="flex-1 border-0 focus-visible:ring-0 shadow-none"
              />
            </div>
          </div>

          {/* Toolbar */}
          <div className="px-6 py-2 border-b bg-gray-50">
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Bold className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Italic className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Underline className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-gray-300 mx-2" />
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <AlignRight className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-gray-300 mx-2" />
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ListUnordered className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ListOrdered className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-gray-300 mx-2" />
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Message area */}
          <div className="flex-1 px-6 py-4">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhập nội dung email..."
              className="w-full h-full resize-none border-0 focus-visible:ring-0 shadow-none text-sm"
              style={{ minHeight: '250px' }}
            />
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button 
                onClick={handleSend} 
                disabled={isSending}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSending ? "Đang gửi..." : "Gửi"}
              </Button>
              
              <Button variant="ghost" size="sm">
                <Paperclip className="h-4 w-4 mr-2" />
                Đính kèm
              </Button>
            </div>
            
            <div className="text-xs text-gray-500">
              Ctrl+Enter để gửi
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
