import { useState, useEffect } from 'react';
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
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: number | null;
  externalId?: string; // Thêm externalId cho API bên ngoài
}

interface FakeUser {
  id: number;
  name: string;
  token: string;
  status: string;
}

export function CommentDialog({ open, onOpenChange, contentId, externalId }: CommentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState<string>('');
  const [extractedComments, setExtractedComments] = useState<string[]>([]);
  // Fetch fake users
  const { data: fakeUsers = [] } = useQuery<FakeUser[]>({
    queryKey: ['/api/fake-users'],
    enabled: open && !!externalId, // Only fetch when dialog is open and we have an externalId
  });
  
  // Hàm lấy ngẫu nhiên một người dùng ảo từ danh sách
  const getRandomFakeUser = (): FakeUser | null => {
    if (fakeUsers.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * fakeUsers.length);
    return fakeUsers[randomIndex];
  };
  
  // Extract comments inside {} brackets
  const extractComments = (text: string): string[] => {
    if (!text) return [];
    
    const regex = /{([^}]*)}/g;
    const matches = text.match(regex);
    
    if (!matches) return [text]; // If no matches, use the whole text
    
    return matches.map(match => match.substring(1, match.length - 1).trim()).filter(comment => comment.length > 0);
  };
  
  // Update extracted comments whenever the commentText changes
  useEffect(() => {
    const comments = extractComments(commentText);
    setExtractedComments(comments);
  }, [commentText]);
  
  // Reset form khi đóng dialog
  useEffect(() => {
    if (!open) {
      setCommentText('');
    }
  }, [open]);
  
  // Mutation để gửi comment đến API bên ngoài sử dụng API mới
  const sendExternalCommentMutation = useMutation({
    mutationFn: async ({ externalId, fakeUserId, comment }: { externalId: string, fakeUserId: number, comment: string }) => {
      return await apiRequest('POST', `/api/contents/${externalId}/send-comment`, { 
        fakeUserId, 
        comment 
      });
    },
    onSuccess: (data) => {
      console.log('Kết quả gửi comment API:', data);
      toast({
        title: 'Gửi comment thành công',
        description: 'Comment đã được gửi tới API bên ngoài thành công.',
      });
    },
    onError: (error) => {
      console.error('Lỗi khi gửi comment thông qua API mới:', error);
      toast({
        title: 'Lỗi khi gửi comment',
        description: error instanceof Error ? error.message : 'Lỗi không xác định khi gửi comment',
        variant: 'destructive',
      });
    }
  });

  // Mutation để cập nhật số lượng comment trong DB nội bộ
  const commentMutation = useMutation({
    mutationFn: async ({ id, count }: { id: number, count: number }) => {
      return await apiRequest('PATCH', `/api/contents/${id}/comments`, { count });
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      toast({
        title: 'Cập nhật thành công',
        description: 'Đã thêm comment vào nội dung.',
      });
      
      if (!externalId) {
        onOpenChange(false);
        setCommentText('');
      }
    },
    onError: (error) => {
      toast({
        title: 'Lỗi khi cập nhật comment',
        description: error instanceof Error ? error.message : 'Lỗi không xác định',
        variant: 'destructive',
      });
    },
  });
  
  const handleSubmit = async () => {
    if (!contentId) return;
    
    const commentCount = extractedComments.length;
    
    if (commentCount === 0) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập ít nhất một comment',
        variant: 'destructive',
      });
      return;
    }
    
    // Cập nhật số lượng comment trong DB nội bộ nếu không có externalId
    if (!externalId) {
      commentMutation.mutate({ id: contentId, count: commentCount });
      return;
    }
    
    // Xử lý trường hợp gửi comment qua API bên ngoài
    if (externalId) {
      // Kiểm tra nếu không có người dùng ảo nào
      if (fakeUsers.length === 0) {
        toast({
          title: 'Lỗi',
          description: 'Không tìm thấy người dùng ảo nào. Vui lòng tạo người dùng ảo trước.',
          variant: 'destructive',
        });
        return;
      }
      
      // Gửi từng comment với một người dùng ảo ngẫu nhiên
      let successCount = 0;
      for (const comment of extractedComments) {
        try {
          // Lấy ngẫu nhiên một người dùng ảo cho mỗi comment
          const randomUser = getRandomFakeUser();
          if (!randomUser) continue;
          
          await sendExternalCommentMutation.mutateAsync({
            externalId,
            fakeUserId: randomUser.id,
            comment
          });
          successCount++;
        } catch (error) {
          console.error('Lỗi khi gửi comment:', error);
        }
      }
      
      if (successCount > 0) {
        // Nếu có ít nhất một comment gửi thành công
        toast({
          title: 'Gửi comment thành công',
          description: `Đã gửi thành công ${successCount}/${extractedComments.length} comment.`,
        });
        onOpenChange(false);
        setCommentText('');
      } else {
        // Nếu không có comment nào gửi thành công
        toast({
          title: 'Lỗi',
          description: 'Không thể gửi comment nào. Vui lòng kiểm tra kết nối hoặc thử lại sau.',
          variant: 'destructive',
        });
      }
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col w-[90vw]">
        <DialogHeader>
          <DialogTitle>Comment</DialogTitle>
          <DialogDescription>Cách nhau bởi dấu {'{}'}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 my-4 flex-1 overflow-y-auto pr-2">
          {/* Hiển thị thông tin về người dùng ảo nếu có externalId */}
          {externalId && (
            <div className="flex flex-col space-y-2">
              <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm">
                <p className="font-medium">Thông tin người dùng ảo</p>
                <p className="mt-1">
                  {fakeUsers.length > 0 
                    ? "Hệ thống sẽ tự động chọn ngẫu nhiên một người dùng ảo để gửi mỗi comment" 
                    : "Không có người dùng ảo nào. Vui lòng tạo người dùng ảo trong phần quản lý."}
                </p>
                {fakeUsers.length > 0 && (
                  <p className="mt-1 text-xs">
                    Có tổng cộng {fakeUsers.length} người dùng ảo có thể sử dụng để gửi comment
                  </p>
                )}
              </div>
              {fakeUsers.length === 0 && (
                <p className="text-xs text-red-500">
                  Không có người dùng ảo nào. Vui lòng tạo người dùng ảo trong phần quản lý.
                </p>
              )}
            </div>
          )}
          
          {/* Display extracted comments as buttons */}
          {extractedComments.length > 0 && commentText.includes('{') && commentText.includes('}') && (
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="w-full text-sm text-muted-foreground mb-2">
                Các comment đã tách:
              </div>
              <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto">
                {extractedComments.map((comment, index) => (
                  <div 
                    key={index} 
                    className="bg-white text-xs rounded-md border px-3 py-1.5 flex items-center gap-2 max-w-[300px] group"
                    title={comment}
                  >
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                      {comment.length > 40 ? comment.substring(0, 40) + '...' : comment}
                    </span>
                    <button 
                      type="button"
                      className="text-red-500 hover:text-red-700 ml-auto opacity-70 hover:opacity-100"
                      onClick={() => {
                        // Xóa comment này khỏi chuỗi văn bản
                        const regex = new RegExp(`\\{${comment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g');
                        setCommentText(commentText.replace(regex, ''));
                      }}
                      aria-label="Xóa comment"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Nhập nội dung comment hoặc nhiều comment cách nhau bởi dấu ngoặc nhọn {comment1} {comment2}"
            className="min-h-[200px]"
          />
          
          <div className="text-sm text-muted-foreground">
            Số comments sẽ được thêm: {extractedComments.length}
          </div>
          
          {externalId && (
            <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm">
              <p className="font-medium">Gửi comment tới API bên ngoài</p>
              <p className="mt-1">
                Comments sẽ được gửi đến API của nội dung có ID ngoài: <strong>{externalId}</strong>
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            type="submit" 
            onClick={handleSubmit}
            className="w-24"
            disabled={
              commentMutation.isPending || 
              sendExternalCommentMutation.isPending || 
              (externalId && fakeUsers.length === 0) ||
              extractedComments.length === 0
            }
          >
            {commentMutation.isPending || sendExternalCommentMutation.isPending ? "Đang gửi..." : "Gửi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}