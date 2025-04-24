
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';

interface ReactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: number | null;
  externalId?: string;
  onSubmit: (count: number) => void;
}

const REACTION_TYPES = ['like', 'yay', 'haha', 'love', 'sad', 'wow', 'angry'];
const REACTION_DELAY = 60000; // 1 phút

export function ReactionDialog({ open, onOpenChange, contentId, externalId, onSubmit }: ReactionDialogProps) {
  const [count, setCount] = useState<string>('');
  const { toast } = useToast();

  const { data: fakeUsers = [] } = useQuery({
    queryKey: ['/api/fake-users'],
    enabled: open,
  });

  const sendExternalReactionMutation = useMutation({
    mutationFn: async ({ fakeUserId, externalId, reactionType }: { fakeUserId: number, externalId: string, reactionType: string }) => {
      const fakeUser = fakeUsers.find(u => u.id === fakeUserId);
      if (!fakeUser?.token) throw new Error('Token người dùng không hợp lệ');

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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lỗi gửi reaction: ${response.status} ${errorText}`);
      }

      return response.json().catch(() => null);
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
          await new Promise(resolve => setTimeout(resolve, REACTION_DELAY));
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
        
        toast({
          title: 'Lỗi gửi reaction',
          description: `Reaction thứ ${i + 1} thất bại. Đã thất bại ${failureCount} lần.`,
          variant: 'destructive'
        });

        // Thử lại sau 30 giây nếu lỗi
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    toast({
      title: 'Hoàn thành gửi reactions',
      description: `Thành công: ${successCount}, Thất bại: ${failureCount}`,
      variant: successCount > 0 ? 'default' : 'destructive'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reactions</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            type="number"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="Nhập số lượng reactions"
            min="1"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSubmit}>Gửi Reactions</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
