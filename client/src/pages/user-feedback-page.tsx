
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function UserFeedbackPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Xử lý phản hồi người dùng</h1>
          <p className="text-muted-foreground">
            Quản lý và xử lý phản hồi từ người dùng
          </p>
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          {/* Content will be implemented later */}
          <p>Tính năng đang được phát triển</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
