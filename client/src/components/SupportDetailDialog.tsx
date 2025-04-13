
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogTitle>Chi tiết yêu cầu hỗ trợ</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Xem thông tin chi tiết của yêu cầu hỗ trợ
          </p>
        </DialogHeader>

        <div className="space-y-4 py-6">
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

        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
            <Button 
              onClick={handleMarkAsViewed}
              disabled={request.status === 'completed'}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {request.status === 'completed' ? 'Đã xử lý' : 'Đã xem'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
