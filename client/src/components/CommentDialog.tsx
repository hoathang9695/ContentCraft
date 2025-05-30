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
  // Đảm bảo không lấy trùng lặp người dùng (trừ khi không còn lựa chọn)
  const getRandomFakeUser = (usedIds: number[] = []): FakeUser | null => {
    if (fakeUsers.length === 0) return null;

    // Nếu đã sử dụng tất cả người dùng ảo, bắt đầu lại từ đầu
    if (usedIds.length >= fakeUsers.length) {
      const randomIndex = Math.floor(Math.random() * fakeUsers.length);
      return fakeUsers[randomIndex];
    }

    // Lọc ra những người dùng chưa sử dụng
    const availableUsers = fakeUsers.filter(user => !usedIds.includes(user.id));

    // Chọn ngẫu nhiên một người dùng từ danh sách còn lại
    const randomIndex = Math.floor(Math.random() * availableUsers.length);
    return availableUsers[randomIndex];
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

    // Loại bỏ các comment trùng lặp
    const uniqueComments = Array.from(new Set(extractedComments));

    if (uniqueComments.length === 0) {
      toast({
        title: 'Lỗi', 
        description: 'Vui lòng nhập ít nhất một comment',
        variant: 'destructive',
      });
      return;
    }

    // Kiểm tra nếu không có người dùng ảo nào khi có externalId
    if (externalId && fakeUsers.length === 0) {
      toast({
        title: 'Lỗi',
        description: 'Không tìm thấy người dùng ảo nào. Vui lòng tạo người dùng ảo trước.',
        variant: 'destructive',
      });
      return;
    }

    // Đóng dialog ngay lập tức
    onOpenChange(false);
    setCommentText('');

    // Cập nhật số lượng comment trong DB nội bộ nếu không có externalId
    if (!externalId) {
      commentMutation.mutate({ id: contentId, count: uniqueComments.length });
      return;
    }

    // Hiển thị thông báo bắt đầu
    toast({
      title: 'Bắt đầu gửi comment',
      description: `Sẽ gửi ${uniqueComments.length} comment. Quá trình này có thể mất vài phút...`,
    });

    // Tạo worker để gửi comment ngầm với error handling tốt hơn
    const sendCommentsInBackground = async () => {
      let successCount = 0;
      let failureCount = 0;
      const usedUserIds = new Set<number>();
      const processedComments = new Set<string>();
      
      // Hàm delay với timeout protection
      const delay = (ms: number) => new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), ms);
        // Cleanup timeout nếu cần
        return timeout;
      });

      // Đảm bảo mỗi comment là duy nhất
      const uniqueCommentsArray = Array.from(new Set(uniqueComments));
      
      console.log(`Bắt đầu gửi ${uniqueCommentsArray.length} comment...`);

      for (let index = 0; index < uniqueCommentsArray.length; index++) {
        const comment = uniqueCommentsArray[index];

        try {
          // Thêm độ trễ 1-2 phút giữa các comment (trừ comment đầu tiên)
          if (index > 0) {
            const delayMinutes = Math.floor(Math.random() * 2) + 1; // 1-2 phút
            const delayMs = delayMinutes * 60000;
            console.log(`Chờ ${delayMinutes} phút trước khi gửi comment ${index + 1}/${uniqueCommentsArray.length}...`);
            
            toast({
              title: 'Đang chờ...',
              description: `Chờ ${delayMinutes} phút trước khi gửi comment tiếp theo (${index + 1}/${uniqueCommentsArray.length})`,
            });
            
            await delay(delayMs);
          }

          // Chọn user fake
          const availableUsers = fakeUsers.filter(user => !usedUserIds.has(user.id));
          if (availableUsers.length === 0) {
            usedUserIds.clear(); // Reset nếu hết user
          }

          const finalAvailableUsers = availableUsers.length > 0 ? availableUsers : fakeUsers;
          const randomUser = finalAvailableUsers[Math.floor(Math.random() * finalAvailableUsers.length)];

          if (!processedComments.has(comment)) {
            console.log(`[${index + 1}/${uniqueCommentsArray.length}] Đang gửi comment với user ${randomUser.name}...`);
            
            // Gửi comment với timeout
            const sendPromise = sendExternalCommentMutation.mutateAsync({
              externalId,
              fakeUserId: randomUser.id,
              comment
            });

            // Thêm timeout cho mỗi request (5 phút)
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Request timeout')), 5 * 60 * 1000);
            });

            await Promise.race([sendPromise, timeoutPromise]);

            // Đánh dấu thành công
            processedComments.add(comment);
            usedUserIds.add(randomUser.id);
            successCount++;

            console.log(`[${index + 1}/${uniqueCommentsArray.length}] Thành công với user ${randomUser.name}`);
            
            toast({
              title: 'Thành công',
              description: `Đã gửi comment ${index + 1}/${uniqueCommentsArray.length} với user ${randomUser.name}`,
            });
          }

        } catch (error) {
          failureCount++;
          console.error(`[${index + 1}/${uniqueCommentsArray.length}] Lỗi:`, error);
          
          toast({
            title: 'Lỗi gửi comment',
            description: `Comment ${index + 1}/${uniqueCommentsArray.length} thất bại: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`,
            variant: 'destructive'
          });
          
          // Không dừng toàn bộ process, tiếp tục với comment tiếp theo
          continue;
        }
      }

      // Thông báo kết quả cuối cùng
      const finalMessage = `Hoàn thành gửi comment: ${successCount} thành công, ${failureCount} thất bại trên tổng ${uniqueCommentsArray.length}`;
      console.log(finalMessage);
      
      toast({
        title: successCount > 0 ? 'Hoàn thành' : 'Có lỗi xảy ra',
        description: finalMessage,
        variant: successCount > 0 ? 'default' : 'destructive'
      });
    };

    // Khởi chạy worker ngầm với error handling
    sendCommentsInBackground().catch((error) => {
      console.error('Error in background comment sender:', error);
      toast({
        title: 'Lỗi hệ thống',
        description: 'Đã xảy ra lỗi trong quá trình gửi comment. Vui lòng thử lại.',
        variant: 'destructive'
      });
    });
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
                    ? "Hệ thống sẽ tự động chọn ngẫu nhiên một người dùng ảo khác nhau để gửi mỗi comment" 
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
              {extractedComments.length > 1 && (
                <p className="mt-1 text-xs italic">
                  Lưu ý: Khi gửi nhiều comment cùng lúc, hệ thống sẽ tự động thêm độ trễ 1 phút giữa các comment để tránh lỗi từ API bên ngoài.
                </p>
              )}
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