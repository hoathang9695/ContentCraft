
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { SupportRequest } from "@/lib/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: SupportRequest | null;
}

export function SupportDetailDialog({ isOpen, onClose, request }: Props) {
  const queryClient = useQueryClient();
  
  const markAsViewed = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/support-requests/${id}/mark-as-viewed`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      if (!response.ok) {
        throw new Error('Failed to update status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      onClose();
    },
  });

  if (!request) return null;

  const handleMarkAsViewed = () => {
    markAsViewed.mutate(request.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[600px] p-6 bg-background">
        <DialogHeader className="relative">
          <button
            onClick={onClose}
            className="absolute right-0 top-0 hover:bg-gray-100 rounded-full p-2 transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
          <DialogTitle className="text-xl font-semibold mb-2">Chi tiết yêu cầu hỗ trợ</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Xem thông tin chi tiết của yêu cầu hỗ trợ
          </p>
        </DialogHeader>

        <div className="space-y-4 py-6">
          <div>
            <span className="text-muted-foreground">Họ và tên:</span>
            <span className="ml-2 text-primary font-medium">{request.full_name}</span>
          </div>

          <div>
            <span className="text-muted-foreground">Email:</span>
            <span className="ml-2 text-primary font-medium">{request.email}</span>
          </div>

          <div>
            <span className="text-muted-foreground">Chủ đề:</span>
            <span className="ml-2 text-primary font-medium">{request.subject}</span>
          </div>

          <div>
            <span className="text-muted-foreground block mb-2">Nội dung:</span>
            <div className="bg-muted/50 p-4 rounded-lg whitespace-pre-wrap">
              {request.content}
            </div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
            <Button 
              onClick={handleMarkAsViewed}
              disabled={request.status === 'completed'}
              variant="default"
            >
              {request.status === 'completed' ? 'Đã xử lý' : 'Đã xem'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
