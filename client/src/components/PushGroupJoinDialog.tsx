import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface PushGroupJoinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetGroupId?: string;
  targetGroupName?: string;
}

export function PushGroupJoinDialog({ 
  open, 
  onOpenChange, 
  targetGroupId,
  targetGroupName 
}: PushGroupJoinDialogProps) {
  const { toast } = useToast();
  const [count, setCount] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<'all' | 'male_adult' | 'male_young' | 'male_teen' | 'female_adult' | 'female_young' | 'female_teen' | 'other'>('all');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch fake users
  const { data: allFakeUsers = [] } = useQuery({
    queryKey: ["/api/fake-users"],
  });

  // Filter fake users by selected gender
  const fakeUsers = selectedGender === 'all' 
    ? allFakeUsers 
    : allFakeUsers.filter(user => user.gender === selectedGender);

  const handleSubmit = () => {
    const joinCount = parseInt(count, 10);
    if (!targetGroupId || !joinCount || isNaN(joinCount) || joinCount <= 0) {
      return;
    }

    // Close dialog immediately
    onOpenChange(false);
    setCount('');

    // Show initial toast
    toast({
      title: 'Push Tham gia',
      description: `Bắt đầu gửi ${joinCount} yêu cầu tham gia cho nhóm ${targetGroupName || 'Unknown'}`,
    });

    // Process join requests in background
    const processPushJoinInBackground = async () => {
      let successCount = 0;

      try {
        const shuffledUsers = [...fakeUsers].sort(() => Math.random() - 0.5);
        const selectedUsers = shuffledUsers.slice(0, joinCount);

        for (let i = 0; i < selectedUsers.length; i++) {
          const fakeUser = selectedUsers[i];

          try {
            console.log(`Sending join request for user ${fakeUser.name} to group ${targetGroupId}`);

            // Call group join API
            const response = await fetch(
              `https://prod-sn.emso.vn/api/v1/groups/${targetGroupId}/accounts`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${fakeUser.token}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Origin': window.location.origin,
                  'Referer': window.location.href
                },
                mode: 'cors',
                credentials: 'omit'
              }
            );

            console.log(`Response status for ${fakeUser.name}:`, response.status);
            console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

            // Log response body for debugging
            const responseText = await response.text();
            console.log(`Response body for ${fakeUser.name}:`, responseText);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${responseText || 'Failed to send join request'}`);
            }

            successCount++;
            toast({
              title: 'Join request sent',
              description: `${fakeUser.name} đã gửi yêu cầu tham gia nhóm ${targetGroupName || 'Unknown'} (${successCount}/${joinCount})`,
            });

            // Wait 1 minute before next request if not the last one
            if (i < selectedUsers.length - 1) {
              console.log(`Waiting 60 seconds before next request...`);
              await new Promise(resolve => setTimeout(resolve, 60000));
            }

          } catch (error) {
            console.error(`Error sending join request for ${fakeUser.name}:`, error);
            toast({
              title: 'Error',
              description: `Không thể gửi yêu cầu tham gia với user ${fakeUser.name}: ${error.message}`,
              variant: 'destructive'
            });
          }
        }

        // Final success toast
        toast({
          title: 'Completed',
          description: `Đã hoàn thành gửi ${successCount}/${joinCount} yêu cầu tham gia cho nhóm ${targetGroupName || 'Unknown'}`,
        });

      } catch (error) {
        console.error('Error processing join requests:', error);
        toast({
          title: 'Error',
          description: 'Có lỗi xảy ra khi xử lý yêu cầu tham gia',
          variant: 'destructive'
        });
      }
    };

    // Execute background process
    processPushJoinInBackground();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Push Tham gia cho {targetGroupName}</DialogTitle>
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
          <div>
            <Label htmlFor="gender">Giới tính</Label>
            <Select value={selectedGender} onValueChange={(value) => setSelectedGender(value as any)}>
              <SelectTrigger id="gender">
                <SelectValue placeholder="Chọn giới tính" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="male_adult">Nam (trưởng thành)</SelectItem>
                <SelectItem value="male_young">Nam (thanh niên)</SelectItem>
                <SelectItem value="male_teen">Nam (thiếu niên)</SelectItem>
                <SelectItem value="female_adult">Nữ (trưởng thành)</SelectItem>
                <SelectItem value="female_young">Nữ (thanh niên)</SelectItem>
                <SelectItem value="female_teen">Nữ (thiếu niên)</SelectItem>
                <SelectItem value="other">Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>
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