
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface TrendItem {
  id: number;
  title: string;
  content: string;
  targetAudience: string;
  status: string;
  createdBy: number;
  sentAt?: string;
  recipientCount?: number;
  createdAt: string;
  updatedAt: string;
  redis_id?: string;
  redis_s?: string;
  redis_a?: string;
  redis_g?: string;
  redis_k?: string;
  redis_l?: string;
  redis_r?: string;
  ttl?: number;
}

interface EditTrendDialogProps {
  open: boolean;
  trend: TrendItem | null;
  onClose: (updatedTrend?: TrendItem) => void;
}

export function EditTrendDialog({ open, trend, onClose }: EditTrendDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    id: '',
    s: '',
    a: '',
    g: '',
    k: '',
    l: '',
    r: '',
    title: '',
    content: '',
    targetAudience: 'all',
    status: 'draft',
    ttl: 3600
  });

  // Load trend data into form when dialog opens
  useEffect(() => {
    if (trend && open) {
      setFormData({
        id: trend.redis_id || '',
        s: trend.redis_s || '',
        a: trend.redis_a || '',
        g: trend.redis_g || '',
        k: trend.redis_k || '',
        l: trend.redis_l || '',
        r: trend.redis_r || '',
        title: trend.title,
        content: trend.content,
        targetAudience: trend.targetAudience,
        status: trend.status,
        ttl: trend.ttl || 3600
      });
    }
  }, [trend, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!trend) return;

    const trendData = {
      title: formData.title,
      content: formData.content,
      target_audience: formData.targetAudience,
      status: formData.status,
      redis_id: formData.id,
      redis_s: formData.s,
      redis_a: formData.a,
      redis_g: formData.g,
      redis_k: formData.k,
      redis_l: formData.l,
      redis_r: formData.r,
      ttl: formData.ttl
    };

    console.log('Updating trend:', trend.id, trendData);

    try {
      const response = await fetch(`/api/trends/${trend.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(trendData),
      });

      console.log('Update trend response status:', response.status);
      console.log('Update trend response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Update trend error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText.substring(0, 100)}`);
      }

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('Non-JSON response received:', responseText.substring(0, 200));
        throw new Error('Server returned non-JSON response');
      }

      const updatedTrend = await response.json();
      console.log('Trend updated:', updatedTrend);

      // Show success toast
      toast({
        title: "Thành công",
        description: "Cập nhật trend thành công",
      });

      // Close dialog and pass updated trend data
      onClose({
        ...updatedTrend,
        targetAudience: updatedTrend.target_audience // Map back to interface format
      });
    } catch (error) {
      console.error('❌ Error updating trend:', error);
      
      let errorMessage = "Có lỗi xảy ra khi cập nhật trend";
      if (error instanceof SyntaxError && error.message.includes('Unexpected token')) {
        errorMessage = "Server đang gặp vấn đề. Vui lòng thử lại sau.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Lỗi",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Chỉnh Sửa Trend
          </DialogTitle>
          <DialogDescription>
            Cập nhật thông tin trend và Redis data
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Redis Fields Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Redis Data Fields
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="redis-id">ID</Label>
                <Input
                  id="redis-id"
                  value={formData.id}
                  onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="Nhập Redis ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="redis-s">S (Source)</Label>
                <Input
                  id="redis-s"
                  value={formData.s}
                  onChange={(e) => setFormData(prev => ({ ...prev, s: e.target.value }))}
                  placeholder="Nhập Redis S"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="redis-a">A</Label>
                <Input
                  id="redis-a"
                  value={formData.a}
                  onChange={(e) => setFormData(prev => ({ ...prev, a: e.target.value }))}
                  placeholder="Nhập Redis A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="redis-g">G</Label>
                <Input
                  id="redis-g"
                  value={formData.g}
                  onChange={(e) => setFormData(prev => ({ ...prev, g: e.target.value }))}
                  placeholder="Nhập Redis G"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="redis-k">K</Label>
                <Input
                  id="redis-k"
                  value={formData.k}
                  onChange={(e) => setFormData(prev => ({ ...prev, k: e.target.value }))}
                  placeholder="Nhập Redis K"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="redis-l">L</Label>
                <Input
                  id="redis-l"
                  value={formData.l}
                  onChange={(e) => setFormData(prev => ({ ...prev, l: e.target.value }))}
                  placeholder="Nhập Redis L"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="redis-r">R</Label>
                <Input
                  id="redis-r"
                  value={formData.r}
                  onChange={(e) => setFormData(prev => ({ ...prev, r: e.target.value }))}
                  placeholder="Nhập Redis R"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="redis-ttl">TTL (giây)</Label>
                <Input
                  id="redis-ttl"
                  type="number"
                  value={formData.ttl}
                  onChange={(e) => setFormData(prev => ({ ...prev, ttl: parseInt(e.target.value) || 3600 }))}
                  placeholder="3600"
                  min="1"
                />
                <div className="text-xs text-muted-foreground">
                  Thời gian tồn tại trong Redis (mặc định: 3600 giây = 1 giờ)
                </div>
              </div>
            </div>
          </div>

          {/* Trend Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Thông Tin Trend
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Tiêu đề trend *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Nhập tiêu đề trend"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Nội dung trend *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Nhập nội dung trend"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="target-audience">Đối tượng mục tiêu</Label>
                  <Select 
                    value={formData.targetAudience} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, targetAudience: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn đối tượng" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="new">Mới</SelectItem>
                      <SelectItem value="potential">Tiềm năng</SelectItem>
                      <SelectItem value="positive">Tích cực</SelectItem>
                      <SelectItem value="non_potential">Không tiềm năng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Trạng thái</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Nháp</SelectItem>
                      <SelectItem value="approved">Đã duyệt</SelectItem>
                      <SelectItem value="active">Đang hoạt động</SelectItem>
                      <SelectItem value="completed">Hoàn thành</SelectItem>
                      <SelectItem value="cancelled">Đã hủy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
            >
              Hủy
            </Button>
            <Button 
              type="submit"
              className="flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Lưu Thay Đổi
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
