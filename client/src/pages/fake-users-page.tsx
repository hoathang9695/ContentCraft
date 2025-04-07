import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Pencil, Trash } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Schema định nghĩa dữ liệu của fake user
const fakeUserSchema = z.object({
  name: z.string().min(1, "Tên người dùng là bắt buộc"),
  token: z.string().min(1, "Token là bắt buộc"),
  status: z.enum(["active", "inactive"]).default("active"),
  description: z.string().optional(),
});

type FakeUser = {
  id: number;
  name: string;
  token: string;
  status: "active" | "inactive";
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export default function FakeUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<FakeUser | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Truy vấn danh sách người dùng ảo
  const { data: fakeUsers, isLoading, error } = useQuery<FakeUser[]>({
    queryKey: ["/api/fake-users"],
    enabled: isAdmin, // Chỉ kích hoạt truy vấn nếu là admin
  });
  
  // Xử lý lỗi từ truy vấn
  useEffect(() => {
    if (error) {
      toast({
        title: "Lỗi",
        description: "Bạn không có quyền truy cập trang này",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Mutation để tạo người dùng ảo mới
  const createFakeUser = useMutation({
    mutationFn: async (data: z.infer<typeof fakeUserSchema>) => {
      return await apiRequest<FakeUser>("POST", "/api/fake-users", data);
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đã tạo người dùng ảo mới",
      });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/fake-users"] });
    },
    onError: (error) => {
      console.error("Error creating fake user:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tạo người dùng ảo. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  // Mutation để cập nhật người dùng ảo
  const updateFakeUser = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: z.infer<typeof fakeUserSchema>;
    }) => {
      return await apiRequest<FakeUser>("PUT", `/api/fake-users/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đã cập nhật người dùng ảo",
      });
      setIsDialogOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ["/api/fake-users"] });
    },
    onError: (error) => {
      console.error("Error updating fake user:", error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật người dùng ảo. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  // Mutation để xóa người dùng ảo
  const deleteFakeUser = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest<void>("DELETE", `/api/fake-users/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đã xóa người dùng ảo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fake-users"] });
    },
    onError: (error) => {
      console.error("Error deleting fake user:", error);
      toast({
        title: "Lỗi",
        description: "Không thể xóa người dùng ảo. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  // Form cho việc tạo/cập nhật người dùng ảo
  const form = useForm<z.infer<typeof fakeUserSchema>>({
    resolver: zodResolver(fakeUserSchema),
    defaultValues: {
      name: "",
      token: "",
      status: "active",
      description: "",
    },
  });

  // Xử lý mở dialog và reset form
  const handleOpenDialog = (user: FakeUser | null = null) => {
    if (user) {
      // Edit mode - pre-fill form
      form.reset({
        name: user.name,
        token: user.token,
        status: user.status as "active" | "inactive",
        description: user.description || "",
      });
      setSelectedUser(user);
    } else {
      // Create mode - reset form
      form.reset({
        name: "",
        token: "",
        status: "active",
        description: "",
      });
      setSelectedUser(null);
    }
    setIsDialogOpen(true);
  };

  // Xử lý submit form
  const onSubmit = (values: z.infer<typeof fakeUserSchema>) => {
    if (selectedUser) {
      // Update mode
      updateFakeUser.mutate({ id: selectedUser.id, data: values });
    } else {
      // Create mode
      createFakeUser.mutate(values);
    }
  };

  // Nếu không phải admin thì hiển thị thông báo không có quyền
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Không có quyền truy cập</h2>
            <p className="text-muted-foreground">
              Bạn cần có quyền Admin để truy cập trang này.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Quản lý Người dùng ảo (Fake Users)</CardTitle>
            <CardDescription>
              Quản lý danh sách người dùng ảo để sử dụng cho việc gửi bình luận đến hệ thống bên ngoài
            </CardDescription>
          </div>
          <Button variant="default" onClick={() => handleOpenDialog()}>
            Thêm người dùng ảo
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            // Loading state
            <div className="space-y-4">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center space-x-4 rounded-md border p-4"
                  >
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            // Table of fake users
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fakeUsers && fakeUsers.length > 0 ? (
                    fakeUsers.map((user: FakeUser) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {user.token}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleOpenDialog(user)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="icon">
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Bạn có chắc chắn muốn xóa người dùng ảo này không? Hành động này không thể hoàn tác.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteFakeUser.mutate(user.id)}
                                  >
                                    Xóa
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        <div className="flex flex-col items-center justify-center text-sm text-muted-foreground">
                          <AlertTriangle className="mb-2 h-6 w-6" />
                          Không có người dùng ảo nào. Hãy thêm mới để bắt đầu.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for creating or editing fake users */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? "Cập nhật người dùng ảo" : "Thêm người dùng ảo mới"}
            </DialogTitle>
            <DialogDescription>
              Nhập thông tin chi tiết để {selectedUser ? "cập nhật" : "tạo"} người dùng ảo.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên người dùng</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập tên người dùng" {...field} />
                    </FormControl>
                    <FormDescription>
                      Tên này sẽ được hiển thị khi gửi bình luận.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập token xác thực" {...field} />
                    </FormControl>
                    <FormDescription>
                      Token này được sử dụng để xác thực với hệ thống bên ngoài.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trạng thái</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn trạng thái" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Hoạt động</SelectItem>
                        <SelectItem value="inactive">Không hoạt động</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Chỉ những người dùng ảo đang hoạt động mới được sử dụng.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mô tả (tùy chọn)</FormLabel>
                    <FormControl>
                      <Input placeholder="Mô tả về người dùng ảo này" {...field} />
                    </FormControl>
                    <FormDescription>
                      Thêm ghi chú hoặc thông tin bổ sung.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit" disabled={createFakeUser.isPending || updateFakeUser.isPending}>
                  {(createFakeUser.isPending || updateFakeUser.isPending) ? "Đang xử lý..." : selectedUser ? "Cập nhật" : "Tạo mới"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}