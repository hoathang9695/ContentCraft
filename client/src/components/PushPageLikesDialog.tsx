import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    const likeCount = parseInt(count, 10);
    if (!targetPageId || !likeCount || isNaN(likeCount) || likeCount <= 0) {
      return;
    }

    // Kiểm tra nếu không có người dùng ảo nào với giới tính đã chọn
    if (fakeUsers.length === 0) {
      const getGenderDisplayName = (gender: string) => {
        switch (gender) {
          case 'male_adult': return 'Nam trung niên';
          case 'male_young': return 'Nam thanh niên';
          case 'male_teen': return 'Nam thiếu niên';
          case 'female_adult': return 'Nữ trung niên';
          case 'female_young': return 'Nữ thanh niên';
          case 'female_teen': return 'Nữ thiếu niên';
          case 'other': return 'Khác';
          default: return 'Tất cả giới tính';
        }
      };

      const errorMessage = allFakeUsers.length === 0 
        ? 'Không tìm thấy người dùng ảo nào. Vui lòng tạo người dùng ảo trước.'
        : `Không có người dùng ảo nào với giới tính "${getGenderDisplayName(selectedGender)}". Hãy chọn giới tính khác hoặc tạo thêm người dùng ảo.`;

      toast({
        title: 'Lỗi',
        description: errorMessage,
        variant: 'destructive',
      });
      return;
    }

    // Close dialog immediately
    onOpenChange(false);
    setCount('');
    setSelectedGender('all');

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
          {/* Gender selection */}
          <div className="space-y-2">
            <Label htmlFor="gender-select" className="text-sm font-medium">
              Lọc theo giới tính người dùng ảo
            </Label>
            <Select value={selectedGender} onValueChange={(value: 'all' | 'male_adult' | 'male_young' | 'male_teen' | 'female_adult' | 'female_young' | 'female_teen' | 'other') => setSelectedGender(value)}>
              <SelectTrigger id="gender-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả giới tính</SelectItem>
                <SelectItem value="male_adult">Nam trung niên</SelectItem>
                <SelectItem value="male_young">Nam thanh niên</SelectItem>
                <SelectItem value="male_teen">Nam thiếu niên</SelectItem>
                <SelectItem value="female_adult">Nữ trung niên</SelectItem>
                <SelectItem value="female_young">Nữ thanh niên</SelectItem>
                <SelectItem value="female_teen">Nữ thiếu niên</SelectItem>
                <SelectItem value="other">Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User count display */}
          <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm">
            <p className="font-medium">Thông tin người dùng ảo</p>
            <p className="mt-1">
              {fakeUsers.length > 0 
                ? "Hệ thống sẽ tự động chọn ngẫu nhiên một người dùng ảo khác nhau để gửi mỗi like" 
                : selectedGender === 'all' 
                  ? "Không có người dùng ảo nào. Vui lòng tạo người dùng ảo trong phần quản lý."
                  : `Không có người dùng ảo nào với giới tính "${(() => {
                      switch (selectedGender) {
                        case 'male_adult': return 'Nam trung niên';
                        case 'male_young': return 'Nam thanh niên';
                        case 'male_teen': return 'Nam thiếu niên';
                        case 'female_adult': return 'Nữ trung niên';
                        case 'female_young': return 'Nữ thanh niên';
                        case 'female_teen': return 'Nữ thiếu niên';
                        case 'other': return 'Khác';
                        default: return 'Tất cả giới tính';
                      }
                    })()}". Hãy chọn giới tính khác hoặc tạo thêm người dùng ảo.`}
            </p>
            {fakeUsers.length > 0 && (
              <p className="mt-1 text-xs">
                {selectedGender === 'all' 
                  ? `Có tổng cộng ${fakeUsers.length} người dùng ảo có thể sử dụng để gửi like`
                  : `Có ${fakeUsers.length} người dùng ảo ${(() => {
                      switch (selectedGender) {
                        case 'male_adult': return 'nam trung niên';
                        case 'male_young': return 'nam thanh niên';
                        case 'male_teen': return 'nam thiếu niên';
                        case 'female_adult': return 'nữ trung niên';
                        case 'female_young': return 'nữ thanh niên';
                        case 'female_teen': return 'nữ thiếu niên';
                        case 'other': return 'giới tính khác';
                        default: return 'tất cả giới tính';
                      }
                    })()} có thể sử dụng để gửi like`}
              </p>
            )}
            {allFakeUsers.length > 0 && fakeUsers.length === 0 && selectedGender !== 'all' && (
              <p className="mt-1 text-xs text-orange-600">
                Tổng cộng có {allFakeUsers.length} người dùng ảo, nhưng không có ai với giới tính đã chọn.
              </p>
            )}
          </div>

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