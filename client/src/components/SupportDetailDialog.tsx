
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
      const response = await fetch(`/api/support-requests/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'completed'
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to update status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support-requests'] });
      onClose();
    },
  });

  if (!request) return null;

  const handleMarkAsViewed = () => {
    markAsViewed.mutate(request.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Chi tiết yêu cầu hỗ trợ</DialogTitle>
          <DialogDescription>
            Xem thông tin chi tiết của yêu cầu hỗ trợ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
          <Button 
            onClick={handleMarkAsViewed}
            disabled={request.status === 'completed'}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {request.status === 'completed' ? 'Đã xử lý' : 'Đã xem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
