
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

export default function RealUserPage() {
  const { user } = useAuth();

  // Redirect if not admin
  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-4">
          <div className="text-center">
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
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Quản lý người dùng thật</h1>
          <p className="text-muted-foreground">
            Quản lý danh sách người dùng thật trong hệ thống
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
