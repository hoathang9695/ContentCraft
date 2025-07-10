

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';

interface ReactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: number | null;
  externalId?: string;
  onSubmit: (count: number) => void;
}

interface FakeUser {
  id: number;
  name: string;
  token: string;
  gender: string;
  status: string;
}

const REACTION_TYPES = ['like', 'yay', 'haha', 'love', 'sad', 'wow', 'angry'];
// Random delay từ 1-5 phút (60000-300000ms)
const getRandomDelay = () => Math.floor(Math.random() * (300000 - 60000 + 1) + 60000);

export function ReactionDialog({ open, onOpenChange, contentId, externalId, onSubmit }: ReactionDialogProps) {
  const [count, setCount] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<'all' | 'male_adult' | 'male_young' | 'male_teen' | 'female_adult' | 'female_young' | 'female_teen' | 'other'>('all');
  const { toast } = useToast();

  // Fetch fake users
  const { data: allFakeUsers = [] } = useQuery<FakeUser[]>({
    queryKey: ['/api/fake-users'],
    enabled: open && !!externalId, // Only fetch when dialog is open and we have an externalId
  });

  // Filter fake users by selected gender
  const fakeUsers = selectedGender === 'all' 
    ? allFakeUsers 
    : allFakeUsers.filter(user => user.gender === selectedGender);

  const sendExternalReactionMutation = useMutation({
    mutationFn: async ({ fakeUserId, externalId, reactionType }: { fakeUserId: number, externalId: string, reactionType: string }) => {
      console.log('Sending reaction with:', { fakeUserId, externalId, reactionType });
      
      const fakeUser = fakeUsers.find(u => u.id === fakeUserId);
      if (!fakeUser?.token) {
        console.error('Invalid user token for ID:', fakeUserId);
        throw new Error('Token người dùng không hợp lệ');
      }

      try {
        const response = await fetch(`https://prod-sn.emso.vn/api/v1/statuses/${externalId}/favourite`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fakeUser.token}`,
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({
            custom_vote_type: reactionType,
            page_id: null
          })
        });

        console.log('External API response status:', response.status);
        
        if (response.ok) {
          const result = await response.json().catch(e => {
            console.warn('Failed to parse JSON response:', e);
            return null;
          });
          console.log('External API response:', result);
          return result;
        }

        const errorText = await response.text();
        console.error('External API error:', {
          status: response.status,
          text: errorText,
          headers: Object.fromEntries(response.headers.entries())
        });

        throw new Error(`Lỗi gửi reaction: ${response.status} ${errorText}`);
      } catch (error) {
        console.error('Request failed:', error);
        throw error;
      }
    }
  });

  const handleSubmit = async () => {
    const reactionCount = parseInt(count, 10);
    if (isNaN(reactionCount) || reactionCount < 1) {
      toast({
        title: 'Số lượng không hợp lệ',
        description: 'Vui lòng nhập số lượng reaction lớn hơn 0',
        variant: 'destructive'
      });
      return;
    }

    if (reactionCount > 50) {
      toast({
        title: 'Số lượng quá lớn',
        description: 'Số lượng reactions không được vượt quá 50',
        variant: 'destructive'
      });
      return;
    }

    // Kiểm tra nếu có externalId nhưng không có người dùng ảo nào
    if (externalId && fakeUsers.length === 0) {
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

    onOpenChange(false);
    setCount('');
    onSubmit(reactionCount);

    if (!externalId) return;

    toast({
      title: 'Đang gửi reactions',
      description: `Bắt đầu gửi ${reactionCount} reactions trong nền`,
    });

    const usedUserIds = new Set<number>();
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < reactionCount; i++) {
      try {
        if (usedUserIds.size === fakeUsers.length) {
          usedUserIds.clear();
        }

        const availableUsers = fakeUsers.filter(user => !usedUserIds.has(user.id));
        if (availableUsers.length === 0) {
          toast({
            title: 'Hết người dùng khả dụng',
            description: 'Không còn người dùng nào để gửi reaction',
            variant: 'destructive'
          });
          break;
        }

        if (i > 0) {
          const delay = getRandomDelay();
          console.log(`Chờ ${Math.round(delay/1000)} giây trước khi gửi reaction tiếp theo...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
        const randomReactionType = REACTION_TYPES[Math.floor(Math.random() * REACTION_TYPES.length)];

        await sendExternalReactionMutation.mutateAsync({
          fakeUserId: randomUser.id,
          externalId,
          reactionType: randomReactionType
        });

        usedUserIds.add(randomUser.id);
        successCount++;

        if (successCount % 5 === 0 || successCount === reactionCount) {
          toast({
            title: 'Tiến độ gửi reaction',
            description: `Đã gửi thành công ${successCount}/${reactionCount} reactions`,
          });
        }
      } catch (error) {
        failureCount++;
        console.error('Lỗi gửi reaction:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Không thể kết nối đến server';
        
        toast({
          title: 'Lỗi gửi reaction',
          description: `Reaction thứ ${i + 1} thất bại: ${errorMessage}. Đã thất bại ${failureCount} lần.`,
          variant: 'destructive'
        });

        if (failureCount >= 3) {
          // Thử với user khác
          usedUserIds.clear();
          failureCount = 0;
          toast({
            title: 'Đổi người dùng',
            description: 'Thử lại với người dùng khác',
            variant: 'default'
          });
        }

        // Thử lại sau 10 giây nếu lỗi
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    toast({
      title: 'Hoàn thành gửi reactions',
      description: `Thành công: ${successCount}, Thất bại: ${failureCount}`,
      variant: successCount > 0 ? 'default' : 'destructive'
    });
  };

  // Reset form khi đóng dialog
  React.useEffect(() => {
    if (!open) {
      setCount('');
      setSelectedGender('all');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Reactions</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Hiển thị thông tin về người dùng ảo nếu có externalId */}
          {externalId && (
            <div className="space-y-3">
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

              <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm">
                <p className="font-medium">Thông tin người dùng ảo</p>
                <p className="mt-1">
                  {fakeUsers.length > 0 
                    ? "Hệ thống sẽ tự động chọn ngẫu nhiên một người dùng ảo khác nhau để gửi mỗi reaction" 
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
                      ? `Có tổng cộng ${fakeUsers.length} người dùng ảo có thể sử dụng để gửi reaction`
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
                        })()} có thể sử dụng để gửi reaction`}
                  </p>
                )}
                {allFakeUsers.length > 0 && fakeUsers.length === 0 && selectedGender !== 'all' && (
                  <p className="mt-1 text-xs text-orange-600">
                    Tổng cộng có {allFakeUsers.length} người dùng ảo, nhưng không có ai với giới tính đã chọn.
                  </p>
                )}
              </div>
              {allFakeUsers.length === 0 && (
                <p className="text-xs text-red-500">
                  Không có người dùng ảo nào. Vui lòng tạo người dùng ảo trong phần quản lý.
                </p>
              )}
            </div>
          )}

          {/* Input số lượng reactions */}
          <div className="space-y-2">
            <Label htmlFor="reaction-count">Số lượng reactions</Label>
            <Input
              id="reaction-count"
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="Nhập số lượng reactions < 50"
              min="1"
              max="50"
            />
          </div>

          {externalId && (
            <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm">
              <p className="font-medium">Gửi reaction tới API bên ngoài</p>
              <p className="mt-1">
                Reactions sẽ được gửi đến API của nội dung có ID ngoài: <strong>{externalId}</strong>
              </p>
              <p className="mt-1 text-xs italic">
                Lưu ý: Hệ thống sẽ tự động thêm độ trễ 1-5 phút giữa các reaction để tránh lỗi từ API bên ngoài.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button 
            onClick={handleSubmit}
            disabled={
              (externalId && fakeUsers.length === 0) ||
              !count ||
              parseInt(count) < 1 ||
              parseInt(count) > 50
            }
          >
            Gửi Reactions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

