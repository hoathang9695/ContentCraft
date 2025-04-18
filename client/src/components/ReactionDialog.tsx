import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ReactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: number | null;
  externalId?: string; 
  onSubmit: (count: number) => void;
  fakeUsers?: { id: number, name: string, token: string }[];
}

const REACTION_TYPES = ['like', 'yay', 'haha', 'love', 'sad', 'wow', 'angry'];

export function ReactionDialog({ open, onOpenChange, contentId, externalId, onSubmit }: ReactionDialogProps) {
  const [count, setCount] = useState<string>('');
  const { toast } = useToast();

  // Fetch fake users
  const { data: fakeUsers = [] } = useQuery({
    queryKey: ['/api/fake-users'],
    enabled: open,
  });

  // Mutation for sending external reaction
  const sendExternalReactionMutation = useMutation({
    mutationFn: async ({ fakeUserId, externalId, reactionType }: { fakeUserId: number, externalId: string, reactionType: string }) => {
      const fakeUser = fakeUsers.find(u => u.id === fakeUserId);
      if (!fakeUser?.token) throw new Error('Invalid fake user token');


      try {
        const requestBody = {
          custom_vote_type: reactionType,
          page_id: null
        };

        const response = await fetch(`https://prod-sn.emso.vn/api/v1/statuses/${externalId}/favourite`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fakeUser.token}`,
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();

        try {
          const responseJson = JSON.parse(responseText);
        } catch (e) {
          // Ignore parsing errors
        }

        if (!response.ok) {
          throw new Error(`Failed to send reaction: ${response.status} ${responseText}`);
        }

        return responseText ? JSON.parse(responseText) : null;
      } catch (error) {
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

    // Close dialog immediately
    onOpenChange(false);
    setCount('');
    onSubmit(reactionCount);

    // Start background process for sending reactions
    const sendReactionsInBackground = async () => {
      if (!externalId) return;

      const usedUserIds = new Set();
      let successCount = 0;

      for (let i = 0; i < reactionCount; i++) {
        try {
          if (usedUserIds.size === fakeUsers.length) {
            usedUserIds.clear();
          }

          const availableUsers = fakeUsers.filter(user => !usedUserIds.has(user.id));

          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 60000));
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

          toast({
            title: 'Đã gửi reaction',
            description: `Đã gửi ${successCount}/${reactionCount} reactions`,
          });
        } catch (error) {
          toast({
            title: 'Lỗi gửi reaction',
            description: `Reaction thứ ${i + 1} thất bại`,
            variant: 'destructive'
          });
        }
      }
    };

    // Show initial toast
    toast({
      title: 'Đang gửi reactions',
      description: `Bắt đầu gửi ${reactionCount} reactions trong nền`,
    });

    // Execute background process
    try {
      await sendReactionsInBackground();
    } catch (error) {
     
    }
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
          <Button onClick={handleSubmit}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}