import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, User, Lock, Upload } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema for password change form
const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(6, {
      message: "Mật khẩu hiện tại phải có ít nhất 6 ký tự.",
    }),
    newPassword: z.string().min(6, {
      message: "Mật khẩu mới phải có ít nhất 6 ký tự.",
    }),
    confirmPassword: z.string().min(6, {
      message: "Xác nhận mật khẩu phải có ít nhất 6 ký tự.",
    }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu mới và xác nhận mật khẩu không khớp.",
    path: ["confirmPassword"],
  });

type PasswordChangeFormValues = z.infer<typeof passwordChangeSchema>;

// Schema for avatar upload form
const avatarUploadSchema = z.object({
  avatar: z.any()
    .refine((file) => file instanceof File, {
      message: "Vui lòng chọn một file ảnh.",
    })
    .refine((file) => file instanceof File && file.size <= 5 * 1024 * 1024, {
      message: "Kích thước file tối đa là 5MB.",
    })
    .refine(
      (file) => file instanceof File && ['image/jpeg', 'image/png', 'image/gif'].includes(file.type),
      {
        message: "Chỉ chấp nhận file ảnh (JPG, PNG, GIF).",
      }
    ),
});

type AvatarUploadFormValues = z.infer<typeof avatarUploadSchema>;

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change form
  const passwordForm = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Avatar upload form
  const avatarForm = useForm<AvatarUploadFormValues>({
    resolver: zodResolver(avatarUploadSchema),
    defaultValues: {
      avatar: undefined,
    },
  });

  // Password change mutation
  const passwordChangeMutation = useMutation({
    mutationFn: async (data: PasswordChangeFormValues) => {
      const res = await apiRequest("POST", "/api/user/change-password", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Mật khẩu đã được cập nhật",
        description: "Mật khẩu của bạn đã được thay đổi thành công.",
      });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật mật khẩu. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  // Avatar upload mutation
  const avatarUploadMutation = useMutation({
    mutationFn: async (data: AvatarUploadFormValues) => {
      const formData = new FormData();
      formData.append('avatar', data.avatar);
      
      const res = await fetch('/api/user/avatar/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Không thể tải lên avatar");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Avatar đã được cập nhật",
        description: "Avatar của bạn đã được tải lên thành công.",
      });
      // Update the user data in the cache
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setIsUpdatingAvatar(false);
      setPreviewUrl(null);
      
      // Reset the form
      avatarForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tải lên avatar. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  // Handle password form submission
  const onPasswordSubmit = (data: PasswordChangeFormValues) => {
    passwordChangeMutation.mutate(data);
  };

  // Handle avatar form submission
  const onAvatarSubmit = (data: AvatarUploadFormValues) => {
    avatarUploadMutation.mutate(data);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Update the form
      avatarForm.setValue("avatar", file, { shouldValidate: true });
      
      // Create a preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setIsUpdatingAvatar(true);
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  
  // Cancel avatar update
  const cancelAvatarUpdate = () => {
    avatarForm.reset();
    setIsUpdatingAvatar(false);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Generate avatar fallback (initials from user name)
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  if (!user) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-6">
          <h1 className="text-3xl font-bold mb-6">Thông tin cá nhân</h1>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Đang tải thông tin người dùng...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Thông tin cá nhân</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User profile overview card */}
          <Card className="col-span-1">
            <CardHeader className="flex flex-col items-center">
              <div className="relative mb-4">
                <Avatar className="w-32 h-32">
                  <AvatarImage src={user.avatarUrl || ""} alt={user.name} />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="sm"
                  className="absolute bottom-0 right-0 rounded-full w-8 h-8 p-0"
                  onClick={() => setActiveTab("avatar")}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-xl">{user.name}</CardTitle>
              <p className="text-muted-foreground">@{user.username}</p>
              <div className="mt-2 flex flex-col w-full items-center gap-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Email:</span> {user.email}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Phòng ban:</span>{" "}
                  {user.department || "Chưa có thông tin"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Vai trò:</span>{" "}
                  {user.position || "Chưa có thông tin"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Quyền hạn:</span>{" "}
                  <span className="capitalize">{user.role}</span>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Tabs for profile actions */}
          <Card className="col-span-1 md:col-span-2">
            <CardHeader>
              <CardTitle>Cài đặt tài khoản</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Hồ sơ
                  </TabsTrigger>
                  <TabsTrigger value="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Mật khẩu
                  </TabsTrigger>
                  <TabsTrigger value="avatar" className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Avatar
                  </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Tên người dùng</Label>
                      <Input value={user.username} disabled />
                      <p className="text-sm text-muted-foreground">
                        Tên người dùng không thể thay đổi.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={user.email} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Họ và tên</Label>
                      <Input value={user.name} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Phòng ban</Label>
                      <Input value={user.department || "Chưa có thông tin"} disabled />
                      <p className="text-sm text-muted-foreground">
                        Phòng ban được quản lý bởi quản trị viên.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Vai trò</Label>
                      <Input value={user.position || "Chưa có thông tin"} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Quyền hạn</Label>
                      <Input value={user.role} className="capitalize" disabled />
                    </div>
                  </div>
                </TabsContent>

                {/* Password Tab */}
                <TabsContent value="password">
                  <Form {...passwordForm}>
                    <form
                      onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mật khẩu hiện tại</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Nhập mật khẩu hiện tại"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mật khẩu mới</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Nhập mật khẩu mới"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Mật khẩu phải có ít nhất 6 ký tự.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Xác nhận mật khẩu mới</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Xác nhận mật khẩu mới"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={passwordChangeMutation.isPending}
                      >
                        {passwordChangeMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang cập nhật...
                          </>
                        ) : (
                          "Đổi mật khẩu"
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                {/* Avatar Tab */}
                <TabsContent value="avatar">
                  <Form {...avatarForm}>
                    <form
                      onSubmit={avatarForm.handleSubmit(onAvatarSubmit)}
                      className="space-y-4"
                    >
                      <div className="flex justify-center mb-4">
                        <Avatar className="w-32 h-32">
                          <AvatarImage
                            src={previewUrl || user.avatarUrl || ""}
                            alt={user.name}
                          />
                          <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      <div className="space-y-4">
                        <Label>Tải lên hình ảnh mới</Label>
                        <input
                          type="file"
                          className="hidden"
                          ref={fileInputRef}
                          accept="image/jpeg,image/png,image/gif"
                          onChange={handleFileChange}
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full flex items-center justify-center" 
                          onClick={triggerFileInput}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Chọn file ảnh
                        </Button>
                        <FormField
                          control={avatarForm.control}
                          name="avatar"
                          render={({ field }) => (
                            <FormItem className="hidden">
                              <FormControl>
                                <Input {...field} value={field.value?.name || ''} readOnly/>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {avatarForm.formState.errors.avatar && (
                          <p className="text-sm font-medium text-destructive">
                            {avatarForm.formState.errors.avatar.message?.toString()}
                          </p>
                        )}
                        
                        {isUpdatingAvatar && (
                          <p className="text-sm text-muted-foreground">
                            File đã chọn: {(avatarForm.getValues().avatar as File)?.name || 'Không có file nào'}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelAvatarUpdate}
                          disabled={avatarUploadMutation.isPending || !isUpdatingAvatar}
                        >
                          Hủy
                        </Button>
                        <Button
                          type="submit"
                          disabled={
                            avatarUploadMutation.isPending ||
                            !isUpdatingAvatar ||
                            !avatarForm.formState.isValid
                          }
                        >
                          {avatarUploadMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Đang tải lên...
                            </>
                          ) : (
                            "Lưu avatar"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}