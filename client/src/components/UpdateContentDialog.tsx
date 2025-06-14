import { useState, useEffect, useMemo } from 'react';
import { Content, Category, Label as LabelType } from '@shared/schema';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft, Maximize2, Minimize2, X } from 'lucide-react';

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
  const [newCategories, setNewCategories] = useState<string>('');
  const [newLabels, setNewLabels] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Tải dữ liệu content và metadata cần thiết chỉ khi dialog mở
  const { data: content, isLoading: contentLoading } = useQuery<any>({
    queryKey: [`/api/contents/${contentId}`],
    enabled: !!contentId && open,
    staleTime: 5 * 60 * 1000, // Cache 5 phút
    cacheTime: 10 * 60 * 1000, // Giữ cache 10 phút
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async () => {
      if (!contentId) return {};
      return await apiRequest('GET', `/api/contents/${contentId}`);
    }
  });

  // Load categories and labels data when dialog opens
  const { data: allLabels } = useQuery<any[]>({
    queryKey: ['/api/labels'],
    enabled: open,
  });

  const { data: categories } = useQuery<any[]>({
    queryKey: ['/api/categories'],
    enabled: open,
  });

  // Tạo một map hiệu suất cao lưu trữ ánh xạ từ category name đến id
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
      try {
        // 1. Update content in our database
        const updatedContent = await apiRequest('PATCH', `/api/contents/${data.id}`, {
          categories: data.categories,
          labels: data.labels,
          safe: data.safe,
          sourceVerification: data.sourceVerification,
          status: data.status
        });

        if (!updatedContent) {
          throw new Error('No response from update request');
        }

        // 2. Send to Gorse service
        // Process ID for Gorse following the format: externalId_type_sourceId
        const sourceData = content?.source ? JSON.parse(content.source) : null;
        let processedExternalId = content?.externalId;

        if (sourceData?.id && sourceData?.type) {
          const type = sourceData.type.toLowerCase() === 'account' ? 'user' : 'page';
          processedExternalId = `${content?.externalId}_${type}_${sourceData.id}`;
        }

        // Parse categories and labels for Gorse API (handle PostgreSQL array format)
        const parsePostgreSQLArray = (str: string): string[] => {
          if (!str) return [];
          
          const result: string[] = [];
          let current = '';
          let insidePostgreSQLArray = false;
          let depth = 0;
          
          for (let i = 0; i < str.length; i++) {
            const char = str[i];
            
            if (char === '{') {
              depth++;
              insidePostgreSQLArray = true;
              current += char;
            } else if (char === '}') {
              depth--;
              current += char;
              if (depth === 0) {
                insidePostgreSQLArray = false;
              }
            } else if (char === ',' && !insidePostgreSQLArray) {
              // This comma is a separator, not inside PostgreSQL array
              if (current.trim()) {
                result.push(current.trim());
              }
              current = '';
            } else {
              current += char;
            }
          }
          
          // Add the last item
          if (current.trim()) {
            result.push(current.trim());
          }
          
          // Process each item to clean PostgreSQL array format
          return result.map(item => {
            if (item.startsWith('{') && item.endsWith('}')) {
              // Parse PostgreSQL array format
              const inner = item.slice(1, -1);
              if (!inner.trim()) return [];
              
              return inner.split(',')
                .map(subItem => {
                  return subItem.trim()
                    .replace(/^"/, '')  // Remove leading quote
                    .replace(/"$/, '')  // Remove trailing quote
                    .replace(/\\"/g, '"') // Unescape quotes
                    .trim();
                })
                .filter(Boolean);
            } else {
              // Regular item
              return [item.trim()];
            }
          }).flat().filter(Boolean);
        };

        const categoriesArray = parsePostgreSQLArray(data.categories);
        const labelsArray = parsePostgreSQLArray(data.labels);

        const gorsePayload = {
          Categories: categoriesArray,
          Comment: "",
          IsHidden: data.safe === false,
          Labels: labelsArray,
          Timestamp: new Date().toISOString()
        };

        // Check initial verification status and current state
        if (content?.sourceVerification === 'unverified' && data.safe === true && isVerified) {
          // For previously unverified content that is now safe and verified
          await fetch('https://prod-gorse-sn.emso.vn/api/item', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...gorsePayload,
              ItemId: processedExternalId
            })
          });
        } else if (content?.sourceVerification === 'verified') {
          // For already verified content
          await fetch(`https://prod-gorse-sn.emso.vn/api/item/${processedExternalId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(gorsePayload)
          });
        }

        return updatedContent;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contents/paginated'] });
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
      setSelectedCategories(prev => {
        const newCategories = [...prev, category];
        // Loại bỏ duplicates và trim
        return Array.from(new Set(newCategories.map(c => c.trim()))).filter(Boolean);
      });
    } else {
      const categoryId = categoryNameToIdMap.get(category);

      if (categoryId && allLabels) {
        const labelsInCategory = allLabels
          .filter(label => label.categoryId === categoryId)
          .map(label => label.name);

        if (labelsInCategory.length > 0) {
          setSelectedLabels(prev => 
            prev.filter(labelName => !labelsInCategory.includes(labelName))
          );
        }
      }

      setSelectedCategories(prev => 
        prev.filter(c => c.trim() !== category.trim())
      );
    }
  };

  const handleLabelChange = (label: string, checked: boolean) => {
    if (checked) {
      setSelectedLabels(prev => {
        const newLabels = [...prev, label];
        // Loại bỏ duplicates và trim
        return Array.from(new Set(newLabels.map(l => l.trim()))).filter(Boolean);
      });
    } else {
      setSelectedLabels(prev => 
        prev.filter(l => l.trim() !== label.trim())
      );
    }
  };

  const handleSubmit = () => {
    if (!contentId) return;

    // Validate required fields
    if (isSafe === null) {
      toast({
        title: 'Validation Error',
        description: 'Vui lòng chọn trạng thái an toàn',
        variant: 'destructive'
      });
      return;
    }

    // Xử lý và loại bỏ các giá trị trùng lặp cho categories
    const processedCategories = selectedCategories
      .filter(Boolean) // Loại bỏ empty strings
      .map(c => c.trim()) // Trim whitespace
      .filter((c, index, self) => self.indexOf(c) === index); // Loại bỏ duplicates

    // Xử lý và loại bỏ các giá trị trùng lặp cho labels  
    const processedLabels = selectedLabels
      .filter(Boolean)
      .map(l => l.trim())
      .filter((l, index, self) => self.indexOf(l) === index);

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
      categories: processedCategories.join(','),
      labels: processedLabels.join(','),
      safe: isSafe,
      sourceVerification: isVerified ? 'verified' : 'unverified',
      status: processedCategories.length > 0 ? 'completed' : 'pending'
    };

    updateMutation.mutate(payload);
  };

  

  useEffect(() => {
    if (!open) {
      setNewCategories('');
      setNewLabels('');
    }
  }, [open]);

  // Global function for adding category from search dropdown
  useEffect(() => {
    (window as any).addCategoryFromSearch = (categoryName: string) => {
      setSelectedCategories(prev => {
        const newCategories = [...prev, categoryName];
        return Array.from(new Set(newCategories.map(c => c.trim()))).filter(Boolean);
      });
      
      // Clear search input
      const searchInput = document.getElementById('searchCategories') as HTMLInputElement;
      if (searchInput) searchInput.value = '';
      
      // Hide dropdown
      const dropdown = document.getElementById('categoryDropdown');
      if (dropdown) dropdown.style.display = 'none';
    };

    return () => {
      delete (window as any).addCategoryFromSearch;
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`update-content-dialog dialog-content ${
          isExpanded 
            ? 'max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] m-0' 
            : 'max-w-[1000px] max-h-[80vh] w-[90vw]'
        } p-0 gap-0 flex flex-col overflow-hidden`}
      >
        <DialogHeader className="p-6 pb-0 flex-shrink-0">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-lg font-medium">
              Cập nhật thông tin: {content?.externalId}
            </DialogTitle>
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

        <div className="flex-1 min-h-0 flex flex-col">
          {contentLoading ? (
            <div className="flex justify-center items-center p-10">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Đang tải thông tin...</span>
            </div>
          ) : (
            <div className={`grid ${isExpanded ? 'grid-cols-3' : 'grid-cols-2'} gap-6 p-6 overflow-y-auto h-full`}>
              {/* Left Column - Categories and Labels */}
              <div className="flex flex-col h-full space-y-6">
              {/* Categories Section */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Categories</h3>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                    {selectedCategories.length} selected
                  </span>
                </div>
                <div className="space-y-4">
                  {/* Search Categories */}
                  <div className="relative">
                    <Label htmlFor="searchCategories" className="text-sm font-medium mb-2 block">
                      Tìm và chọn Categories có sẵn
                    </Label>
                    <Input
                      id="searchCategories"
                      placeholder="Tìm kiếm categories..."
                      className="mb-2"
                      onChange={(e) => {
                        const searchTerm = e.target.value.toLowerCase();
                        const filteredCats = categories?.filter(cat => 
                          cat.name.toLowerCase().includes(searchTerm)
                        ) || [];
                        
                        // Show dropdown if there are matches and search term is not empty
                        if (searchTerm && filteredCats.length > 0) {
                          const dropdown = document.getElementById('categoryDropdown');
                          if (dropdown) {
                            dropdown.style.display = 'block';
                            dropdown.innerHTML = filteredCats.slice(0, 8).map(cat => 
                              `<div class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-200 dark:border-slate-700 text-sm" 
                                   onclick="addCategoryFromSearch('${cat.name}')">${cat.name}</div>`
                            ).join('');
                          }
                        } else {
                          const dropdown = document.getElementById('categoryDropdown');
                          if (dropdown) dropdown.style.display = 'none';
                        }
                      }}
                      onBlur={() => {
                        // Delay hiding dropdown to allow click events
                        setTimeout(() => {
                          const dropdown = document.getElementById('categoryDropdown');
                          if (dropdown) dropdown.style.display = 'none';
                        }, 200);
                      }}
                    />
                    <div 
                      id="categoryDropdown" 
                      className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto"
                      style={{ display: 'none' }}
                    ></div>
                  </div>

                  {/* Manual Categories Input */}
                  <div>
                    <Label htmlFor="newCategories" className="text-sm font-medium mb-2 block">
                      Thêm Categories mới
                    </Label>
                    <Textarea
                      id="newCategories"
                      placeholder="Nhập categories cách nhau bởi {}. Ví dụ: {AI}{Gaming}{Social}"
                      className="min-h-[120px] text-sm mb-2"
                      value={newCategories}
                      onChange={(e) => {
                        setNewCategories(e.target.value);
                      }}
                      onBlur={() => {
                        const matches = newCategories.match(/\{([^}]+)\}/g);
                        if (matches) {
                          const newCats = matches.map(m => m.slice(1, -1).trim());
                          setSelectedCategories([...new Set([...selectedCategories, ...newCats])]);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const matches = newCategories.match(/\{([^}]+)\}/g);
                          if (matches) {
                            const newCats = matches.map(m => m.slice(1, -1).trim());
                            setSelectedCategories([...new Set([...selectedCategories, ...newCats])]);
                            setNewCategories('');
                          }
                        }
                      }}
                    />
                    {selectedCategories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Array.from(new Set(selectedCategories)).map((cat) => (
                          <span key={cat} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs flex items-center gap-1">
                            {cat}
                            <button
                              type="button"
                              onClick={() => setSelectedCategories(prev => prev.filter(c => c !== cat))}
                              className="text-red-500 hover:text-red-700 ml-1"
                              title="Xóa category"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Labels Section */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Labels</h3>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                    {selectedLabels.length} selected
                  </span>
                </div>
                <div>
                  <Label htmlFor="newLabels" className="text-sm font-medium mb-2 block">
                    Thêm Labels mới
                  </Label>
                  <Textarea
                    id="newLabels"
                    placeholder="Nhập labels cách nhau bởi {}. Ví dụ: {AI}{ChatGPT}{OpenAI}"
                    className="min-h-[120px] text-sm mb-2"
                    value={newLabels}
                    onChange={(e) => {
                      setNewLabels(e.target.value);
                    }}
                    onBlur={() => {
                      const matches = newLabels.match(/\{([^}]+)\}/g);
                      if (matches) {
                        const newLbls = matches.map(m => m.slice(1, -1).trim());
                        setSelectedLabels([...new Set([...selectedLabels, ...newLbls])]);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const matches = newLabels.match(/\{([^}]+)\}/g);
                        if (matches) {
                          const newLbls = matches.map(m => m.slice(1, -1).trim());
                          setSelectedLabels([...new Set([...selectedLabels, ...newLbls])]);
                          setNewLabels('');
                        }
                      }
                    }}
                  />
                  {selectedLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Array.from(new Set(selectedLabels)).map((label) => (
                        <span key={label} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Safety Status and Summary */}
            <div className="flex flex-col h-full space-y-6">
              {/* Safety Status Section */}
              <div>
                <h3 className="font-bold text-lg mb-4">Trạng thái nội dung</h3>
                <div className="space-y-2 border rounded-md bg-slate-50 dark:bg-slate-900">
                  {/* Safety Options Group */}
                  <div className="p-4 space-y-2">
                    <div 
                      className="flex items-center space-x-3 p-3 rounded-md hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      onClick={() => setIsSafe(isSafe === true ? null : true)}
                    >
                      <Checkbox 
                        id="safe-yes" 
                        checked={isSafe === true}
                        onCheckedChange={(checked) => setIsSafe(checked === true ? true : null)}
                      />
                      <Label htmlFor="safe-yes" className="cursor-pointer w-full font-medium">An toàn</Label>
                    </div>
                    <div 
                      className="flex items-center space-x-3 p-3 rounded-md hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      onClick={() => setIsSafe(isSafe === false ? null : false)}
                    >
                      <Checkbox 
                        id="safe-no" 
                        checked={isSafe === false}
                        onCheckedChange={(checked) => setIsSafe(checked === true ? false : null)}
                      />
                      <Label htmlFor="safe-no" className="cursor-pointer w-full font-medium">Không an toàn</Label>
                    </div>
                  </div>

                  {/* Verification Section - Always present but conditionally visible */}
                  <div className={`border-t ${isSafe === true ? 'visible' : 'invisible h-0'}`}>
                    <div 
                      className="p-4 flex items-start space-x-3 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      onClick={() => isSafe === true && setIsVerified(!isVerified)}
                    >
                      <Checkbox 
                        id="verified" 
                        checked={isVerified && isSafe === true}
                        onCheckedChange={(checked) => isSafe === true && setIsVerified(checked === true)}
                        disabled={isSafe !== true}
                      />
                      <div className="cursor-pointer flex-1">
                        <Label htmlFor="verified" className="font-medium block">Xác minh</Label>
                        <p className="text-xs text-muted-foreground mt-1">Nguồn dữ liệu này đã được xác minh</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Section */}
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-4">Tổng hợp thông tin</h3>
                <div className="p-4 border rounded-md bg-white dark:bg-slate-900 space-y-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Trạng thái:</div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        isSafe === true ? 'bg-green-500' : 
                        isSafe === false ? 'bg-red-500' : 
                        'bg-gray-400'
                      }`} />
                      <span className="text-sm font-medium">
                        {isSafe === true ? 'An toàn' : 
                         isSafe === false ? 'Không an toàn' : 
                         'Chưa xác định'}
                      </span>
                    </div>
                  </div>

                  {isSafe === true && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2">Xác minh:</div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          isVerified ? 'bg-green-500' : 'bg-orange-500'
                        }`} />
                        <span className="text-sm font-medium">
                          {isVerified ? 'Đã xác minh' : 'Chưa xác minh'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Danh mục đã chọn:</div>
                    <div className="text-sm">
                      {selectedCategories.length > 0 
                        ? <div className="flex flex-wrap gap-2">
                            {Array.from(new Set(selectedCategories)).map((cat) => (
                              <span key={cat} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs">
                                {cat}
                              </span>
                            ))}
                          </div>
                        : <span className="text-slate-400">Chưa chọn danh mục</span>
                      }
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Nhãn đã chọn:</div>
                    <div className="text-sm">
                      {selectedLabels.length > 0 
                        ? <div className="flex flex-wrap gap-2">
                            {Array.from(new Set(selectedLabels)).map((label) => (
                              <span key={label} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs">
                                {label}
                              </span>
                            ))}
                          </div>
                        : <span className="text-slate-400">Chưa chọn nhãn</span>
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Third Column - Content Details (only visible when expanded) */}
            {isExpanded && (
              <div className="flex flex-col h-full space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-4">Chi tiết nội dung</h3>
                  <div className="space-y-4 h-full overflow-y-auto">
                    {/* Content Source Info */}
                    <div className="p-4 border rounded-md bg-white dark:bg-slate-900">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Nguồn:</div>
                      <div className="text-sm">
                        {content?.source ? (
                          (() => {
                            try {
                              const sourceObj = JSON.parse(content.source);
                              return (
                                <div className="space-y-1">
                                  <div><strong>Tên:</strong> {sourceObj.name || 'N/A'}</div>
                                  <div><strong>ID:</strong> {sourceObj.id || 'N/A'}</div>
                                  <div><strong>Loại:</strong> {sourceObj.type || 'N/A'}</div>
                                </div>
                              );
                            } catch {
                              return <span className="text-slate-400">{content.source}</span>;
                            }
                          })()
                        ) : (
                          <span className="text-slate-400">Không có thông tin nguồn</span>
                        )}
                      </div>
                    </div>

                    {/* Content Status */}
                    <div className="p-4 border rounded-md bg-white dark:bg-slate-900">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Trạng thái xử lý:</div>
                      <div className="text-sm">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className={`w-2 h-2 rounded-full ${
                            content?.status === 'completed' ? 'bg-green-500' : 
                            content?.status === 'pending' ? 'bg-yellow-500' : 
                            'bg-gray-400'
                          }`} />
                          <span className="capitalize">{content?.status || 'N/A'}</span>
                        </div>
                        <div><strong>Người xử lý:</strong> {content?.processor?.name || 'N/A'}</div>
                        <div><strong>Phân công:</strong> {content?.assignedAt ? new Date(content.assignedAt).toLocaleString('vi-VN') : 'N/A'}</div>
                      </div>
                    </div>

                    {/* Content Metrics */}
                    <div className="p-4 border rounded-md bg-white dark:bg-slate-900">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Thống kê:</div>
                      <div className="text-sm space-y-1">
                        <div><strong>Comments:</strong> {content?.comments || 0}</div>
                        <div><strong>Reactions:</strong> {content?.reactions || 0}</div>
                        <div><strong>Tạo lúc:</strong> {content?.createdAt ? new Date(content.createdAt).toLocaleString('vi-VN') : 'N/A'}</div>
                        <div><strong>Cập nhật:</strong> {content?.updatedAt ? new Date(content.updatedAt).toLocaleString('vi-VN') : 'N/A'}</div>
                      </div>
                    </div>

                    {/* Processing Result */}
                    {content?.processingResult && (
                      <div className="p-4 border rounded-md bg-white dark:bg-slate-900">
                        <div className="text-sm font-medium text-muted-foreground mb-2">Kết quả xử lý:</div>
                        <div className="text-sm">
                          <pre className="whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 p-2 rounded text-xs">
                            {typeof content.processingResult === 'string' 
                              ? content.processingResult 
                              : JSON.stringify(content.processingResult, null, 2)
                            }
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-gray-50 dark:bg-slate-900 flex-shrink-0">
          <Button 
            onClick={handleSubmit} 
            disabled={contentLoading || updateMutation.isPending || isSafe === null}
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
        
        <style>{`
          /* Hide default dialog close button only for UpdateContentDialog */
          .update-content-dialog .dialog-content > button[data-radix-dialog-close],
          .update-content-dialog [data-radix-dialog-content] > button[data-radix-dialog-close],
          .update-content-dialog button[data-radix-dialog-close],
          .update-content-dialog [data-radix-dialog-content] button[class*="absolute"][class*="right-4"][class*="top-4"] {
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
          .update-content-dialog .dialog-content {
            display: flex;
            flex-direction: column;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}