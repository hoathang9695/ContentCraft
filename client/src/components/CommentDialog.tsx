import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: number | null;
}

export function CommentDialog({ open, onOpenChange, contentId }: CommentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState<string>('');
  
  // Predefined comment templates
  const predefinedComments = [
    "Không biết bạn này nghĩ gì, nhưng mà ngon ...",
    "Đáng cấp vãi",
    "Mẹ chúng mày, chờ",
    "ĂN GÌ ĐẤY HẢ",
    "Quá tuyệt với Adơi",
    "Quá đỉnh cao"
  ];
  
  // Extract comments inside {} brackets
  const extractComments = (text: string): string[] => {
    const regex = /{([^}]*)}/g;
    const matches = text.match(regex);
    
    if (!matches) return [text]; // If no matches, use the whole text
    
    return matches.map(match => match.substring(1, match.length - 1));
  };
  
  const addPredefinedComment = (comment: string) => {
    setCommentText(prev => prev + (prev ? ' ' : '') + comment);
  };
  
  const commentMutation = useMutation({
    mutationFn: async ({ id, count }: { id: number, count: number }) => {
      return await apiRequest('PATCH', `/api/contents/${id}/comments`, { count });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      toast({
        title: 'Cập nhật thành công',
        description: 'Đã thêm comment vào nội dung.',
      });
      onOpenChange(false);
      setCommentText('');
    },
    onError: (error) => {
      toast({
        title: 'Lỗi khi cập nhật comment',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  const handleSubmit = () => {
    if (!contentId) return;
    
    const comments = extractComments(commentText);
    const commentCount = comments.length;
    
    if (commentCount > 0) {
      commentMutation.mutate({ id: contentId, count: commentCount });
    } else {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập ít nhất một comment',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Comment</DialogTitle>
          <DialogDescription>Cách nhau bởi dấu {'{}'}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 my-4">
          <div className="flex flex-wrap gap-2">
            {predefinedComments.map((comment, index) => (
              <Button 
                key={index} 
                variant="outline" 
                size="sm"
                onClick={() => addPredefinedComment(comment)}
              >
                {comment}
              </Button>
            ))}
          </div>
          
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Nhập nội dung comment hoặc nhiều comment cách nhau bởi dấu ngoặc nhọn {comment1} {comment2}"
            className="min-h-[200px]"
          />
          
          <div className="text-sm text-muted-foreground">
            Số comments sẽ được thêm: {extractComments(commentText).length}
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            type="submit" 
            onClick={handleSubmit}
            className="w-24"
            disabled={commentMutation.isPending}
          >
            {commentMutation.isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}