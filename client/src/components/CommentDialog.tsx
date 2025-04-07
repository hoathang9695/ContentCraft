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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: number | null;
  externalId?: string; // Thêm externalId cho API bên ngoài
}

export function CommentDialog({ open, onOpenChange, contentId, externalId }: CommentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState<string>('');
  const [extractedComments, setExtractedComments] = useState<string[]>([]);
  
  // Removed predefined comments
  
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
  
  // Removed predefined comment function
  
  // Mutation để gửi comment đến API bên ngoài
  const externalCommentMutation = useMutation({
    mutationFn: async ({ postId, comments }: { postId: string, comments: string[] }) => {
      try {
        // Token để xác thực với API bên ngoài
        const token = "81DIz11M_VLcNsCsO5pEyN0A2m5kPRYSH5dZ7MWwQ44";
        
        // Gửi comments đến API bên ngoài
        // Thử nhiều định dạng khác nhau vì API có thể yêu cầu định dạng cụ thể
        const results = await Promise.all(
          comments.map(async (comment) => {
            // Chuẩn bị nhiều định dạng dữ liệu khác nhau để thử
            const formats = [
              { content: comment },
              { text: comment },
              { comment: comment },
              { body: comment },
              { message: comment }
            ];
            
            // Thử từng định dạng cho đến khi thành công hoặc hết định dạng
            for (const format of formats) {
              try {
                const response = await fetch(`https://prod-sn.emso.vn/api/v1/statuses/${postId}/comments`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify(format),
                });
                
                const result = await response.json();
                console.log('Kết quả API:', result);
                
                // Nếu API không trả về lỗi, coi như thành công
                if (!result.error) {
                  return result;
                }
                
                // Log lỗi để debug
                console.error('Định dạng', format, 'trả về lỗi:', result.error);
                
                // Nếu lỗi không phải do định dạng, thoát khỏi vòng lặp
                if (result.error !== "Nội dung không thể để trắng") {
                  return result;
                }
              } catch (err) {
                console.error('Lỗi khi gửi với định dạng', format, ':', err);
              }
            }
            
            // Nếu tất cả các định dạng đều thất bại, trả về thông báo lỗi
            return { error: "Không thể gửi comment với bất kỳ định dạng nào" };
          })
        );
        return results;
      } catch (error) {
        console.error('Lỗi khi gửi comment đến API bên ngoài:', error);
        throw error;
      }
    },
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
  
  const handleSubmit = async () => {
    if (!contentId) return;
    
    const commentCount = extractedComments.length;
    
    if (commentCount > 0) {
      // Đầu tiên cập nhật số lượng comment trong DB nội bộ
      commentMutation.mutate({ id: contentId, count: commentCount });
      
      // Sau đó, nếu có externalId và có comments hợp lệ, gửi đến API bên ngoài
      if (externalId) {
        try {
          await externalCommentMutation.mutateAsync({
            postId: externalId,
            comments: extractedComments
          });
          console.log('Đã gửi các comment đến API bên ngoài thành công');
        } catch (error) {
          console.error('Lỗi khi gửi comments đến API bên ngoài:', error);
          toast({
            title: 'Lưu ý',
            description: 'Đã cập nhật số lượng comment trong hệ thống nội bộ thành công, nhưng API bên ngoài báo lỗi "Nội dung không thể để trắng". Vui lòng kiểm tra định dạng API.',
            variant: 'destructive',
          });
        }
      }
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
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col w-[90vw]">
        <DialogHeader>
          <DialogTitle>Comment</DialogTitle>
          <DialogDescription>Cách nhau bởi dấu {'{}'}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 my-4 flex-1 overflow-y-auto pr-2">
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
        </div>
        
        <DialogFooter>
          <Button 
            type="submit" 
            onClick={handleSubmit}
            className="w-24"
            disabled={commentMutation.isPending || externalCommentMutation.isPending}
          >
            {commentMutation.isPending || externalCommentMutation.isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}