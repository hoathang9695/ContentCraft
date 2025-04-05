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
import { Loader2, CheckCircle, XCircle, Clock, Edit, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { UserEditDialog } from "@/components/UserEditDialog";

export default function UsersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<Omit<User, "password"> | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Redirect if not admin
  if (user && user.role !== "admin") {
    return <Redirect to="/" />;
  }

  // Fetch users
  const { data: users, isLoading } = useQuery<Omit<User, "password">[]>({
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
      const res = await apiRequest("PATCH", `/api/users/${userId}/status`, { status });
      return await res.json();
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

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 hover:bg-green-600 max-w-[140px] truncate">Active</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 max-w-[140px] truncate">Pending</Badge>;
      case "blocked":
        return <Badge className="bg-red-500 hover:bg-red-600 max-w-[140px] truncate">Blocked</Badge>;
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
          <h1 className="text-3xl font-bold mb-2">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts and approve new registrations
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
              { key: "status", header: "Trạng thái", 
                render: (row) => <StatusBadge status={row.status} /> 
              },
              { key: "actions", header: "Actions", 
                render: (row) => (
                  <div className="flex items-center space-x-2">
                    {row.status === "pending" && (
                      <>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-green-500 border-green-500 hover:bg-green-50 hover:text-green-600">
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
                            <Button variant="outline" size="sm" className="text-red-500 border-red-500 hover:bg-red-50 hover:text-red-600">
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
                          className="text-blue-500 border-blue-500 hover:bg-blue-50 hover:text-blue-600"
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
                            <Button variant="outline" size="sm" className="text-red-500 border-red-500 hover:bg-red-50 hover:text-red-600">
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
                          <Button variant="outline" size="sm" className="text-green-500 border-green-500 hover:bg-green-50 hover:text-green-600">
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