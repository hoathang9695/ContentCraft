import { useState, useEffect, useRef } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

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
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Handle emoji click
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentText = commentText;
      const newText = currentText.substring(0, start) + emojiData.emoji + currentText.substring(end);

      setCommentText(newText);
      setShowEmojiPicker(false);

      // Focus back to textarea and set cursor position after emoji
      setTimeout(() => {
        textarea.focus();
        const newCursorPosition = start + emojiData.emoji.length;
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    }
  };

  // Reset form khi đóng dialog
  useEffect(() => {
    if (!open) {
      setCommentText('');
      setSelectedGender('all');
      setShowEmojiPicker(false);
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

    // Cập nhật số lượng comment trong DB nội bộ nếu không có externalId
    if (!externalId) {
      commentMutation.mutate({ id: contentId, count: uniqueComments.length });
      onOpenChange(false);
      setCommentText('');
      return;
    }

    // Kiểm tra nếu không có người dùng ảo nào khi có externalId
    if (fakeUsers.length === 0) {
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

    try {
      console.log('Creating comment queue for externalId:', externalId);
      console.log('Request payload:', {
        externalId,
        comments: uniqueComments,
        selectedGender
      });

      // Gửi queue đến backend API
      const response = await apiRequest('POST', '/api/comment-queues', {
        externalId,
        comments: uniqueComments,
        selectedGender
      });

      console.log('Queue creation response:', response);

      if (response && response.success) {
        toast({
          title: 'Queue đã được tạo',
          description: `${response.message}. Hệ thống sẽ xử lý tự động trong nền.`,
        });

        // Đóng dialog sau khi thành công
        onOpenChange(false);
        setCommentText('');
      } else {
        const errorMsg = response?.message || 'Failed to create queue - Invalid response format';
        console.error('Invalid response format:', response);
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error('Full error details:', error);
      console.error('Error type:', typeof error);
      console.error('Error creating comment queue:', error);
      
      let errorMessage = 'Không thể tạo queue comment';
      
      if (error instanceof Error) {
        if (error.message.includes('DOCTYPE') || error.message.includes('HTML')) {
          errorMessage = 'Server đang gặp lỗi nội bộ. Vui lòng thử lại sau.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Không thể kết nối tới server. Vui lòng kiểm tra kết nối mạng.';
        } else if (error.message.includes('Invalid response')) {
          errorMessage = 'Server trả về dữ liệu không hợp lệ. Vui lòng thử lại.';
        } else {
          errorMessage = error.message;
        }
      } else if (typeof error === 'object' && error !== null) {
        // Handle case where error is an object but not Error instance
        console.error('Non-Error object caught:', JSON.stringify(error));
        errorMessage = 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
      }
      
      toast({
        title: 'Lỗi tạo queue',
        description: errorMessage,
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
                      : `Không có người dùng ảo nào với giới tính "${selectedGender === 'male' ? 'Nam' : selectedGender === 'female' ? 'Nữ' : 'Khác'}". Hãy chọn giới tính khác hoặc tạo thêm người dùng ảo.`}
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

          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Nhập nội dung comment hoặc nhiều comment cách nhau bởi dấu ngoặc nhọn {comment1} {comment2}"
              className="min-h-[200px] pr-12"
            />
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-gray-100"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  😀
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width={350}
                  height={400}
                  searchDisabled={false}
                  skinTonesDisabled={false}
                  previewConfig={{
                    defaultCaption: "Chọn emoji để thêm vào comment",
                    defaultEmoji: "1f60a"
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

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