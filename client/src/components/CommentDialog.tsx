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
import { Maximize2, Minimize2, X } from 'lucide-react';

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
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
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
  const handleEmojiClick = (emojiData: EmojiClickData, event?: any) => {
    // Prevent event from bubbling up and closing the popover
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentText = commentText;
      const newText = currentText.substring(0, start) + emojiData.emoji + currentText.substring(end);

      setCommentText(newText);
      // Keep popup open by not calling setShowEmojiPicker(false)

      // Don't focus back to textarea to prevent popup from closing
      // Just update cursor position without focusing
      setTimeout(() => {
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
      setIsExpanded(true); // Reset về default khi đóng
    }
  }, [open]);

  

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
      console.log('🚀 Creating comment queue for externalId:', externalId);
      console.log('🚀 Request payload:', {
        externalId,
        comments: uniqueComments,
        selectedGender
      });

      // Gửi queue đến backend API - apiRequest đã trả về parsed JSON
      const responseData = await apiRequest('POST', '/api/comment-queues', {
        externalId,
        comments: uniqueComments,
        selectedGender
      });

      console.log('✅ Full API Response:', responseData);
      console.log('✅ Response type:', typeof responseData);
      console.log('✅ Response success field:', responseData?.success);

      // Check if response is valid and has success field
      if (responseData && typeof responseData === 'object' && responseData.success === true) {
        toast({
          title: "Thành công",
          description: `${responseData.message || 'Đã tạo queue thành công'}. Hệ thống sẽ xử lý tự động trong nền.`,
        });

        // Đóng dialog sau khi thành công
        onOpenChange(false);
        setCommentText('');

      } else {
        console.error('❌ Error in comment queue creation:', responseData);
        
        const errorMessage = responseData?.message || responseData?.error || 'Không thể tạo queue comment';
        
        toast({
          title: "Lỗi tạo queue",
          description: errorMessage,
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Error in comment queue creation:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack'
      });

      let errorMessage = 'Không thể tạo queue comment';

      if (error instanceof Error) {
        console.log('Error message content:', error.message);
        
        if (error.message.includes('DOCTYPE') || error.message.includes('HTML')) {
          errorMessage = 'Server đang gặp lỗi nội bộ. Vui lòng thử lại sau.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Không thể kết nối tới server. Vui lòng kiểm tra kết nối mạng.';
        } else if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
          errorMessage = 'Server trả về dữ liệu không hợp lệ. Vui lòng thử lại sau.';
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Lỗi tạo queue",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`comment-dialog dialog-content ${isExpanded ? 'max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] m-0' : 'sm:max-w-[800px] max-h-[80vh] w-[90vw]'} overflow-hidden flex flex-col`}>
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle>Comment</DialogTitle>
              <DialogDescription>Cách nhau bởi dấu {'{}'}</DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8"
                title={isExpanded ? "Thu nhỏ" : "Mở rộng"}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
            <Popover 
              open={showEmojiPicker} 
              onOpenChange={(open) => {
                // Only allow closing if explicitly requested (clicking outside or escape)
                setShowEmojiPicker(open);
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-gray-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowEmojiPicker(!showEmojiPicker);
                  }}
                >
                  😀
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0" 
                align="end"
                onInteractOutside={(e) => {
                  // Prevent closing when clicking inside the emoji picker
                  const target = e.target as Element;
                  if (target.closest('.epr-emoji-category, .epr-emoji-container, .epr-search, .epr-skin-tones')) {
                    e.preventDefault();
                  }
                }}
              >
                <EmojiPicker
                  onEmojiClick={(emojiData, event) => {
                    handleEmojiClick(emojiData, event);
                  }}
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
              (externalId && fakeUsers.length === 0) ||
              extractedComments.length === 0
            }
          >
            {commentMutation.isPending ? "Đang gửi..." : "Gửi"}
          </Button>
        </DialogFooter>
        
        <style>{`
          /* Hide default dialog close button only for CommentDialog */
          .comment-dialog .dialog-content > button[data-radix-dialog-close],
          .comment-dialog [data-radix-dialog-content] > button[data-radix-dialog-close],
          .comment-dialog button[data-radix-dialog-close],
          .comment-dialog [data-radix-dialog-content] button[class*="absolute"][class*="right-4"][class*="top-4"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            left: -9999px !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
          }

          /* Additional specific selector for the exact button structure */
          .dialog-content button.absolute.right-4.top-4 {
            display: none !important;
          }

          /* Ensure scrollable areas work properly */
          .comment-dialog .dialog-content {
            display: flex;
            flex-direction: column;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}