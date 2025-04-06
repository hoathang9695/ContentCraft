import { useState, useEffect } from 'react';
import { Content, Category, Label as LabelType } from '@shared/schema';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';

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
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  
  // Fetch content data
  const { data: content, isLoading: contentLoading } = useQuery<any>({
    queryKey: [contentId ? `/api/contents/${contentId}` : 'empty'],
    enabled: !!contentId && open,
    queryFn: async () => {
      if (!contentId) return {};
      return await apiRequest('GET', `/api/contents/${contentId}`);
    }
  });
  
  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    enabled: open,
    queryFn: async () => {
      return await apiRequest('GET', '/api/categories');
    }
  });
  
  // Fetch all labels
  const { data: allLabels, isLoading: allLabelsLoading } = useQuery<LabelType[]>({
    queryKey: ['/api/labels'],
    enabled: open,
    queryFn: async () => {
      return await apiRequest('GET', '/api/labels');
    }
  });
  
  // Fetch labels for the active category
  const { data: categoryLabels, isLoading: categoryLabelsLoading } = useQuery<LabelType[]>({
    queryKey: [activeCategory ? `/api/categories/${activeCategory}/labels` : 'no-category'],
    enabled: open && activeCategory !== null,
    queryFn: async () => {
      if (!activeCategory) return [];
      return await apiRequest('GET', `/api/categories/${activeCategory}/labels`);
    }
  });
  
  // Khi mở dialog và chọn một category, tự động cập nhật activeCategory
  useEffect(() => {
    if (open && categories && categories.length > 0) {
      const firstCategory = selectedCategories.length > 0 
        ? categories.find(c => selectedCategories.includes(c.name))
        : null;
      
      if (firstCategory) {
        setActiveCategory(firstCategory.id);
      } else if (categories.length > 0) {
        setActiveCategory(categories[0].id);
      }
    }
  }, [open, categories, selectedCategories]);

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
  
  // Kiểm tra trạng thái loading
  const isLoading = contentLoading || categoriesLoading || allLabelsLoading;
  
  // Tạo hàm xử lý sự kiện khi click vào category để lọc labels
  const handleCategoryClick = (categoryId: number) => {
    setActiveCategory(categoryId);
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
                {categories && categories.map((category) => (
                  <div 
                    key={category.id} 
                    className="flex items-center space-x-2"
                    onClick={() => handleCategoryClick(category.id)}
                  >
                    <Checkbox 
                      id={`category-${category.id}`} 
                      checked={selectedCategories.includes(category.name)}
                      onCheckedChange={(checked) => handleCategoryChange(category.name, checked === true)}
                    />
                    <Label 
                      htmlFor={`category-${category.id}`}
                      className={activeCategory === category.id ? "font-bold text-primary" : ""}
                    >
                      {category.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Labels */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Label</h3>
              <div className="space-y-2">
                {activeCategory && (
                  <div className="text-sm text-muted-foreground mb-2">
                    {categories?.find(c => c.id === activeCategory)?.name || 'Vui lòng chọn danh mục'}
                  </div>
                )}
                
                {/* Labels from selected category */}
                {!categoryLabelsLoading && categoryLabels && categoryLabels.map((label) => (
                  <div key={label.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`label-${label.id}`} 
                      checked={selectedLabels.includes(label.name)}
                      onCheckedChange={(checked) => handleLabelChange(label.name, checked === true)}
                    />
                    <Label htmlFor={`label-${label.id}`}>{label.name}</Label>
                  </div>
                ))}
                
                {/* Show "No labels" if the category has no labels */}
                {!categoryLabelsLoading && (!categoryLabels || categoryLabels.length === 0) && (
                  <div className="text-sm text-muted-foreground">
                    Không có nhãn nào cho danh mục này
                  </div>
                )}
                
                {/* Loading state for category labels */}
                {categoryLabelsLoading && (
                  <div className="text-sm text-muted-foreground">
                    Đang tải nhãn...
                  </div>
                )}
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