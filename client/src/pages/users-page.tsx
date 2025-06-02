import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CheckCircle, XCircle, Clock, Edit, MoreHorizontal, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { UserEditDialog } from "@/components/UserEditDialog";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

interface UserWithEmailPermission extends Omit<User, "password"> {
  can_send_email: boolean;
}

export default function UsersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithEmailPermission | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Redirect if not admin
  const shouldRedirect = user && user.role !== "admin";
  if (shouldRedirect) {
    return <Redirect to="/" />;
  }

  // Fetch users
  const { data: users, isLoading } = useQuery<UserWithEmailPermission[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  // Update user status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: string }) => {
      return await apiRequest("PATCH", `/api/users/${userId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Status updated",
        description: "User status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user status.",
        variant: "destructive",
      });
    },
  });

  // Toggle email permission mutation
  const toggleEmailPermissionMutation = useMutation({
    mutationFn: async ({ userId, canSendEmail }: { userId: number; canSendEmail: boolean }) => {
      const response = await fetch(`/api/users/${userId}/email-permission`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ can_send_email: canSendEmail }),
      });

      if (!response.ok) {
        throw new Error("Failed to update email permission");
      }

      return response.json();
    },
    onMutate: async ({ userId, canSendEmail }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/users"] });

      // Snapshot the previous value
      const previousUsers = queryClient.getQueryData<UserWithEmailPermission[]>(["/api/users"]);

      // Optimistically update to the new value
      if (previousUsers) {
        queryClient.setQueryData<UserWithEmailPermission[]>(["/api/users"], 
          previousUsers.map(user => 
            user.id === userId 
              ? { ...user, can_send_email: canSendEmail }
              : user
          )
        );
      }

      // Return a context object with the snapshotted value
      return { previousUsers };
    },
    onSuccess: (_, { canSendEmail }) => {
      toast({
        title: "Thành công",
        description: `Đã ${canSendEmail ? "cấp" : "thu hồi"} quyền gửi email`,
      });
    },
    onError: (error: Error, _, context) => {
      // Rollback on error
      if (context?.previousUsers) {
        queryClient.setQueryData(["/api/users"], context.previousUsers);
      }
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật quyền gửi email",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="text-green-700 bg-green-100 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800 max-w-[140px] truncate">Active</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-amber-700 bg-amber-100 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800 max-w-[140px] truncate">Pending</Badge>;
      case "blocked":
        return <Badge variant="outline" className="text-red-700 bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800 max-w-[140px] truncate">Blocked</Badge>;
      default:
        return <Badge className="max-w-[140px] truncate">{status}</Badge>;
    }
  };

  const handleApproveUser = (userId: number) => {
    updateStatusMutation.mutate({ userId, status: "active" });
  };

  const handleRejectUser = (userId: number) => {
    updateStatusMutation.mutate({ userId, status: "blocked" });
  };

  const handleToggleEmailPermission = (userId: number, currentValue: boolean) => {
    toggleEmailPermissionMutation.mutate({ userId, canSendEmail: !currentValue });
  };

  // Filter users based on search query
  const filteredUsers = users?.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.department && user.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.position && user.position.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout onSearch={setSearchQuery}>
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Quản lý người dùng</h1>
          <p className="text-muted-foreground">
            Quản lý tài khoản người dùng và phân quyền gửi email
          </p>
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          <DataTable
            data={filteredUsers || []}
            columns={[
              { key: "id", header: "ID" },
              { 
                key: "username", 
                header: "Username",
                className: "w-[150px]",
                render: (row) => (
                  <div className="max-w-[150px] truncate" title={row.username}>
                    {row.username}
                  </div>
                )
              },
              { 
                key: "name", 
                header: "Name",
                className: "w-[180px]",
                render: (row) => (
                  <div className="max-w-[180px] truncate" title={row.name}>
                    {row.name}
                  </div>
                )
              },
              { 
                key: "email", 
                header: "Email",
                className: "w-[220px]",
                render: (row) => (
                  <div className="max-w-[220px] truncate" title={row.email}>
                    {row.email}
                  </div>
                )
              },
              { 
                key: "department", 
                header: "Phòng ban", 
                className: "w-[180px]",
                render: (row) => (
                  <Badge 
                    variant="secondary" 
                    className="max-w-[180px] truncate" 
                    title={row.department || "N/A"}
                  >
                    {row.department || "N/A"}
                  </Badge>
                )
              },
              { 
                key: "position", 
                header: "Vai trò", 
                className: "w-[140px]",
                render: (row) => (
                  <Badge 
                    variant="outline" 
                    className="max-w-[140px] truncate" 
                    title={row.position || "N/A"}
                  >
                    {row.position || "N/A"}
                  </Badge>
                )
              },
              { 
                key: "role", 
                header: "Quyền hạn", 
                className: "w-[140px]",
                render: (row) => (
                  <Badge 
                    variant="outline" 
                    className="capitalize max-w-[140px] truncate" 
                    title={row.role}
                  >
                    {row.role}
                  </Badge>
                )
              },
              { 
                key: "status", 
                header: "Trạng thái", 
                render: (row) => <StatusBadge status={row.status} /> 
              },
              {
                key: "can_send_email",
                header: "Quyền gửi Email",
                render: (row) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={Boolean(row.can_send_email)}
                      onCheckedChange={() =>
                        handleToggleEmailPermission(row.id, Boolean(row.can_send_email))
                      }
                      disabled={toggleEmailPermissionMutation.isPending}
                    />
                    <div className="flex items-center">
                      {row.can_send_email ? (
                        <Mail className="h-4 w-4 text-green-500" />
                      ) : (
                        <Mail className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                ),
              },
              { 
                key: "actions", 
                header: "Actions", 
                render: (row) => (
                  <div className="flex items-center space-x-2">
                    {row.status === "pending" && (
                      <>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Approve User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to approve {row.name}? They will have full access to the system.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleApproveUser(row.id)}>
                                {updateStatusMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                )}
                                Approve
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 border-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950">
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reject User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to reject {row.name}? They will be blocked from accessing the system.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRejectUser(row.id)}>
                                {updateStatusMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <XCircle className="h-4 w-4 mr-1" />
                                )}
                                Reject
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    {row.status === "active" && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950"
                          onClick={() => {
                            setSelectedUser(row);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 border-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950">
                              <XCircle className="h-4 w-4 mr-1" />
                              Block
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Block User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to block {row.name}? They will no longer be able to access the system.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRejectUser(row.id)}>
                                {updateStatusMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <XCircle className="h-4 w-4 mr-1" />
                                )}
                                Block
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    {row.status === "blocked" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Unblock
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Unblock User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to unblock {row.name}? They will be able to access the system again.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleApproveUser(row.id)}>
                              {updateStatusMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-1" />
                              )}
                              Unblock
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                ) 
              },
            ]}
            isLoading={isLoading}
            searchable
            searchPlaceholder="Search users..."
            onSearch={setSearchQuery}
            searchValue={searchQuery}
          />

          {/* Show empty state if no users */}
          {filteredUsers && filteredUsers.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No users found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? "Try a different search term" : "No users have registered yet"}
              </p>
            </div>
          )}

          {/* Show loading state */}
          {isLoading && (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>
      </div>

      {/* User edit dialog */}
      <UserEditDialog 
        open={editDialogOpen} 
        user={selectedUser} 
        onOpenChange={setEditDialogOpen} 
      />
    </DashboardLayout>
  );
}