
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfMonth } from "date-fns";
import { useState } from "react";
import { Users, CheckCircle, AlertCircle } from "lucide-react";

export default function UserFeedbackPage() {
  const today = new Date();
  const firstDayOfMonth = startOfMonth(today);
  const [dateRange, setDateRange] = useState({
    from: firstDayOfMonth,
    to: today,
  });

  const { data: supportRequests = [] } = useQuery({
    queryKey: ['/api/support-requests', dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.from) params.append('startDate', dateRange.from.toISOString());
      if (dateRange.to) params.append('endDate', dateRange.to.toISOString());
      const response = await fetch(`/api/support-requests?${params}`);
      if (!response.ok) throw new Error('Failed to fetch support requests');
      return response.json();
    },
  });

  const stats = {
    total: supportRequests.length,
    completed: supportRequests.filter(req => req.status === 'completed').length,
    pending: supportRequests.filter(req => req.status === 'pending').length,
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Xử lý phản hồi người dùng</h1>
            <p className="text-muted-foreground mt-1">
              Quản lý và theo dõi phản hồi từ người dùng
            </p>
          </div>
          <DatePickerWithRange 
            date={dateRange}
            onDateChange={setDateRange}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng số yêu cầu</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                Tính từ {format(dateRange.from || today, 'dd/MM/yyyy')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Đã xử lý</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">
                {((stats.completed / stats.total) * 100).toFixed(1)}% tổng số yêu cầu
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chưa xử lý</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">
                {((stats.pending / stats.total) * 100).toFixed(1)}% tổng số yêu cầu
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách yêu cầu</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Content will be implemented in next phase */}
            <p className="text-muted-foreground">Tính năng đang được phát triển</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
