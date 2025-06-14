
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

// Define the schema for the form
const realUserUpdateSchema = z.object({
  fullName: z.string().min(1, "Họ và tên là bắt buộc"),
  classification: z.string().optional(),
  assignedToId: z.string().optional(),
  verified: z.string().optional(),
});

type RealUserUpdateFormValues = z.infer<typeof realUserUpdateSchema>;

interface RealUser {
  id: number;
  fullName: {
    id: string;
    name: string;
  };
  email: string;
  verified: string;
  classification: string;
  assignedToId: number | null;
  processor?: {
    id: number;
    name: string;
    username: string;
  };
}

interface RealUserEditDialogProps {
  open: boolean;
  user: RealUser | null;
  onOpenChange: (open: boolean) => void;
}

export function RealUserEditDialog({ open, user, onOpenChange }: RealUserEditDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch editor users
  const { data: editorUsers } = useQuery<Array<{id: number, username: string, name: string}>>({
    queryKey: ['/api/editors'],
    queryFn: async () => {
      const response = await fetch('/api/editors');
      if (!response.ok) throw new Error('Failed to fetch editors');
      return response.json();
    }
  });

  // Set up the form with user data
  const form = useForm<RealUserUpdateFormValues>({
    resolver: zodResolver(realUserUpdateSchema),
    values: {
      fullName: user?.fullName?.name || "",
      classification: user?.classification || "new",
      assignedToId: user?.assignedToId?.toString() || "",
      verified: user?.verified || "unverified",
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: RealUserUpdateFormValues) => {
      if (!user) throw new Error("No user selected");
      
      // Update full name
      const nameResponse = await fetch(`/api/real-users/${user.id}/name`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: data.fullName }),
      });

      if (!nameResponse.ok) {
        throw new Error("Failed to update user name");
      }

      // Update classification
      if (data.classification) {
        const classificationResponse = await fetch(`/api/real-users/${user.id}/classification`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ classification: data.classification }),
        });

        if (!classificationResponse.ok) {
          throw new Error("Failed to update classification");
        }
      }

      // Update assignment
      if (data.assignedToId) {
        const assignmentResponse = await fetch(`/api/real-users/${user.id}/assign`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ assignedToId: parseInt(data.assignedToId) }),
        });

        if (!assignmentResponse.ok) {
          throw new Error("Failed to update assignment");
        }
      }

      // Update verification status
      if (data.verified) {
        const verificationResponse = await fetch(`/api/real-users/${user.id}/verification`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ verified: data.verified }),
        });

        if (!verificationResponse.ok) {
          throw new Error("Failed to update verification status");
        }
      }

      return { message: "User updated successfully" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/real-users"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật thông tin người dùng thành công",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật thông tin người dùng",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: RealUserUpdateFormValues) => {
    try {
      setIsSubmitting(true);
      await updateUserMutation.mutateAsync(data);
    } catch (error) {
      // Handle error silently
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl">Cập nhật thông tin người dùng</DialogTitle>
          <DialogDescription className="mt-1.5">
            Cập nhật thông tin cho người dùng {user?.fullName?.name}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Họ và tên</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nhập họ và tên" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="classification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phân loại</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn phân loại" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="new">Mới</SelectItem>
                      <SelectItem value="potential">Tiềm năng</SelectItem>
                      <SelectItem value="non_potential">Không tiềm năng</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignedToId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Người phê duyệt</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn người phê duyệt" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Chưa phân công</SelectItem>
                      {editorUsers?.map(editor => (
                        <SelectItem key={editor.id} value={editor.id.toString()}>
                          {editor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="verified"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trạng thái xác minh</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn trạng thái" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unverified">Chưa xác minh</SelectItem>
                      <SelectItem value="verified">Đã xác minh</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-8">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  "Lưu thay đổi"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
