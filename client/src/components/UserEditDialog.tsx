import { useState } from "react";
import { User } from "@shared/schema";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Lock, Copy } from "lucide-react";

// Define the schema for the form
const userUpdateSchema = z.object({
  department: z.string().optional(),
  position: z.string().optional(),
  role: z.string().optional(),
});

type UserUpdateFormValues = z.infer<typeof userUpdateSchema>;

interface UserEditDialogProps {
  open: boolean;
  user: Omit<User, "password"> | null;
  onOpenChange: (open: boolean) => void;
}

export function UserEditDialog({ open, user, onOpenChange }: UserEditDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newPassword, setNewPassword] = useState<string>("");

  // Set up the form with user data
  const form = useForm<UserUpdateFormValues>({
    resolver: zodResolver(userUpdateSchema),
    values: {
      department: user?.department || "",
      position: user?.position || "",
      role: user?.role || "",
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: UserUpdateFormValues) => {
      if (!user) throw new Error("No user selected");
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User updated",
        description: "User details have been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update user details.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });
  
  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user selected");
      const res = await apiRequest("DELETE", `/api/users/${user.id}`);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User deleted",
        description: data.message || "User has been deleted successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete user.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  const onSubmit = (data: UserUpdateFormValues) => {
    setIsSubmitting(true);
    updateUserMutation.mutate(data);
  };
  
  const handleDeleteUser = () => {
    setIsDeleting(true);
    deleteUserMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl">Edit User</DialogTitle>
          <DialogDescription className="mt-1.5">
            Update the department, position, and role for {user?.name}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phòng ban</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn phòng ban" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Chăm sóc khách hàng">Chăm sóc khách hàng</SelectItem>
                      <SelectItem value="Kinh doanh">Kinh doanh</SelectItem>
                      <SelectItem value="Kế toán">Kế toán</SelectItem>
                      <SelectItem value="Lập trình viên">Lập trình viên</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vai trò</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn vai trò" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Nhân viên">Nhân viên</SelectItem>
                      <SelectItem value="Trưởng phòng">Trưởng phòng</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quyền hạn</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn quyền hạn" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-4 mt-4 mb-6">
              <div className="flex items-center space-x-2">
                <Button 
                  type="button" 
                  variant="secondary"
                  className="flex items-center justify-center gap-2"
                  onClick={async () => {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    const randomPass = Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                    
                    try {
                      // Update password in database
                      const response = await fetch(`/api/users/${user.id}/reset-password`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ newPassword: randomPass })
                      });

                      if (!response.ok) {
                        throw new Error('Failed to update password');
                      }

                      setNewPassword(randomPass);
                      toast({
                        title: "Password Reset",
                        description: "New password has been set successfully",
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to reset password",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Lock className="h-4 w-4" />
                  Reset Pass
                </Button>
                {newPassword && (
                  <div className="flex items-center bg-muted px-3 py-1 rounded-md">
                    <span className="mr-2 text-sm font-mono">{newPassword}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(newPassword);
                        toast({
                          title: "Copied",
                          description: "Password copied to clipboard",
                        });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-8">
              <div className="grid grid-cols-2 gap-4 w-full">
                {user && user.id !== 1 ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        type="button" 
                        variant="destructive"
                        className="flex items-center justify-center"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Bạn có chắc chắn muốn xóa người dùng này?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Người dùng <b>{user?.name}</b> sẽ bị xóa khỏi hệ thống. Các nội dung mà họ đang xử lý 
                          sẽ được phân công lại cho những người dùng khác có cùng vai trò và phòng ban.
                          <p className="mt-2 text-destructive font-semibold">Hành động này không thể khôi phục lại!</p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteUser} disabled={isDeleting}>
                          {isDeleting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Đang xóa...
                            </>
                          ) : (
                            "Xác nhận xóa"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <div /> 
                )}
                
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}