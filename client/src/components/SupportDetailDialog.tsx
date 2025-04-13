import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { SupportRequest } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: SupportRequest | null;
  onRequestUpdated?: () => void;
}

export function SupportDetailDialog({ isOpen, onClose, request, onRequestUpdated }: Props) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleComplete = async () => {
    if (!request) return;
    
    try {
      const response = await fetch(`/api/support-requests/${request.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'completed'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update request');
      }

      toast({
        title: "Thành công",
        description: "Đã đánh dấu yêu cầu là đã hoàn thành",
      });

      setConfirmDialogOpen(false);
      onRequestUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error completing request:', error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái yêu cầu",
        variant: "destructive",
      });
    }
  };

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[600px] p-6">
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold">Chi tiết yêu cầu hỗ trợ</h2>
              <p className="text-sm text-gray-500 mt-1">
                Xem thông tin chi tiết của yêu cầu hỗ trợ
              </p>
            </div>
            <button
              onClick={onClose}
              className="hover:bg-gray-100 rounded-full p-2 transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <span className="text-gray-500">Họ và tên:</span>
            <span className="ml-2 text-purple-600 font-medium">{request.full_name}</span>
          </div>

          <div>
            <span className="text-gray-500">Email:</span>
            <span className="ml-2 text-purple-600 font-medium">{request.email}</span>
          </div>

          <div>
            <span className="text-gray-500">Chủ đề:</span>
            <span className="ml-2 text-purple-600 font-medium">{request.subject}</span>
          </div>

          <div>
            <span className="text-gray-500 block mb-2">Nội dung:</span>
            <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
              {request.content}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Đóng
          </Button>
          {request.status !== 'completed' && (
            <Button 
              onClick={() => setConfirmDialogOpen(true)}
              variant="default"
            >
              Đánh dấu hoàn thành
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận hoàn thành</AlertDialogTitle>
          <AlertDialogDescription>
            Bạn có chắc chắn muốn đánh dấu yêu cầu này là đã hoàn thành?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => setConfirmDialogOpen(false)}
          >
            Hủy
          </Button>
          <Button
            variant="default"
            onClick={handleComplete}
          >
            Xác nhận
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}