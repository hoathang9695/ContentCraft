import { useState, useEffect, useMemo } from 'react';
import { Content, Category, Label as LabelType } from '@shared/schema';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<string>("all");
  
  // Prefetch all categories and labels when dialog opens to have them ready
  useEffect(() => {
    if (open) {
      // Prefetch categories
      queryClient.prefetchQuery({
        queryKey: ['/api/categories'],
        queryFn: async () => await apiRequest('GET', '/api/categories')
      });
      
      // Prefetch all labels
      queryClient.prefetchQuery({
        queryKey: ['/api/labels'],
        queryFn: async () => await apiRequest('GET', '/api/labels')
      });
    }
  }, [open]);
  
  // Fetch content data with lower priority (staleTime)
  const { data: content, isLoading: contentLoading } = useQuery<any>({
    queryKey: [contentId ? `/api/contents/${contentId}` : 'empty'],
    enabled: !!contentId && open,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      if (!contentId) return {};
      return await apiRequest('GET', `/api/contents/${contentId}`);
    }
  });
  
  // Fetch categories with caching
  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    enabled: open,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    queryFn: async () => {
      return await apiRequest('GET', '/api/categories');
    }
  });
  
  // Fetch all labels with caching
  const { data: allLabels, isLoading: allLabelsLoading } = useQuery<LabelType[]>({
    queryKey: ['/api/labels'],
    enabled: open,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    queryFn: async () => {
      return await apiRequest('GET', '/api/labels');
    }
  });
  
  // Create a map of category ID to labels for fast access
  const categoryLabelsMap = useMemo(() => {
    if (!allLabels) return new Map<number, LabelType[]>();
    
    const map = new Map<number, LabelType[]>();
    allLabels.forEach(label => {
      if (!map.has(label.categoryId)) {
        map.set(label.categoryId, []);
      }
      map.get(label.categoryId)?.push(label);
    });
    
    return map;
  }, [allLabels]);
  
  // Filter labels based on selected categories
  const relevantLabels = useMemo(() => {
    if (!categories || !allLabels) return [];
    
    // No categories selected - show all labels
    if (selectedCategories.length === 0) return allLabels;
    
    if (activeTab === "all") {
      // Show all labels
      return allLabels;
    } else {
      // Filter labels for the selected categories only
      const selectedCategoryIds = categories
        .filter(c => selectedCategories.includes(c.name))
        .map(c => c.id);
      
      return allLabels.filter(label => selectedCategoryIds.includes(label.categoryId));
    }
  }, [allLabels, categories, selectedCategories, activeTab]);
  
  // Group labels by category for display
  const labelsByCategory = useMemo(() => {
    if (!categories || !relevantLabels) return new Map<string, LabelType[]>();
    
    const result = new Map<string, LabelType[]>();
    
    // Create entry for each category that has labels
    categories.forEach(category => {
      const categoryLabels = relevantLabels.filter(l => l.categoryId === category.id);
      if (categoryLabels.length > 0) {
        result.set(category.name, categoryLabels);
      }
    });
    
    return result;
  }, [categories, relevantLabels]);

  // Update form state when content data changes
  useEffect(() => {
    if (content) {
      setSelectedCategories(content.categories ? content.categories.split(',').map((c: string) => c.trim()).filter(Boolean) : []);
      setSelectedLabels(content.labels ? content.labels.split(',').map((l: string) => l.trim()).filter(Boolean) : []);
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
      queryClient.invalidateQueries({ queryKey: [`/api/contents/${contentId}`] });
      
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
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Cập nhật thông tin</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center items-center p-10">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Đang tải thông tin...</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6 overflow-hidden h-[60vh]">
            {/* Categories */}
            <div className="flex flex-col h-full">
              <h3 className="font-bold text-lg mb-4">Categories</h3>
              <div className="flex-1 border rounded-md p-2 overflow-auto">
                <div className="space-y-2 pr-2">
                  {categories && categories.map((category) => (
                    <div 
                      key={category.id} 
                      className="flex items-center space-x-2 py-1 px-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Checkbox 
                        id={`category-${category.id}`} 
                        checked={selectedCategories.includes(category.name)}
                        onCheckedChange={(checked) => handleCategoryChange(category.name, checked === true)}
                      />
                      <Label 
                        htmlFor={`category-${category.id}`}
                        className="cursor-pointer w-full"
                      >
                        {category.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Labels */}
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Label</h3>
                <div className="w-28 border rounded-md">
                  <div className="grid w-full grid-cols-2">
                    <button 
                      className={`px-2 py-1 text-sm font-medium ${activeTab === 'all' ? 'bg-slate-200 dark:bg-slate-700' : ''}`}
                      onClick={() => setActiveTab('all')}
                    >
                      Tất cả
                    </button>
                    <button 
                      className={`px-2 py-1 text-sm font-medium ${activeTab === 'filtered' ? 'bg-slate-200 dark:bg-slate-700' : ''}`}
                      onClick={() => setActiveTab('filtered')}
                    >
                      Đã chọn
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 border rounded-md p-2 overflow-auto">
                {labelsByCategory.size > 0 ? (
                  Array.from(labelsByCategory.entries()).map(([categoryName, labels]) => (
                    <div key={categoryName} className="mb-4 last:mb-0">
                      <div className="font-medium text-sm text-muted-foreground mb-2 px-1">
                        {categoryName}
                      </div>
                      <div className="space-y-1 px-1">
                        {labels.map((label) => (
                          <div 
                            key={label.id} 
                            className="flex items-center space-x-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            onClick={() => handleLabelChange(label.name, !selectedLabels.includes(label.name))}
                          >
                            <Checkbox 
                              id={`label-${label.id}`} 
                              checked={selectedLabels.includes(label.name)}
                              onCheckedChange={(checked) => handleLabelChange(label.name, checked === true)}
                            />
                            <Label htmlFor={`label-${label.id}`} className="cursor-pointer w-full">{label.name}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground p-2">
                    {activeTab === "filtered" && selectedCategories.length === 0 
                      ? "Vui lòng chọn danh mục trước"
                      : "Không có nhãn nào cho lựa chọn này"}
                  </div>
                )}
              </div>
            </div>
            
            {/* Safety Status */}
            <div className="flex flex-col h-full">
              <h3 className="font-bold text-lg mb-4">Hành động</h3>
              <div className="space-y-2 border rounded-md p-4">
                <div 
                  className="flex items-center space-x-2 p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  onClick={() => setIsSafe(isSafe === true ? null : true)}
                >
                  <Checkbox 
                    id="safe-yes" 
                    checked={isSafe === true}
                    onCheckedChange={(checked) => setIsSafe(checked === true ? true : null)}
                  />
                  <Label htmlFor="safe-yes" className="cursor-pointer w-full">An toàn</Label>
                </div>
                <div 
                  className="flex items-center space-x-2 p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  onClick={() => setIsSafe(isSafe === false ? null : false)}
                >
                  <Checkbox 
                    id="safe-no" 
                    checked={isSafe === false}
                    onCheckedChange={(checked) => setIsSafe(checked === true ? false : null)}
                  />
                  <Label htmlFor="safe-no" className="cursor-pointer w-full">Không an toàn</Label>
                </div>
              </div>
              
              {/* Selected summary */}
              <div className="mt-4 p-4 border rounded-md bg-slate-50 dark:bg-slate-900 flex-1">
                <h4 className="font-medium text-sm mb-2">Đã chọn:</h4>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Danh mục:</div>
                    <div className="text-sm">
                      {selectedCategories.length > 0 
                        ? selectedCategories.join(', ') 
                        : <span className="text-slate-400">Chưa chọn danh mục</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Nhãn:</div> 
                    <div className="text-sm">
                      {selectedLabels.length > 0 
                        ? selectedLabels.join(', ') 
                        : <span className="text-slate-400">Chưa chọn nhãn</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Trạng thái:</div>
                    <div className="text-sm">
                      {isSafe === true ? 'An toàn' : isSafe === false ? 'Không an toàn' : <span className="text-slate-400">Chưa xác định</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <DialogFooter className="mt-4">
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || updateMutation.isPending || isSafe === null}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {updateMutation.isPending 
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang lưu...</>
              : isSafe === null 
                ? 'Hãy chọn trạng thái an toàn' 
                : 'Lưu thay đổi'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}