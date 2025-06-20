import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useDebounce } from "@/hooks/use-debounce";

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
import { AlertTriangle, Pencil, Trash, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from 'xlsx';
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
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  password: z.string().min(1, "Password là bắt buộc").optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).default("male"),
  status: z.enum(["active", "inactive"]).default("active"),
  description: z.string().optional(),
});

type FakeUser = {
  id: number;
  name: string;
  token: string;
  email?: string;
  password?: string;
  gender: "male" | "female" | "other";
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
  const [isUploading, setIsUploading] = useState(isUploading);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Debounce search query để tránh tìm kiếm quá nhiều
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Reset về trang 1 khi search query thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  // Truy vấn danh sách người dùng ảo với phân trang
  const { data: fakeUsersResponse, isLoading, error } = useQuery<{
    users: FakeUser[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ["/api/fake-users", currentPage, pageSize, debouncedSearchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        ...(debouncedSearchQuery && { search: debouncedSearchQuery })
      });

      console.log("Fetching fake users with params:", params.toString());

      const response = await fetch(`/api/fake-users?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Fake users API response:", data);

      return data;
    },
    enabled: isAdmin, // Chỉ kích hoạt truy vấn nếu là admin
    staleTime: 0, // Disable caching
    gcTime: 0, // Disable cache time
  });

  const fakeUsers = fakeUsersResponse?.users || [];
  const totalUsers = fakeUsersResponse?.total || 0;
  const totalPages = fakeUsersResponse?.totalPages || 1;

  // Hàm điều hướng phân trang
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Debug - In thông tin về user và API URL
  console.log("User info:", user);
  console.log("Is admin:", isAdmin);
  console.log("API URL:", window.location.origin + "/api/fake-users");

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

  // State để theo dõi user nào đang được cập nhật
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  // Mutation để cập nhật giới tính người dùng ảo
  const updateGenderMutation = useMutation({
    mutationFn: async ({ id, gender }: { id: number; gender: "male" | "female" | "other" }) => {
      const user = fakeUsers?.find(u => u.id === id);
      if (!user) throw new Error("User not found");

      setUpdatingUserId(id);

      return await apiRequest<FakeUser>("PUT", `/api/fake-users/${id}`, {
        ...user,
        gender
      });
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đã cập nhật giới tính",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fake-users"] });
      setUpdatingUserId(null);
    },
    onError: (error) => {
      console.error("Error updating gender:", error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật giới tính. Vui lòng thử lại.",
        variant: "destructive",
      });
      setUpdatingUserId(null);
    },
  });

  // Mutation để upload nhiều người dùng ảo từ Excel
  const bulkUploadFakeUsers = useMutation({
    mutationFn: async (users: Array<{ name: string; token: string }>) => {
      return await apiRequest<{ success: number; failed: number; errors: string[] }>("POST", "/api/fake-users/bulk-upload", { users });
    },
    onSuccess: (response) => {
      toast({
        title: "Upload thành công",
        description: `Đã thêm ${response.success} người dùng ảo. ${response.failed > 0 ? `Có ${response.failed} lỗi.` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fake-users"] });
      setIsUploading(false);
    },
    onError: (error) => {
      console.error("Error uploading fake users:", error);
      toast({
        title: "Lỗi upload",
        description: "Không thể upload file Excel. Vui lòng thử lại.",
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  // Form cho việc tạo/cập nhật người dùng ảo
  const form = useForm<z.infer<typeof fakeUserSchema>>({
    resolver: zodResolver(fakeUserSchema),
    defaultValues: {
      name: "",
      token: "",
      email: "",
      password: "",
      gender: "male_adult",
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
        email: user.email || "",
        password: user.password || "",
        gender: user.gender as "male" | "female" | "other",
        status: user.status as "active" | "inactive",
        description: user.description || "",
      });
      setSelectedUser(user);
    } else {
      // Create mode - reset form
      form.reset({
        name: "",
        token: "",
        email: "",
        password: "",
        gender: "male_adult",
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

  // Xử lý click vào tên user để mở tab mới đến trang login
  const handleUserLogin = (token: string, userName: string, email?: string, password?: string) => {
    try {
      // Copy thông tin đăng nhập vào clipboard
      const loginInfo = `Email: ${email || 'N/A'}\nPassword: ${password || 'N/A'}\nToken: ${token}`;
      navigator.clipboard.writeText(loginInfo).then(() => {
        console.log('Login info copied to clipboard');
      }).catch(() => {
        console.log('Could not copy login info to clipboard');
      });

      // Mở tab mới đến trang login của emso.vn
      const newTab = window.open('https://emso.vn/login', '_blank', 'noopener,noreferrer');

      if (!newTab || newTab.closed || typeof newTab.closed == 'undefined') {
        // Popup bị chặn
        toast({
          title: "Popup bị chặn",
          description: "Vui lòng cho phép popup và thử lại, hoặc mở https://emso.vn/login thủ công.",
          variant: "destructive",
        });
        return;
      }

      // Hiển thị thông báo thành công
      toast({
        title: "Đã mở trang đăng nhập",
        description: `Thông tin đăng nhập đã được copy vào clipboard: ${email || 'N/A'}`,
      });
    } catch (error) {
      console.error('Error in handleUserLogin:', error);
      toast({
        title: "Lỗi",
        description: "Không thể mở tab mới. Vui lòng kiểm tra popup blocker.",
        variant: "destructive",
      });
    }
  };

  // Xử lý upload file Excel
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Kiểm tra file Excel
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: "Lỗi file",
        description: "Vui lòng chọn file Excel (.xlsx hoặc .xls)",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Kiểm tra và xử lý header
        const headers = jsonData[0] as string[];
        console.log("Excel headers:", headers);

        // Tìm vị trí các cột
        const nameIndex = headers.findIndex(h => 
          h && (h.toLowerCase().includes('name') || h.toLowerCase().includes('tên') || h.toLowerCase().includes('họ tên'))
        );
        const tokenIndex = headers.findIndex(h => 
          h && h.toLowerCase().includes('token')
        );
        const emailIndex = headers.findIndex(h => 
          h && h.toLowerCase().includes('email')
        );
        const passwordIndex = headers.findIndex(h => 
          h && (h.toLowerCase().includes('password') || h.toLowerCase().includes('mật khẩu'))
        );

        console.log("Column indexes:", { nameIndex, tokenIndex, emailIndex, passwordIndex });

        if (nameIndex === -1 || tokenIndex === -1) {
          toast({
            title: "Lỗi định dạng file",
            description: "File Excel phải có ít nhất 2 cột: Name/Tên và Token",
            variant: "destructive",
          });
          setIsUploading(false);
          return;
        }

        // Bỏ qua dòng header và xử lý dữ liệu
        const users = (jsonData as any[][])
          .slice(1) // Bỏ dòng đầu (header)
          .filter(row => row[nameIndex] && row[tokenIndex]) // Chỉ lấy dòng có đủ name và token
          .map(row => {
            const userData: any = {
              name: String(row[nameIndex]).trim(),
              token: String(row[tokenIndex]).trim(),
            };

            // Thêm email nếu có
            if (emailIndex !== -1 && row[emailIndex]) {
              userData.email = String(row[emailIndex]).trim();
            }

            // Thêm password nếu có
            if (passwordIndex !== -1 && row[passwordIndex]) {
              userData.password = String(row[passwordIndex]).trim();
            }

            return userData;
          });

        console.log("Processed users:", users.slice(0, 3)); // Log 3 users đầu tiên để kiểm tra

        if (users.length === 0) {
          toast({
            title: "File trống",
            description: "Không tìm thấy dữ liệu hợp lệ trong file Excel",
            variant: "destructive",
          });
          setIsUploading(false);
          return;
        }

        // Gửi dữ liệu lên server
        bulkUploadFakeUsers.mutate(users);
      } catch (error) {
        console.error("Error reading Excel file:", error);
        toast({
          title: "Lỗi đọc file",
          description: "Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.",
          variant: "destructive",
        });
        setIsUploading(false);
      }
    };

    reader.readAsArrayBuffer(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
              <br />
              <small className="text-muted-foreground">
                File Excel cần có các cột: Name/Tên (bắt buộc), Token (bắt buộc), Email (tùy chọn), Password/Mật khẩu (tùy chọn)
              </small>
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Đang upload..." : "Upload Excel"}
            </Button>
            <Button variant="default" onClick={() => handleOpenDialog()}>
              Thêm người dùng ảo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Input */}
          <div className="mb-6">
            <div className="relative max-w-sm">
              <Input
                placeholder="Tìm kiếm theo tên, token hoặc mô tả..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-4"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
            {debouncedSearchQuery && (
              <p className="text-sm text-muted-foreground mt-2">
                Hiển thị {fakeUsers.length} / {totalUsers} kết quả cho "{debouncedSearchQuery}"
              </p>
            )}
          </div>
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
                    <TableHead>Email</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Giới tính</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fakeUsers && fakeUsers.length > 0 ? (
                    fakeUsers.map((user: FakeUser) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <button
                            onClick={() => handleUserLogin(user.token, user.name, user.email, user.password)}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                            title={`Click để đăng nhập với email: ${user.email || 'N/A'} và password: ${user.password || 'N/A'}`}
                          >
                            {user.name}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            {user.email ? (
                              <>
                                <span className="flex-1">{user.email}</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(user.email || '');
                                    toast({
                                      title: "Đã copy email",
                                      description: "Email đã được copy vào clipboard",
                                    });
                                  }}
                                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                  title="Copy email"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002 2h2a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <span className="text-gray-400">Chưa có</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {user.password ? (
                              <>
                                <span className="flex-1">••••••••</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(user.password || '');
                                    toast({
                                      title: "Đã copy password",
                                      description: "Password đã được copy vào clipboard",
                                    });
                                  }}
                                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                  title="Copy password"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002 2h2a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <span className="text-gray-400">Chưa có</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {user.token}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.gender}
                            onValueChange={(value: "male" | "female" | "other") => {
                              updateGenderMutation.mutate({ id: user.id, gender: value });
                            }}
                            disabled={updatingUserId === user.id}
                          >
                            <SelectTrigger className="w-24 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Nam</SelectItem>
                              <SelectItem value="female">Nữ</SelectItem>
                              <SelectItem value="other">Khác</SelectItem>
                            </SelectContent>
                          </Select>
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
                      <TableCell colSpan={6} className="h-24 text-center">
                        <div className="flex flex-col items-center justify-center text-sm text-muted-foreground">
                          <AlertTriangle className="mb-2 h-6 w-6" />
                          {debouncedSearchQuery ? 
                            `Không tìm thấy người dùng ảo nào với từ khóa "${debouncedSearchQuery}"` :
                            "Không có người dùng ảo nào. Hãy thêm mới để bắt đầu."
                          }
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Hiển thị {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalUsers)} của {totalUsers} người dùng ảo
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Trước
                </Button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNumber)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNumber}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  Sau
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Nhập email đăng nhập" {...field} />
                    </FormControl>
                    <FormDescription>
                      Email dùng để đăng nhập vào hệ thống bên ngoài.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Nhập mật khẩu đăng nhập" {...field} />
                    </FormControl>
                    <FormDescription>
                      Mật khẩu dùng để đăng nhập vào hệ thống bên ngoài.
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
                      <Input placeholder="Nhập token xác thực" {...This code modifies the default gender for the fake user form using react-hook-form.

field} />
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
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giới tính</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn giới tính" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Nam</SelectItem>
                        <SelectItem value="female">Nữ</SelectItem>
                        <SelectItem value="other">Khác</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Giới tính của người dùng ảo.
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