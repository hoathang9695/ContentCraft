import { useState, useEffect } from 'react';
import { Content } from '@shared/schema';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';

const CATEGORIES = [
  'News',
  'Technology',
  'Life Style',
  'Health',
  'Sports',
  'Education',
  'Finance',
  'Gaming',
  'Travel',
  'Food',
  'Business'
];

const LABELS = [
  'AI',
  'Cybersecurity',
  'Blockchain',
  'Startups',
  'Gadgets'
];

interface UpdateContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: number | null;
}

export function UpdateContentDialog({ open, onOpenChange, contentId }: UpdateContentDialogProps) {
  const { toast } = useToast();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [isSafe, setIsSafe] = useState<boolean | null>(null);
  
  // Fetch content data
  const { data: content, isLoading } = useQuery<any>({
    queryKey: [contentId ? `/api/contents/${contentId}` : 'empty'],
    enabled: !!contentId && open,
    queryFn: async () => {
      if (!contentId) return {};
      return await apiRequest('GET', `/api/contents/${contentId}`);
    }
  });
  
  // Update form state when content data changes
  useEffect(() => {
    if (content) {
      setSelectedCategories(content.categories ? content.categories.split(',').map((c: string) => c.trim()) : []);
      setSelectedLabels(content.labels ? content.labels.split(',').map((l: string) => l.trim()) : []);
      setIsSafe(content.safe as boolean | null);
    }
  }, [content]);
  
  // Update content mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number, categories: string, labels: string, safe: boolean | null }) => {
      // 1. Update content in our database
      const updatedContent = await apiRequest('PATCH', `/api/contents/${data.id}`, {
        categories: data.categories,
        labels: data.labels,
        safe: data.safe
      });
      
      // 2. Send to Gorse service via Kafka
      await apiRequest('POST', '/api/kafka/send', {
        itemId: updatedContent.externalId,
        categories: data.categories,
        labels: data.labels,
        safe: data.safe
      });
      
      return updatedContent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents', contentId] });
      
      toast({
        title: 'Cập nhật thành công',
        description: 'Thông tin nội dung đã được cập nhật và đồng bộ với Gorse.',
      });
      
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Lỗi khi cập nhật nội dung',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories(prev => [...prev, category]);
    } else {
      setSelectedCategories(prev => prev.filter(c => c !== category));
    }
  };
  
  const handleLabelChange = (label: string, checked: boolean) => {
    if (checked) {
      setSelectedLabels(prev => [...prev, label]);
    } else {
      setSelectedLabels(prev => prev.filter(l => l !== label));
    }
  };
  
  const handleSubmit = () => {
    if (!contentId) return;
    
    updateMutation.mutate({
      id: contentId,
      categories: selectedCategories.join(', '),
      labels: selectedLabels.join(', '),
      safe: isSafe
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cập nhật thông tin</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center p-4">
            Đang tải thông tin...
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {/* Categories */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Categories</h3>
              <div className="space-y-2">
                {CATEGORIES.map(category => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`category-${category}`} 
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={(checked) => handleCategoryChange(category, checked === true)}
                    />
                    <Label htmlFor={`category-${category}`}>{category}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Labels */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Label</h3>
              <div className="space-y-2">
                {LABELS.map(label => (
                  <div key={label} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`label-${label}`} 
                      checked={selectedLabels.includes(label)}
                      onCheckedChange={(checked) => handleLabelChange(label, checked === true)}
                    />
                    <Label htmlFor={`label-${label}`}>{label}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Safety Status */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Hành động</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="safe-yes" 
                    checked={isSafe === true}
                    onCheckedChange={(checked) => setIsSafe(checked === true ? true : null)}
                  />
                  <Label htmlFor="safe-yes">An toàn</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="safe-no" 
                    checked={isSafe === false}
                    onCheckedChange={(checked) => setIsSafe(checked === true ? false : null)}
                  />
                  <Label htmlFor="safe-no">Không an toàn</Label>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || updateMutation.isPending || isSafe === null}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {updateMutation.isPending 
              ? 'Đang lưu...' 
              : isSafe === null 
                ? 'Hãy chọn trạng thái an toàn' 
                : 'Lưu'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}