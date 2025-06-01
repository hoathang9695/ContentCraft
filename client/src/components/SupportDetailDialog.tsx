
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SupportRequest } from "@/lib/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: SupportRequest | null;
}

export function SupportDetailDialog({ isOpen, onClose, request }: Props) {
  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[600px] p-0 gap-0">
        <div className="p-6 pb-0">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-1">Chi tiết yêu cầu hỗ trợ</h2>
            <p className="text-sm text-muted-foreground">
              Xem thông tin chi tiết của yêu cầu hỗ trợ
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-[100px,1fr] items-center">
              <span className="text-muted-foreground">Họ và tên:</span>
              <span className="font-medium" style={{ color: '#7367e0' }}>{request.full_name}</span>
            </div>

            <div className="grid grid-cols-[100px,1fr] items-center">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium" style={{ color: '#7367e0' }}>{request.email}</span>
            </div>

            <div className="grid grid-cols-[100px,1fr] items-center">
              <span className="text-muted-foreground">Chủ đề:</span>
              <span className="font-medium" style={{ color: '#7367e0' }}>{request.subject}</span>
            </div>

            <div>
              <span className="text-muted-foreground block mb-2">Nội dung:</span>
              <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-gray-900">
                {request.content}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end bg-gray-50 p-4 mt-6">
          <Button 
            onClick={onClose}
            className="text-white px-6"
            style={{ 
              backgroundColor: '#7367e0',
              '&:hover': { backgroundColor: '#5a52cc' }
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a52cc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#7367e0'}
          >
            Đã xem
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
