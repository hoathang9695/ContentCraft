
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface PushFollowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId?: string;
  targetUserName?: string;
}

export function PushFollowDialog({ 
  open, 
  onOpenChange, 
  targetUserId,
  targetUserName 
}: PushFollowDialogProps) {
  const { toast } = useToast();
  const [count, setCount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch fake users
  const { data: fakeUsers = [] } = useQuery({
    queryKey: ["/api/fake-users"],
  });

  const handleSubmit = async () => {
    const followCount = parseInt(count, 10);
    if (!targetUserId || !followCount || isNaN(followCount) || followCount <= 0) {
      return;
    }

    setIsProcessing(true);

    try {
      // Get random fake users based on count
      const shuffledUsers = [...fakeUsers].sort(() => Math.random() - 0.5);
      const selectedUsers = shuffledUsers.slice(0, followCount);

      // Process each follow request with 1 minute delay
      for (let i = 0; i < selectedUsers.length; i++) {
        const fakeUser = selectedUsers[i];
        
        try {
          // Call friendship request API
          const response = await fetch(
            `https://prod-sn.emso.vn/api/v1/accounts/${targetUserId}/friendship_requests`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${fakeUser.token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to send follow request with user ${fakeUser.name}`);
          }

          toast({
            title: "Follow request sent",
            description: `${fakeUser.name} sent follow request to ${targetUserName}`,
          });

          // Wait 1 minute before next request if not the last one
          if (i < selectedUsers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 60000));
          }

        } catch (error) {
          console.error('Error sending follow request:', error);
          toast({
            title: "Error",
            description: `Failed to send follow request with user ${fakeUser.name}`,
            variant: "destructive"
          });
        }
      }

      onOpenChange(false);
      setCount('');

    } catch (error) {
      console.error('Error processing follow requests:', error);
      toast({
        title: "Error",
        description: "Failed to process follow requests",
        variant: "destructive"
      });
    }

    setIsProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Push Follow cho {targetUserName}</DialogTitle>
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
