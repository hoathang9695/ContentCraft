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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
  const [selectedGender, setSelectedGender] = useState<'all' | 'male' | 'female' | 'other'>('all');

  // Fetch fake users
  const { data: allFakeUsers = [] } = useQuery<FakeUser[]>({
    queryKey: ['/api/fake-users'],
    enabled: open && !!externalId, // Only fetch when dialog is open and we have an externalId
  });

  // Filter fake users by selected gender
  const fakeUsers = selectedGender === 'all' 
    ? allFakeUsers 
    : allFakeUsers.filter(user => user.gender === selectedGender);

  // Hàm lấy ngẫu nhiên một người dùng ảo không trùng lặp trong cùng session
  const getRandomFakeUser = (usedUserIds: Set<number>): FakeUser | null => {
    if (fakeUsers.length === 0) return null;

    // Lọc ra những người dùng chưa được sử dụng trong session này
    const availableUsers = fakeUsers.filter(user => !usedUserIds.has(user.id));

    // Nếu đã sử dụng hết tất cả user, reset và bắt đầu lại
    if (availableUsers.length === 0) {
      console.log('Đã sử dụng hết tất cả user, bắt đầu chu kỳ mới...');
      usedUserIds.clear();
      const randomIndex = Math.floor(Math.random() * fakeUsers.length);
      const selectedUser = fakeUsers[randomIndex];
      usedUserIds.add(selectedUser.id);
      return selectedUser;
    }

    // Chọn ngẫu nhiên một người dùng từ danh sách chưa sử dụng
    const randomIndex = Math.floor(Math.random() * availableUsers.length);
    const selectedUser = availableUsers[randomIndex];
    usedUserIds.add(selectedUser.id);
    return selectedUser;
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
      setSelectedGender('all');
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
      const errorMessage = allFakeUsers.length === 0 
        ? 'Không tìm thấy người dùng ảo nào. Vui lòng tạo người dùng ảo trước.'
        : `Không có người dùng ảo nào với giới tính "${selectedGender === 'male' ? 'Nam' : selectedGender === 'female' ? 'Nữ' : 'Khác'}". Hãy chọn giới tính khác hoặc tạo thêm người dùng ảo.`;

      toast({
        title: 'Lỗi',
        description: errorMessage,
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

    // Tạo unique session ID cho việc track
    const sessionId = `comment_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queueKey = `comment_queue_${externalId}`;

    // Kiểm tra xem queue đã tồn tại hay chưa
    const existingQueueString = localStorage.getItem(queueKey);
    const existingQueue = existingQueueString ? JSON.parse(existingQueueString) : null;

    // Nếu có queue đang xử lý, cho phép thêm comment vào queue
    if (existingQueue && existingQueue.status === 'processing') {
      const progress = existingQueue.processedCount || 0;
      const total = existingQueue.totalComments || 0;
      const remaining = total - progress;

      // Thêm comment mới vào queue hiện tại
      const updatedComments = [...existingQueue.comments, ...uniqueComments];
      const updatedQueue = {
        ...existingQueue,
        comments: updatedComments,
        totalComments: updatedComments.length
      };

      try {
        localStorage.setItem(queueKey, JSON.stringify(updatedQueue));

        toast({
          title: 'Đã thêm comment vào queue',
          description: `Đã thêm ${uniqueComments.length} comment vào queue đang chạy. Queue hiện có ${updatedComments.length} comment (${progress} đã xử lý, còn ${updatedComments.length - progress} chưa xử lý).`,
        });

        // Đóng dialog và reset form
        onOpenChange(false);
        setCommentText('');

        // ✅ QUAN TRỌNG: Không return ở đây, để worker tiếp tục chạy với data mới
        console.log(`[${existingQueue.sessionId}] Đã thêm ${uniqueComments.length} comment mới vào queue. Worker sẽ tiếp tục xử lý...`);

        // Worker sẽ tự động nhận diện comment mới khi load từ localStorage trong vòng lặp
        return;
      } catch (error) {
        console.warn('Không thể cập nhật queue:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể thêm comment vào queue đang chạy. Vui lòng thử lại.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Lưu queue vào localStorage để persist
    const commentQueue = {
      sessionId,
      externalId,
      comments: uniqueComments,
      totalComments: uniqueComments.length,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      startTime: Date.now(),
      status: 'processing' as 'processing' | 'completed' | 'failed'
    };

    try {
      localStorage.setItem(queueKey, JSON.stringify(commentQueue));
    } catch (error) {
      console.warn('Không thể lưu queue vào localStorage:', error);
    }

    // Hiển thị thông báo bắt đầu
    toast({
      title: 'Bắt đầu gửi comment',
      description: `Sẽ gửi ${uniqueComments.length} comment. Quá trình này có thể mất vài phút...`,
    });

    // Tối ưu worker với batch processing và recovery
    const sendCommentsInBackground = async () => {
      let currentQueue = commentQueue;
      const maxRetries = 3;
      const baseDelay = 2; // 2 phút base delay
      const maxDelay = 5; // 5 phút max delay

      // Track used users for this session to prevent duplicates
      const usedUserIds = new Set<number>();

      // Recovery function để load từ localStorage
      const loadQueueFromStorage = (): typeof commentQueue | null => {
        try {
          const stored = localStorage.getItem(queueKey);
          return stored ? JSON.parse(stored) : null;
        } catch {
          return null;
        }
      };

      // Update queue function
      const updateQueue = (updates: Partial<typeof commentQueue>) => {
        currentQueue = { ...currentQueue, ...updates };
        try {
          localStorage.setItem(queueKey, JSON.stringify(currentQueue));
        } catch (error) {
          console.warn('Không thể cập nhật queue:', error);
        }
      };

      // Adaptive delay function
      const getAdaptiveDelay = (attemptNumber: number, isRetry: boolean = false): number => {
        const baseMs = baseDelay * 60000; // Convert to milliseconds
        const maxMs = maxDelay * 60000;

        if (isRetry) {
          // Exponential backoff cho retry
          return Math.min(baseMs * Math.pow(2, attemptNumber), maxMs);
        }

        // Random delay giữa baseDelay và maxDelay
        const randomFactor = 0.5 + Math.random(); // 0.5 - 1.5
        return Math.min(baseMs * randomFactor, maxMs);
      };

      // Enhanced delay function với heartbeat
      const enhancedDelay = async (ms: number, index: number) => {
        const start = Date.now();
        const heartbeatInterval = 30000; // 30 giây heartbeat

        return new Promise<void>((resolve) => {
          const heartbeat = setInterval(() => {
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, ms - elapsed);

            if (remaining <= 0) {
              clearInterval(heartbeat);
              resolve();
            } else {
              console.log(`[${index}] Còn ${Math.ceil(remaining / 60000)} phút nữa...`);
            }
          }, heartbeatInterval);

          setTimeout(() => {
            clearInterval(heartbeat);
            resolve();
          }, ms);
        });
      };

      console.log(`[${sessionId}] Bắt đầu gửi ${currentQueue.totalComments} comment...`);

      // Process comments with enhanced error handling
      for (let index = currentQueue.processedCount; index < currentQueue.comments.length; index++) {
        const comment = currentQueue.comments[index];
        let success = false;
        let retryCount = 0;

        // Recovery check
        const recoveredQueue = loadQueueFromStorage();
        if (recoveredQueue && recoveredQueue.sessionId === sessionId) {
          currentQueue = recoveredQueue;
          if (index < currentQueue.processedCount) {
            console.log(`[${sessionId}] Skipping processed comment ${index + 1}`);
            continue;
          }
        }

        // Delay cho comment không phải đầu tiên
        if (index > 0) {
          const delayMs = getAdaptiveDelay(index);
          const delayMinutes = Math.ceil(delayMs / 60000);

          console.log(`[${sessionId}] Chờ ${delayMinutes} phút trước comment ${index + 1}/${currentQueue.totalComments}...`);

          toast({
            title: 'Đang chờ...',
            description: `Chờ ${delayMinutes} phút trước comment ${index + 1}/${currentQueue.totalComments}`,
          });

          await enhancedDelay(delayMs, index + 1);
        }

        // Retry loop cho mỗi comment
        while (!success && retryCount < maxRetries) {
          try {
            // Chọn một người dùng ảo không trùng lặp trong session này
            const randomUser = getRandomFakeUser(usedUserIds);

            if (!randomUser) {
              throw new Error('Không có người dùng ảo nào khả dụng');
            }

            console.log(`[${sessionId}][${index + 1}/${currentQueue.totalComments}] Gửi comment (thử lần ${retryCount + 1}) với user ${randomUser.name} (ID: ${randomUser.id})...`);

            // Gửi comment với enhanced timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8 * 60 * 1000); // 8 phút timeout

            try {
              await sendExternalCommentMutation.mutateAsync({
                externalId,
                fakeUserId: randomUser.id,
                comment
              });

              clearTimeout(timeoutId);
              success = true;

              // Update success
              updateQueue({
                processedCount: index + 1,
                successCount: currentQueue.successCount + 1
              });

              console.log(`[${sessionId}][${index + 1}/${currentQueue.totalComments}] Thành công với user ${randomUser.name} (ID: ${randomUser.id}). Đã sử dụng ${usedUserIds.size}/${fakeUsers.length} user.`);

              toast({
                title: 'Thành công',
                description: `Comment ${index + 1}/${currentQueue.totalComments} đã gửi thành công bởi ${randomUser.name}`,
              });

            } catch (apiError) {
              clearTimeout(timeoutId);
              throw apiError;
            }

          } catch (error) {
            retryCount++;
            const isTimeout = error instanceof Error && error.message.includes('timeout');
            const isAbort = error instanceof Error && error.name === 'AbortError';

            console.error(`[${sessionId}][${index + 1}] Lỗi lần thử ${retryCount}:`, error);

            if (retryCount < maxRetries) {
              const retryDelayMs = getAdaptiveDelay(retryCount, true);
              const retryDelayMinutes = Math.ceil(retryDelayMs / 60000);

              console.log(`[${sessionId}] Sẽ thử lại sau ${retryDelayMinutes} phút...`);

              toast({
                title: 'Đang thử lại...',
                description: `Comment ${index + 1} thất bại, thử lại sau ${retryDelayMinutes} phút (lần ${retryCount}/${maxRetries})`,
                variant: 'destructive'
              });

              await enhancedDelay(retryDelayMs, index + 1);
            } else {
              // Max retries reached - remove user from used set since comment failed
              if (randomUser) {
                usedUserIds.delete(randomUser.id);
                console.log(`[${sessionId}] Đã xóa user ${randomUser.name} (ID: ${randomUser.id}) khỏi danh sách đã sử dụng do comment thất bại`);
              }

              updateQueue({
                processedCount: index + 1,
                failureCount: currentQueue.failureCount + 1
              });

              toast({
                title: 'Comment thất bại',
                description: `Comment ${index + 1}/${currentQueue.totalComments} thất bại sau ${maxRetries} lần thử`,
                variant: 'destructive'
              });
            }
          }
        }
      }

      // Final completion
      updateQueue({
        status: 'completed'
      });

      const finalMessage = `Hoàn thành: ${currentQueue.successCount} thành công, ${currentQueue.failureCount} thất bại trên tổng ${currentQueue.totalComments}. Đã sử dụng ${usedUserIds.size}/${fakeUsers.length} user khác nhau.`;
      console.log(`[${sessionId}] ${finalMessage}`);

      toast({
        title: currentQueue.successCount > 0 ? 'Hoàn thành' : 'Có lỗi xảy ra',
        description: `${currentQueue.successCount} thành công, ${currentQueue.failureCount} thất bại. Sử dụng ${usedUserIds.size} user khác nhau.`,
        variant: currentQueue.successCount > 0 ? 'default' : 'destructive'
      });

      // Cleanup localStorage after completion
      try {
        localStorage.removeItem(queueKey);
      } catch (error) {
        console.warn('Không thể xóa queue khỏi localStorage:', error);
      }
    };

    // Khởi chạy worker với global error handling
    sendCommentsInBackground().catch((error) => {
      console.error(`[${sessionId}] Critical error in background sender:`, error);

      // Update queue status
      try {
        const currentQueue = JSON.parse(localStorage.getItem(queueKey) || '{}');
        currentQueue.status = 'failed';
        localStorage.setItem(queueKey, JSON.stringify(currentQueue));
      } catch (e) {
        console.warn('Không thể cập nhật trạng thái lỗi:', e);
      }

      toast({
        title: 'Lỗi hệ thống',
        description: 'Đã xảy ra lỗi nghiêm trọng. Vui lòng kiểm tra console và thử lại.',
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
            <div className="flex flex-col space-y-3">
              {/* Gender selection */}
              <div className="space-y-2">
                <Label htmlFor="gender-select" className="text-sm font-medium">
                  Lọc theo giới tính người dùng ảo
                </Label>
                <Select value={selectedGender} onValueChange={(value: 'all' | 'male' | 'female' | 'other') => setSelectedGender(value)}>
                  <SelectTrigger id="gender-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả giới tính</SelectItem>
                    <SelectItem value="male">Nam</SelectItem>
                    <SelectItem value="female">Nữ</SelectItem>
                    <SelectItem value="other">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm">
                <p className="font-medium">Thông tin người dùng ảo</p>
                <p className="mt-1">
                  {fakeUsers.length > 0 
                    ? "Hệ thống sẽ tự động chọn ngẫu nhiên một người dùng ảo khác nhau để gửi mỗi comment" 
                    : selectedGender === 'all' 
                      ? "Không có người dùng ảo nào. Vui lòng tạo người dùng ảo trong phần quản lý."
                      : `Không có người dùng ảo nào với giới tính "${selectedGender === 'male' ? 'Nam' : selectedGender === 'female' ? 'Nữ' : 'Khác'}". Hãy thử chọn giới tính khác hoặc tạo thêm người dùng ảo.`}
                </p>
                {fakeUsers.length > 0 && (
                  <p className="mt-1 text-xs">
                    {selectedGender === 'all' 
                      ? `Có tổng cộng ${fakeUsers.length} người dùng ảo có thể sử dụng để gửi comment`
                      : `Có ${fakeUsers.length} người dùng ảo ${selectedGender === 'male' ? 'nam' : selectedGender === 'female' ? 'nữ' : 'giới tính khác'} có thể sử dụng để gửi comment`}
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