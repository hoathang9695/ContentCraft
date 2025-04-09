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

      // Log để debug
      console.log(`Sending reaction to external ID ${externalId}`);
      console.log(`Using fake user:`, fakeUser);
      console.log(`Reaction type:`, reactionType);

      try {
        // Log request details
        const requestBody = {
          custom_vote_type: reactionType,
          page_id: null
        };

        console.log('Sending reaction request:', {
          url: `https://prod-sn.emso.vn/api/v1/statuses/${externalId}/favourite`,
          token: fakeUser.token,
          body: requestBody
        });

        const response = await fetch(`https://prod-sn.emso.vn/api/v1/statuses/${externalId}/favourite`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fakeUser.token}`
          },
          body: JSON.stringify(requestBody)
        });

        // Log response details for debugging
        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Response body:', responseText);

        if (!response.ok) {
          throw new Error(`Failed to send reaction: ${response.status} ${responseText}`);
        }

        return responseText ? JSON.parse(responseText) : null;
      } catch (error) {
        console.error('Error sending reaction:', error);
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

    if (externalId) {
      // Track used fake users to avoid duplicates
      const usedUserIds = new Set();

      for (let i = 0; i < reactionCount; i++) {
        try {
          // Reset used users if we've used them all
          if (usedUserIds.size === fakeUsers.length) {
            usedUserIds.clear();
          }

          // Get available users
          const availableUsers = fakeUsers.filter(user => !usedUserIds.has(user.id));

          // Select random user and reaction type
          // Add 1-minute delay between reactions (except for first one)
          if (i > 0) {
            toast({
              title: 'Đang chờ',
              description: `Chờ 1 phút trước khi gửi reaction tiếp theo...`,
            });
            await new Promise(resolve => setTimeout(resolve, 60000)); // 60 seconds = 1 minute
          }

          const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
          const randomReactionType = REACTION_TYPES[Math.floor(Math.random() * REACTION_TYPES.length)];

          await sendExternalReactionMutation.mutateAsync({
            fakeUserId: randomUser.id,
            externalId,
            reactionType: randomReactionType
          });

          usedUserIds.add(randomUser.id);

          // Update local reaction count
          if (i === reactionCount - 1) {
            onSubmit(reactionCount);
          }
        } catch (error) {
          console.error('Error sending reaction:', error);
          toast({
            title: 'Lỗi gửi reaction',
            description: `Reaction thứ ${i + 1} thất bại`,
            variant: 'destructive'
          });
        }
      }
    } else {
      // If no externalId, just update local count
      onSubmit(reactionCount);
    }

    setCount('');
    onOpenChange(false);
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