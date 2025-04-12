import { useState, useEffect, useMemo } from 'react';
import { Content, Category, Label as LabelType } from '@shared/schema';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';

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
  const [isVerified, setIsVerified] = useState<boolean>(false);
  
  // Prefetch dữ liệu labels và categories sẵn khi app bắt đầu
  useEffect(() => {
    // Prefetch categories - Dù dialog có mở hay không
    queryClient.prefetchQuery({
      queryKey: ['/api/categories'],
      queryFn: async () => await apiRequest('GET', '/api/categories'),
      staleTime: 30 * 60 * 1000, // Cache lâu hơn - 30 phút
    });
    
    // Prefetch all labels - Dù dialog có mở hay không
    queryClient.prefetchQuery({
      queryKey: ['/api/labels'],
      queryFn: async () => await apiRequest('GET', '/api/labels'),
      staleTime: 30 * 60 * 1000, // Cache lâu hơn - 30 phút
    });
  }, []);
  
  // Chỉ tải dữ liệu content khi cần thiết
  const { data: content, isLoading: contentLoading } = useQuery<any>({
    queryKey: [contentId ? `/api/contents/${contentId}` : 'empty'],
    enabled: !!contentId && open,
    staleTime: 2 * 60 * 1000, // 2 phút - đủ để không phải tải lại quá nhiều
    refetchOnWindowFocus: false, // Không tải lại khi focus vào cửa sổ
    refetchOnMount: false, // Chỉ tải một lần khi component được mount
    queryFn: async () => {
      if (!contentId) return {};
      return await apiRequest('GET', `/api/contents/${contentId}`);
    }
  });
  
  // Sử dụng kết quả từ cache cho categories
  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    staleTime: 30 * 60 * 1000, // Tăng thời gian cache - 30 phút 
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  
  // Sử dụng kết quả từ cache cho labels
  const { data: allLabels, isLoading: allLabelsLoading } = useQuery<LabelType[]>({
    queryKey: ['/api/labels'],
    staleTime: 30 * 60 * 1000, // Tăng thời gian cache - 30 phút
    refetchOnWindowFocus: false, 
    refetchOnMount: false,
  });
  
  // Tạo một map hiệu suất cao lưu trữ ánh xạ từ category ID đến danh sách labels
  const categoryLabelsMap = useMemo(() => {
    if (!allLabels) return new Map<number, LabelType[]>();
    
    // Sử dụng reduce để tạo map nhanh hơn với ít lần truy cập
    return allLabels.reduce((map, label) => {
      if (!map.has(label.categoryId)) {
        map.set(label.categoryId, []);
      }
      map.get(label.categoryId)?.push(label);
      return map;
    }, new Map<number, LabelType[]>());
  }, [allLabels]);
  
  // Tạo một map nhanh ánh xạ từ category name đến id
  const categoryNameToIdMap = useMemo(() => {
    if (!categories) return new Map<string, number>();
    return new Map(categories.map(c => [c.name, c.id]));
  }, [categories]);
  
  // Lọc danh sách nhãn dựa trên danh mục đã chọn
  const relevantLabels = useMemo(() => {
    if (!categories || !allLabels) return [];
    
    // Không có danh mục nào được chọn - trả về mảng rỗng
    if (selectedCategories.length === 0) return [];
    
    // Sử dụng Set để tìm kiếm nhanh
    const selectedCategoryIds = new Set(
      selectedCategories.map(name => categoryNameToIdMap.get(name)).filter(Boolean)
    );
    
    // Lọc nhãn chỉ cho danh mục đã chọn
    return allLabels.filter(label => selectedCategoryIds.has(label.categoryId));
  }, [allLabels, categories, selectedCategories, categoryNameToIdMap]);
  
  // Nhóm các nhãn theo danh mục để hiển thị, sử dụng cấu trúc Map từ categoryId đến labels
  const labelsByCategory = useMemo(() => {
    if (!categories || !relevantLabels) return new Map<string, LabelType[]>();
    
    // Tạo map từ categoryId đến danh sách labels - hiệu quả hơn dùng filter nhiều lần
    const labelsMap = relevantLabels.reduce((map, label) => {
      if (!map.has(label.categoryId)) {
        map.set(label.categoryId, []);
      }
      map.get(label.categoryId)?.push(label);
      return map;
    }, new Map<number, LabelType[]>());
    
    // Ánh xạ map từ categoryId sang map từ tên danh mục để hiển thị
    const result = new Map<string, LabelType[]>();
    
    categories.forEach(category => {
      const categoryLabels = labelsMap.get(category.id) || [];
      if (categoryLabels.length > 0) {
        result.set(category.name, categoryLabels);
      }
    });
    
    return result;
  }, [categories, relevantLabels]);

  // Update form state when content data changes
  useEffect(() => {
    if (content) {
      // Loại bỏ các giá trị trùng lặp khi khởi tạo
      const initialCategories = content.categories ? content.categories.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
      const initialLabels = content.labels ? content.labels.split(',').map((l: string) => l.trim()).filter(Boolean) : [];
      
      // Sử dụng Set để loại bỏ các giá trị trùng lặp
      setSelectedCategories(Array.from(new Set(initialCategories)));
      setSelectedLabels(Array.from(new Set(initialLabels)));
      setIsSafe(content.safe as boolean | null);
      
      // Kiểm tra nếu nội dung đã được xác minh hay chưa
      const verification = content.sourceVerification || 'unverified';
      setIsVerified(verification === 'verified');
    }
  }, [content]);
  
  // Update content mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { 
      id: number, 
      categories: string, 
      labels: string, 
      safe: boolean | null,
      sourceVerification?: string,
      status?: string 
    }) => {
      console.log('Starting update mutation with data:', data);

      try {
        // 1. Update content in our database
        const updatedContent = await apiRequest('PATCH', `/api/contents/${data.id}`, {
          categories: data.categories,
          labels: data.labels,
          safe: data.safe,
          sourceVerification: data.sourceVerification,
          status: data.status
        });
        
        console.log('Content updated in database:', updatedContent);

        if (!updatedContent) {
          throw new Error('No response from update request');
        }

        // 2. Send to Gorse service via Kafka
        const kafkaData = {
          externalId: content?.externalId, // Use existing content's externalId
          categories: data.categories,
          labels: data.labels,
          safe: data.safe,
          sourceVerification: data.sourceVerification
        };

        console.log('Sending to Kafka:', kafkaData);
        
        await apiRequest('POST', '/api/kafka/send', kafkaData);
        console.log('Successfully sent to Kafka');
        
        return updatedContent;
      } catch (error) {
        console.error('Error in mutation:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: [`/api/contents/${contentId}`] });
      
      toast({
        title: 'Cập nhật thành công',
        description: 'Thông tin nội dung đã được cập nhật và đồng bộ với Gorse.',
      });
      
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error('Mutation error:', error);
      toast({
        title: 'Lỗi khi cập nhật nội dung',
        description: error.message || 'Không thể cập nhật nội dung',
        variant: 'destructive',
      });
    }
  });
  
  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      // Kiểm tra xem category đã tồn tại trong danh sách chưa
      if (!selectedCategories.includes(category)) {
        setSelectedCategories(prev => [...prev, category]);
      }
    } else {
      // Khi bỏ chọn một danh mục, cần lọc ra các nhãn thuộc danh mục đó và bỏ chọn chúng
      const categoryId = categoryNameToIdMap.get(category);
      
      if (categoryId && allLabels) {
        // Tìm tất cả các nhãn thuộc danh mục này
        const labelsInCategory = allLabels
          .filter(label => label.categoryId === categoryId)
          .map(label => label.name);
          
        // Loại bỏ các nhãn thuộc danh mục này khỏi danh sách đã chọn
        if (labelsInCategory.length > 0) {
          setSelectedLabels(prev => 
            prev.filter(labelName => !labelsInCategory.includes(labelName))
          );
        }
      }
      
      // Loại bỏ danh mục khỏi danh sách đã chọn
      setSelectedCategories(prev => prev.filter(c => c !== category));
    }
  };
  
  const handleLabelChange = (label: string, checked: boolean) => {
    if (checked) {
      // Kiểm tra xem label đã tồn tại trong danh sách chưa
      if (!selectedLabels.includes(label)) {
        setSelectedLabels(prev => [...prev, label]);
      }
    } else {
      setSelectedLabels(prev => prev.filter(l => l !== label));
    }
  };
  
  const handleSubmit = () => {
    if (!contentId) return;
    
    // Loại bỏ các labels trùng lặp trước khi lưu
    const uniqueCategories = Array.from(new Set(selectedCategories));
    const uniqueLabels = Array.from(new Set(selectedLabels));
    
    // Tạo payload để gửi đi
    const payload: {
      id: number,
      categories: string,
      labels: string,
      safe: boolean | null,
      sourceVerification?: string,
      status?: string
    } = {
      id: contentId,
      categories: uniqueCategories.join(','),
      labels: uniqueLabels.join(','),
      safe: isSafe,
      sourceVerification: isVerified ? 'verified' : 'unverified',
      status: uniqueCategories.length > 0 ? 'completed' : 'pending'
    };

    console.log('Submitting payload:', payload);
    
    updateMutation.mutate(payload);
  };
  
  // Kiểm tra trạng thái loading
  const isLoading = contentLoading || categoriesLoading || allLabelsLoading;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
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
            <div className="flex flex-col h-full overflow-hidden">
              <h3 className="font-bold text-lg mb-4">Categories</h3>
              <div className="flex-1 border rounded-md p-2 overflow-y-auto">
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
            <div className="flex flex-col h-full overflow-hidden">
              <h3 className="font-bold text-lg mb-4">Label</h3>
              
              <div className="flex-1 border rounded-md p-2 overflow-y-auto">
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
                  <div className="text-sm text-muted-foreground p-4 flex items-center justify-center h-full">
                    <div className="text-center">
                      <p>Vui lòng chọn danh mục trước</p>
                      <ArrowLeft className="mx-auto mt-2 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Safety Status */}
            <div className="flex flex-col h-full overflow-hidden">
              <h3 className="font-bold text-lg mb-4">Hành động</h3>
              <div className="space-y-2 border rounded-md p-4 overflow-y-auto">
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
                
                {/* Hiển thị checkbox Xác minh khi nội dung đã chọn An toàn */}
                {isSafe === true && (
                  <div 
                    className="flex items-center space-x-2 mt-4 pt-4 border-t p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    onClick={() => setIsVerified(!isVerified)}
                  >
                    <Checkbox 
                      id="verified" 
                      checked={isVerified}
                      onCheckedChange={(checked) => setIsVerified(checked === true)}
                    />
                    <Label htmlFor="verified" className="cursor-pointer w-full">
                      <span>Xác minh</span>
                      <p className="text-xs text-muted-foreground mt-1">Nguồn dữ liệu này đã được xác minh</p>
                    </Label>
                  </div>
                )}
              </div>
              
              {/* Selected summary */}
              <div className="mt-4 p-4 border rounded-md bg-slate-50 dark:bg-slate-900 flex-1">
                <h4 className="font-medium text-sm mb-2">Đã chọn:</h4>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Danh mục:</div>
                    <div className="text-sm">
                      {selectedCategories.length > 0 
                        ? Array.from(new Set(selectedCategories)).join(', ') 
                        : <span className="text-slate-400">Chưa chọn danh mục</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Nhãn:</div> 
                    <div className="text-sm">
                      {selectedLabels.length > 0 
                        ? Array.from(new Set(selectedLabels)).join(', ') 
                        : <span className="text-slate-400">Chưa chọn nhãn</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Trạng thái:</div>
                    <div className="text-sm">
                      {isSafe === true ? 'An toàn' : isSafe === false ? 'Không an toàn' : <span className="text-slate-400">Chưa xác định</span>}
                    </div>
                  </div>
                  
                  {/* Hiển thị trạng thái xác minh cho nội dung an toàn */}
                  {isSafe === true && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Xác minh:</div>
                      <div className="text-sm">
                        {isVerified 
                          ? <span className="text-green-600">Đã xác minh</span> 
                          : <span className="text-orange-500">Chưa xác minh</span>}
                      </div>
                    </div>
                  )}
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