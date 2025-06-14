import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  FileEdit,
  Trash2,
  Tag,
  Folder,
  RefreshCw,
  Eye
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Định nghĩa các types cho categories và labels
type Category = {
  id: number;
  name: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
};

type Label = {
  id: number;
  name: string;
  categoryId: number;
  description: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function CategoriesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  
  // Dialog states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false);
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false);
  const [isDeleteLabelDialogOpen, setIsDeleteLabelDialogOpen] = useState(false);
  
  // Form states
  const [categoryForm, setCategoryForm] = useState<{
    name: string;
    description: string;
  }>({
    name: '',
    description: ''
  });
  
  const [labelForm, setLabelForm] = useState<{
    name: string;
    categoryId: number | '';
    description: string;
  }>({
    name: '',
    categoryId: '',
    description: ''
  });

  // Fetching categories
  const { 
    data: categories = [],
    isLoading: isCategoriesLoading,
    refetch: refetchCategories
  } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Fetching labels
  const { 
    data: labels = [],
    isLoading: isLabelsLoading,
    refetch: refetchLabels
  } = useQuery<Label[]>({
    queryKey: ['/api/labels'],
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: { name: string; description: string }) => {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create category');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Category created successfully',
        description: 'New category has been added to the system.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setIsCategoryDialogOpen(false);
      setCategoryForm({ name: '', description: '' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create category',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({
      id,
      categoryData,
    }: {
      id: number;
      categoryData: { name: string; description: string };
    }) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update category');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Category updated successfully',
        description: 'Category has been updated in the system.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setIsCategoryDialogOpen(false);
      setCategoryForm({ name: '', description: '' });
      setSelectedCategoryId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update category',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log(`Attempting to delete category ${id}`);
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Delete response status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete category' }));
        console.error('Delete error:', errorData);
        throw new Error(errorData.message || 'Failed to delete category');
      }
      
      return true;
    },
    onSuccess: () => {
      toast({
        title: 'Category deleted successfully',
        description: 'Category has been removed from the system.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/labels'] });
      setIsDeleteCategoryDialogOpen(false);
      setSelectedCategoryId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete category',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Create label mutation
  const createLabelMutation = useMutation({
    mutationFn: async (labelData: { name: string; categoryId: number; description: string }) => {
      const response = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(labelData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create label');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Label created successfully',
        description: 'New label has been added to the system.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/labels'] });
      setIsLabelDialogOpen(false);
      setLabelForm({ name: '', categoryId: '', description: '' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create label',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update label mutation
  const updateLabelMutation = useMutation({
    mutationFn: async ({
      id,
      labelData,
    }: {
      id: number;
      labelData: { name: string; categoryId: number; description: string };
    }) => {
      const response = await fetch(`/api/labels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(labelData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update label');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Label updated successfully',
        description: 'Label has been updated in the system.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/labels'] });
      setIsLabelDialogOpen(false);
      setLabelForm({ name: '', categoryId: '', description: '' });
      setSelectedLabelId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update label',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete label mutation
  const deleteLabelMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/labels/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete label');
      }
      
      return true;
    },
    onSuccess: () => {
      toast({
        title: 'Label deleted successfully',
        description: 'Label has been removed from the system.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/labels'] });
      setIsDeleteLabelDialogOpen(false);
      setSelectedLabelId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete label',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle category form submission
  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryForm.name) {
      toast({
        title: 'Validation Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }
    
    if (selectedCategoryId) {
      updateCategoryMutation.mutate({
        id: selectedCategoryId,
        categoryData: categoryForm,
      });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };

  // Handle label form submission
  const handleLabelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!labelForm.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Label name is required',
        variant: 'destructive',
      });
      return;
    }
    
    if (labelForm.categoryId === '') {
      toast({
        title: 'Validation Error',
        description: 'Please select a category',
        variant: 'destructive',
      });
      return;
    }
    
    if (selectedLabelId) {
      // Khi cập nhật, chỉ xử lý một label
      updateLabelMutation.mutate({
        id: selectedLabelId,
        labelData: {
          ...labelForm,
          categoryId: Number(labelForm.categoryId),
        },
      });
    } else {
      // Xử lý tạo nhiều label nếu có dấu phẩy
      const labelNames = labelForm.name.split(',').map(name => name.trim()).filter(name => name !== '');
      
      if (labelNames.length === 0) {
        toast({
          title: 'Validation Error',
          description: 'Please enter at least one valid label name',
          variant: 'destructive',
        });
        return;
      }
      
      // Đếm số lượng label để hiển thị thông báo phù hợp
      const labelCount = labelNames.length;
      let createdCount = 0;
      
      // Tạo các label theo trình tự
      const createLabelsSequentially = async () => {
        for (const name of labelNames) {
          try {
            await createLabelMutation.mutateAsync({
              name,
              categoryId: Number(labelForm.categoryId),
              description: labelForm.description,
            });
            createdCount++;
          } catch (error) {
            console.error(`Failed to create label "${name}":`, error);
          }
        }
        
        // Hiển thị thông báo kết quả
        toast({
          title: 'Labels created successfully',
          description: `Created ${createdCount} out of ${labelCount} labels.`,
          variant: createdCount === labelCount ? 'default' : 'destructive',
        });
        
        // Đóng hộp thoại và reset form chỉ khi hoàn thành
        setIsLabelDialogOpen(false);
        setLabelForm({ name: '', categoryId: '', description: '' });
      };
      
      // Bắt đầu quá trình tạo label
      createLabelsSequentially();
    }
  };

  // Open edit category dialog
  const handleEditCategory = (category: Category) => {
    setSelectedCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
    });
    setIsCategoryDialogOpen(true);
  };

  // Open edit label dialog
  const handleEditLabel = (label: Label) => {
    setSelectedLabelId(label.id);
    setLabelForm({
      name: label.name,
      categoryId: label.categoryId,
      description: label.description || '',
    });
    setIsLabelDialogOpen(true);
  };

  // Open delete category dialog
  const handleDeleteCategoryClick = (categoryId: number) => {
    setSelectedCategoryId(categoryId);
    setIsDeleteCategoryDialogOpen(true);
  };

  // Open delete label dialog
  const handleDeleteLabelClick = (labelId: number) => {
    setSelectedLabelId(labelId);
    setIsDeleteLabelDialogOpen(true);
  };

  // Reset category form
  const resetCategoryForm = () => {
    setSelectedCategoryId(null);
    setCategoryForm({
      name: '',
      description: '',
    });
  };

  // Reset label form
  const resetLabelForm = () => {
    setSelectedLabelId(null);
    setLabelForm({
      name: '',
      categoryId: '',
      description: '',
    });
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Quản lý Categories & Labels</h1>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              refetchCategories();
              refetchLabels();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tải lại dữ liệu
          </Button>
        </div>
      </div>

      <Tabs defaultValue="categories" className="mb-8">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="categories">
            <Folder className="h-4 w-4 mr-2" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="labels">
            <Tag className="h-4 w-4 mr-2" />
            Labels
          </TabsTrigger>
        </TabsList>
        
        {/* Categories Tab */}
        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Danh sách Categories</CardTitle>
                <CardDescription>
                  Quản lý danh mục phân loại nội dung
                </CardDescription>
              </div>
              {user?.role === 'admin' && (
                <Button 
                  onClick={() => {
                    resetCategoryForm();
                    setIsCategoryDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm mới Category
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isCategoriesLoading ? (
                <div className="flex justify-center items-center p-8">
                  <p className="text-muted-foreground">Đang tải dữ liệu...</p>
                </div>
              ) : categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Folder className="h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Chưa có Categories</h3>
                  <p className="text-muted-foreground mt-2 mb-4">
                    Chưa có Categories nào được tạo trong hệ thống
                  </p>
                  {user?.role === 'admin' && (
                    <Button 
                      onClick={() => {
                        resetCategoryForm();
                        setIsCategoryDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Thêm Categories
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tên</TableHead>
                      <TableHead className="hidden md:table-cell">Mô tả</TableHead>
                      <TableHead className="hidden md:table-cell">Labels</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => {
                      const categoryLabels = labels.filter(
                        (label) => label.categoryId === category.id
                      );
                      
                      return (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">
                            {category.id}
                          </TableCell>
                          <TableCell>{category.name}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {category.description || <span className="text-muted-foreground">Không có mô tả</span>}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {categoryLabels.length}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditCategory(category)}
                              >
                                <FileEdit className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                              {user?.role === 'admin' && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteCategoryClick(category.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Labels Tab */}
        <TabsContent value="labels">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Danh sách Labels</CardTitle>
                <CardDescription>
                  Quản lý nhãn cho nội dung
                </CardDescription>
              </div>
              {user?.role === 'admin' && (
                <Button 
                  onClick={() => {
                    resetLabelForm();
                    setIsLabelDialogOpen(true);
                  }}
                  disabled={categories.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm mới Label
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isLabelsLoading ? (
                <div className="flex justify-center items-center p-8">
                  <p className="text-muted-foreground">Đang tải dữ liệu...</p>
                </div>
              ) : categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Folder className="h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Chưa có Categories</h3>
                  <p className="text-muted-foreground mt-2 mb-4">
                    Bạn cần tạo Categories trước khi tạo Labels
                  </p>
                  {user?.role === 'admin' && (
                    <Button 
                      onClick={() => {
                        resetCategoryForm();
                        setIsCategoryDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Thêm Categories
                    </Button>
                  )}
                </div>
              ) : labels.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Tag className="h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Chưa có Labels</h3>
                  <p className="text-muted-foreground mt-2 mb-4">
                    Chưa có Labels nào được tạo trong hệ thống
                  </p>
                  {user?.role === 'admin' && (
                    <Button 
                      onClick={() => {
                        resetLabelForm();
                        setIsLabelDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Thêm Labels
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tên</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="hidden md:table-cell">Mô tả</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labels.map((label) => {
                      const category = categories.find(
                        (c) => c.id === label.categoryId
                      );
                      
                      return (
                        <TableRow key={label.id}>
                          <TableCell className="font-medium">
                            {label.id}
                          </TableCell>
                          <TableCell>{label.name}</TableCell>
                          <TableCell>
                            {category?.name || <span className="text-muted-foreground">Unknown</span>}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {label.description || <span className="text-muted-foreground">Không có mô tả</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditLabel(label)}
                              >
                                <FileEdit className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                              {user?.role === 'admin' && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteLabelClick(label.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCategoryId ? 'Chỉnh sửa Category' : 'Thêm mới Category'}
            </DialogTitle>
            <DialogDescription>
              {selectedCategoryId
                ? 'Cập nhật thông tin cho category đã chọn'
                : 'Thêm mới một category vào hệ thống'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="categoryName">Tên category</Label>
                <Input
                  id="categoryName"
                  placeholder="Nhập tên category"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="categoryDescription">Mô tả</Label>
                <Textarea
                  id="categoryDescription"
                  placeholder="Nhập mô tả cho category (không bắt buộc)"
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCategoryDialogOpen(false);
                  resetCategoryForm();
                }}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}>
                {(createCategoryMutation.isPending || updateCategoryMutation.isPending) ? (
                  <span>Đang xử lý...</span>
                ) : selectedCategoryId ? (
                  <span>Cập nhật</span>
                ) : (
                  <span>Tạo mới</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Label Dialog */}
      <Dialog open={isLabelDialogOpen} onOpenChange={setIsLabelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedLabelId ? 'Chỉnh sửa Label' : 'Thêm mới Label'}
            </DialogTitle>
            <DialogDescription>
              {selectedLabelId
                ? 'Cập nhật thông tin cho label đã chọn'
                : 'Thêm mới một label vào hệ thống'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLabelSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="labelName">Tên label</Label>
                <Input
                  id="labelName"
                  placeholder="Nhập tên label (nhiều label cách nhau bởi dấu phẩy)"
                  value={labelForm.name}
                  onChange={(e) =>
                    setLabelForm({ ...labelForm, name: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ví dụ: AI, Blockchain, Cybersecurity sẽ tạo 3 label riêng biệt
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="labelCategory">Chọn category</Label>
                <Select
                  value={labelForm.categoryId === '' ? undefined : String(labelForm.categoryId)}
                  onValueChange={(value) =>
                    setLabelForm({
                      ...labelForm,
                      categoryId: parseInt(value, 10),
                    })
                  }
                >
                  <SelectTrigger id="labelCategory">
                    <SelectValue placeholder="Chọn category cho label" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="labelDescription">Mô tả</Label>
                <Textarea
                  id="labelDescription"
                  placeholder="Nhập mô tả cho label (không bắt buộc)"
                  value={labelForm.description}
                  onChange={(e) =>
                    setLabelForm({
                      ...labelForm,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsLabelDialogOpen(false);
                  resetLabelForm();
                }}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={createLabelMutation.isPending || updateLabelMutation.isPending}>
                {(createLabelMutation.isPending || updateLabelMutation.isPending) ? (
                  <span>Đang xử lý...</span>
                ) : selectedLabelId ? (
                  <span>Cập nhật</span>
                ) : (
                  <span>Tạo Label</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={isDeleteCategoryDialogOpen} onOpenChange={setIsDeleteCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa Category</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa category này? Hành động này không thể hoàn tác.
              <p className="mt-2 text-red-500 font-medium">
                Tất cả labels thuộc category này sẽ bị xóa!
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteCategoryDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (selectedCategoryId) {
                  deleteCategoryMutation.mutate(selectedCategoryId);
                }
              }}
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending ? 'Đang xử lý...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Label Dialog */}
      <Dialog open={isDeleteLabelDialogOpen} onOpenChange={setIsDeleteLabelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa Label</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa label này? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteLabelDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (selectedLabelId) {
                  deleteLabelMutation.mutate(selectedLabelId);
                }
              }}
              disabled={deleteLabelMutation.isPending}
            >
              {deleteLabelMutation.isPending ? 'Đang xử lý...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}