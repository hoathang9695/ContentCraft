
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Eye, MoreHorizontal, Mail } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SupportRequest {
  id: number;
  fullName: string;
  email: string;
  subject: string;
  content: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'completed';
}

export default function SupportPage() {
  const { data: supportRequests = [], isLoading } = useQuery<SupportRequest[]>({
    queryKey: ['/api/support-requests'],
  });

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Yêu cầu hỗ trợ</h1>
          <p className="text-muted-foreground">
            Quản lý các yêu cầu hỗ trợ từ người dùng
          </p>
        </div>

        <div className="bg-card rounded-lg shadow">
          <DataTable
            data={supportRequests}
            isLoading={isLoading}
            searchable
            searchPlaceholder="Tìm kiếm yêu cầu..."
            columns={[
              {
                key: 'id',
                header: 'ID',
                render: (row: SupportRequest) => (
                  <div className="font-medium">#{row.id}</div>
                ),
              },
              {
                key: 'fullName',
                header: 'Họ và tên',
                render: (row: SupportRequest) => (
                  <div className="font-medium">{row.fullName}</div>
                ),
              },
              {
                key: 'email',
                header: 'Email',
                render: (row: SupportRequest) => (
                  <div className="text-muted-foreground">{row.email}</div>
                ),
              },
              {
                key: 'subject',
                header: 'Chủ đề',
                render: (row: SupportRequest) => (
                  <div className="font-medium">{row.subject}</div>
                ),
              },
              {
                key: 'content',
                header: 'Nội dung',
                render: (row: SupportRequest) => (
                  <div className="truncate max-w-[300px]">{row.content}</div>
                ),
              },
              {
                key: 'actions',
                header: 'Hành động',
                className: 'text-right',
                render: (row: SupportRequest) => (
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          <span>Xem chi tiết</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="mr-2 h-4 w-4" />
                          <span>Gửi phản hồi</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
