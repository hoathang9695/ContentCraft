
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateTrendDialogProps {
  open: boolean;
  onClose: (newTrend?: any) => void;
}

export function CreateTrendDialog({ open, onClose }: CreateTrendDialogProps) {
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
    status: 'draft'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trendData = {
      ...formData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 1 // Mock user ID
    };

    console.log('Creating trend:', trendData);

    try {
      // TODO: Implement API call to create trend and push to Redis
      
      // Mock success response
      const newTrend = {
        id: Date.now(),
        ...trendData
      };

      // Reset form
      setFormData({
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
        status: 'draft'
      });

      // Show success toast
      toast({
        title: "Thành công",
        description: "Tạo trend mới thành công",
      });

      // Close dialog and pass new trend data
      onClose(newTrend);
    } catch (error) {
      console.error('❌ Error creating trend:', error);
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi tạo trend",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tạo Trend Mới
          </DialogTitle>
          <DialogDescription>
            Điền thông tin để tạo trend mới và đẩy vào Redis
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
                <Label htmlFor="id">ID</Label>
                <Input
                  id="id"
                  value={formData.id}
                  onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="114940014683442369"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="s">S (Source)</Label>
                <Input
                  id="s"
                  value={formData.s}
                  onChange={(e) => setFormData(prev => ({ ...prev, s: e.target.value }))}
                  placeholder="114940014683442369"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="a">A</Label>
                <Input
                  id="a"
                  value={formData.a}
                  onChange={(e) => setFormData(prev => ({ ...prev, a: e.target.value }))}
                  placeholder="1082771594182555502"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="g">G</Label>
                <Input
                  id="g"
                  value={formData.g}
                  onChange={(e) => setFormData(prev => ({ ...prev, g: e.target.value }))}
                  placeholder=""
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="k">K</Label>
                <Input
                  id="k"
                  value={formData.k}
                  onChange={(e) => setFormData(prev => ({ ...prev, k: e.target.value }))}
                  placeholder="gorse"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="l">L</Label>
                <Input
                  id="l"
                  value={formData.l}
                  onChange={(e) => setFormData(prev => ({ ...prev, l: e.target.value }))}
                  placeholder=""
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="r">R</Label>
                <Input
                  id="r"
                  value={formData.r}
                  onChange={(e) => setFormData(prev => ({ ...prev, r: e.target.value }))}
                  placeholder="1753846150"
                />
              </div>
            </div>
          </div>

          {/* Trend Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Thông Tin Trend
            </h3>

            <div className="space-y-2">
              <Label htmlFor="title">Tiêu đề trend</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Nhập tiêu đề trend..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Nội dung trend</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Nhập nội dung trend..."
                rows={4}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Đối tượng mục tiêu</Label>
                <Select
                  value={formData.targetAudience}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, targetAudience: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <Label>Trạng thái</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Nháp</SelectItem>
                    <SelectItem value="approved">Đã duyệt</SelectItem>
                    <SelectItem value="active">Đang hoạt động</SelectItem>
                    <SelectItem value="completed">Hoàn thành</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Tạo Trend
            </Button>
            <Button type="button" variant="outline" onClick={() => {
              // Reset form
              setFormData({
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
                status: 'draft'
              });
              onClose();
            }}>
              <X className="h-4 w-4 mr-2" />
              Hủy
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
