
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Download, Users, FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface RealUser {
  id: number;
  fullName: {
    id: string;
    name: string;
  };
  email: string;
  verified: string;
  classification: string;
  lastLogin: string;
  createdAt: string;
  assignedToId: number;
  processor?: {
    id: number;
    name: string;
    username: string;
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedClassification, setSelectedClassification] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  // Redirect if not admin
  if (user && user.role !== "admin") {
    return <Redirect to="/" />;
  }

  // Fetch real users data for export
  const { data: realUsersData, isLoading } = useQuery<{ data: RealUser[]; total: number }>({
    queryKey: ["/api/real-users", "export", selectedClassification],
    queryFn: async () => {
      let url = "/api/real-users?limit=10000"; // Get all users for export
      if (selectedClassification !== "all") {
        url += `&classification=${selectedClassification}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch real users");
      return res.json();
    },
  });

  const handleExportExcel = async () => {
    if (!realUsersData?.data || realUsersData.data.length === 0) {
      toast({
        title: "Không có dữ liệu",
        description: "Không có người dùng nào để export.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      // Prepare data for Excel
      const exportData = realUsersData.data.map((user, index) => ({
        "STT": index + 1,
        "ID": user.id,
        "Tên đầy đủ": user.fullName?.name || "N/A",
        "Email": user.email,
        "Trạng thái xác minh": user.verified === "verified" ? "Đã xác minh" : "Chưa xác minh",
        "Phân loại": user.classification === "new" ? "Mới" : 
                    user.classification === "processed" ? "Đã xử lý" :
                    user.classification === "verified" ? "Đã xác minh" : user.classification,
        "Người xử lý": user.processor?.name || "Chưa phân công",
        "Đăng nhập cuối": user.lastLogin ? format(new Date(user.lastLogin), 'dd/MM/yyyy HH:mm:ss') : "Chưa đăng nhập",
        "Ngày tạo": format(new Date(user.createdAt), 'dd/MM/yyyy HH:mm:ss'),
        "Facebook ID": user.fullName?.id || "N/A"
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 5 },   // STT
        { wch: 8 },   // ID
        { wch: 25 },  // Tên đầy đủ
        { wch: 30 },  // Email
        { wch: 15 },  // Trạng thái xác minh
        { wch: 12 },  // Phân loại
        { wch: 20 },  // Người xử lý
        { wch: 20 },  // Đăng nhập cuối
        { wch: 20 },  // Ngày tạo
        { wch: 20 }   // Facebook ID
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      const sheetName = selectedClassification === "all" ? 
        "Tất cả người dùng" : 
        `Người dùng ${selectedClassification === "new" ? "mới" : 
                     selectedClassification === "processed" ? "đã xử lý" :
                     selectedClassification === "verified" ? "đã xác minh" : selectedClassification}`;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Generate filename with timestamp
      const timestamp = format(new Date(), 'ddMMyyyy_HHmmss');
      const filename = `nguoi_dung_that_${selectedClassification}_${timestamp}.xlsx`;

      // Export file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export thành công",
        description: `Đã export ${exportData.length} người dùng ra file ${filename}`,
      });

    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Lỗi export",
        description: "Có lỗi xảy ra khi export dữ liệu. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Quản lý hệ thống</h1>
          <p className="text-muted-foreground">
            Các công cụ quản trị và export dữ liệu
          </p>
        </div>

        {/* Export Real Users Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Export người dùng thật
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="classification">Phân loại người dùng</Label>
                <Select 
                  value={selectedClassification} 
                  onValueChange={setSelectedClassification}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn phân loại" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="new">Mới</SelectItem>
                    <SelectItem value="processed">Đã xử lý</SelectItem>
                    <SelectItem value="verified">Đã xác minh</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Số lượng</Label>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary">
                    {isLoading ? "Đang tải..." : `${realUsersData?.total || 0} người dùng`}
                  </Badge>
                </div>
              </div>

              <Button 
                onClick={handleExportExcel}
                disabled={isExporting || isLoading || !realUsersData?.data?.length}
                className="w-full md:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Đang export..." : "Export Excel"}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>File Excel sẽ bao gồm các thông tin: STT, ID, Tên đầy đủ, Email, Trạng thái xác minh, Phân loại, Người xử lý, Đăng nhập cuối, Ngày tạo, Facebook ID</p>
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>Thông tin hệ thống</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Phiên bản</Label>
                <p className="text-sm text-muted-foreground">v1.0.0</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Người dùng hiện tại</Label>
                <p className="text-sm text-muted-foreground">{user?.name} ({user?.username})</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
