
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DataTable } from "@/components/ui/data-table";

interface Category {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
  });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      console.log("Fetching from queryKey:", "/api/categories");
      const response = await fetch("/api/categories", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      console.log("API Response status:", response.status);
      return response.json();
    },
  });

  // Filter categories based on search query
  const filteredCategories = categories.filter((category: Category) =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Mutations for categories
  const createCategoryMutation = useMutation({
    mutationFn: async (newCategory: { name: string; description?: string }) => {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newCategory),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create category");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsCategoryDialogOpen(false);
      setCategoryFormData({ name: "", description: "" });
      toast({ title: "Success", description: "Category created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...categoryData }: { id: number; name: string; description?: string }) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(categoryData),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update category");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryFormData({ name: "", description: "" });
      toast({ title: "Success", description: "Category updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete category");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Success", description: "Category deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Category handlers
  const handleCreateCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({ name: "", description: "" });
    setIsCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || "",
    });
    setIsCategoryDialogOpen(true);
  };

  const handleCategorySubmit = () => {
    if (!categoryFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }

    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        ...categoryFormData,
      });
    } else {
      createCategoryMutation.mutate(categoryFormData);
    }
  };

  const handleDeleteCategory = (id: number) => {
    deleteCategoryMutation.mutate(id);
  };

  // Table columns configuration
  const columns = [
    {
      key: "id",
      header: "ID",
      render: (category: Category) => (
        <span className="font-mono text-sm">{category.id}</span>
      ),
      className: "w-16",
    },
    {
      key: "name",
      header: "Tên Category",
      render: (category: Category) => (
        <span className="font-semibold">{category.name}</span>
      ),
    },
    {
      key: "description",
      header: "Mô tả",
      render: (category: Category) => (
        <span className="text-gray-600">
          {category.description || "Không có mô tả"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Ngày tạo",
      render: (category: Category) => (
        <span className="text-sm text-gray-500">
          {new Date(category.createdAt).toLocaleDateString("vi-VN")}
        </span>
      ),
      className: "w-32",
    },
    {
      key: "actions",
      header: "Thao tác",
      render: (category: Category) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditCategory(category)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xóa Category</AlertDialogTitle>
                <AlertDialogDescription>
                  Bạn có chắc chắn muốn xóa category "{category.name}"? Hành động này không thể hoàn tác.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => handleDeleteCategory(category.id)}
                >
                  Xóa
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
      className: "w-32",
    },
  ];

  if (categoriesError) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-screen text-red-500">
          Error: {categoriesError?.message || "Something went wrong"}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quản lý Categories</h1>
            <p className="text-muted-foreground">
              Quản lý danh mục nội dung ({categories.length} categories)
            </p>
          </div>
          <Button onClick={handleCreateCategory}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm Category
          </Button>
        </div>

        {/* Categories Table */}
        <DataTable
          data={filteredCategories}
          columns={columns}
          isLoading={categoriesLoading}
          searchable={true}
          searchPlaceholder="Tìm kiếm category..."
          searchValue={searchQuery}
          onSearch={setSearchQuery}
          pagination={true}
          pageSize={20}
        />

        {/* Category Dialog */}
        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Chỉnh sửa Category" : "Thêm Category mới"}
              </DialogTitle>
              <DialogDescription>
                {editingCategory 
                  ? "Thay đổi thông tin category tại đây." 
                  : "Tạo category mới. Nhấn lưu khi hoàn thành."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="category-name">Tên Category</Label>
                <Input
                  id="category-name"
                  value={categoryFormData.name}
                  onChange={(e) =>
                    setCategoryFormData({ ...categoryFormData, name: e.target.value })
                  }
                  placeholder="Nhập tên category"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category-description">Mô tả</Label>
                <Textarea
                  id="category-description"
                  value={categoryFormData.description}
                  onChange={(e) =>
                    setCategoryFormData({ ...categoryFormData, description: e.target.value })
                  }
                  placeholder="Nhập mô tả category (tùy chọn)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleCategorySubmit}
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
              >
                {createCategoryMutation.isPending || updateCategoryMutation.isPending
                  ? "Đang lưu..."
                  : editingCategory
                  ? "Cập nhật Category"
                  : "Tạo Category"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
