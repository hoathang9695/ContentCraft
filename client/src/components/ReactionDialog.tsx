import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

export function ReactionDialog({ isOpen, onClose, externalId }) {
  const [numReactions, setNumReactions] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const reactionCount = parseInt(numReactions, 10);
    if (isNaN(reactionCount) || reactionCount < 1) {
      toast({
        title: 'Số lượng không hợp lệ',
        description: 'Vui lòng nhập số lượng reaction lớn hơn 0',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      for (let i = 0; i < reactionCount; i++) {
        try {
          const response = await fetch(`https://prod-sn.emso.vn/api/v1/statuses/${externalId}/favourite`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              custom_vote_type: "like",
              page_id: null
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to send reaction: ${response.status} ${await response.text()}`);
          }
          
        } catch (error) {
          console.error('Error sending reaction:', error);
          toast({
            title: 'Lỗi gửi reaction',
            description: `Reaction thứ ${i + 1} thất bại: ${error.message}`,
            variant: 'destructive'
          });
          //Consider adding logic to handle partial successes and failures here.
        }
      }
      onClose();
    } catch (error) {
      console.error('Error sending reaction:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Reactions</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            type="number"
            placeholder="Number of reactions"
            value={numReactions}
            onChange={(e) => setNumReactions(e.target.value)}
            min="1"
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}