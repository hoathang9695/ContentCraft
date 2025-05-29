
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface PushPageLikesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPageId?: string;
  targetPageName?: string;
}

export function PushPageLikesDialog({ 
  open, 
  onOpenChange, 
  targetPageId,
  targetPageName 
}: PushPageLikesDialogProps) {
  const { toast } = useToast();
  const [count, setCount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch fake users
  const { data: fakeUsers = [] } = useQuery({
    queryKey: ["/api/fake-users"],
  });

  const handleSubmit = () => {
    const likeCount = parseInt(count, 10);
    if (!targetPageId || !likeCount || isNaN(likeCount) || likeCount <= 0) {
      return;
    }

    // Close dialog immediately
    onOpenChange(false);
    setCount('');

    // Show initial toast
    toast({
      title: 'Push Likes',
      description: `Bắt đầu gửi ${likeCount} likes cho trang ${targetPageName}`,
    });

    // Process likes in background
    const processPushLikesInBackground = async () => {
      let successCount = 0;
      
      try {
        const shuffledUsers = [...fakeUsers].sort(() => Math.random() - 0.5);
        const selectedUsers = shuffledUsers.slice(0, likeCount);

        for (let i = 0; i < selectedUsers.length; i++) {
          const fakeUser = selectedUsers[i];
          
          try {
            // Call page likes API
            const response = await fetch(
              `https://prod-sn.emso.vn/api/v1/pages/${targetPageId}/likes`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${fakeUser.token}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (!response.ok) {
              throw new Error(`Failed to send like with user ${fakeUser.name}`);
            }

            successCount++;
            toast({
              title: 'Like sent',
              description: `${fakeUser.name} đã like trang ${targetPageName} (${successCount}/${likeCount})`,
            });

            // Wait 1 minute before next request if not the last one
            if (i < selectedUsers.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 60000));
            }

          } catch (error) {
            console.error('Error sending like:', error);
            toast({
              title: 'Error',
              description: `Không thể gửi like với user ${fakeUser.name}`,
              variant: 'destructive'
            });
          }
        }

        // Final success toast
        toast({
          title: 'Completed',
          description: `Đã hoàn thành gửi ${successCount}/${likeCount} likes cho trang ${targetPageName}`,
        });

      } catch (error) {
        console.error('Error processing likes:', error);
        toast({
          title: 'Error',
          description: 'Có lỗi xảy ra khi xử lý likes',
          variant: 'destructive'
        });
      }
    };

    // Execute background process
    processPushLikesInBackground();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Push Follow cho {targetPageName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            type="number"
            min="1"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="Nhập số lượng"
            disabled={isProcessing}
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? 'Đang xử lý...' : 'Lưu'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
