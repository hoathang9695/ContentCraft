import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Download, Users, FileSpreadsheet, Mail, Settings } from "lucide-react";
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

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClassification, setSelectedClassification] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [smtpConfig, setSMTPConfig] = useState<SMTPConfig>({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    user: "",
    password: "",
    fromName: "",
    fromEmail: ""
  });

  const [testEmail, setTestEmail] = useState("");

  // Redirect if not admin
  if (user && user.role !== "admin") {
    return <Redirect to="/" />;
  }

  // Fetch real users data for export
  const { data: realUsersData, isLoading } = useQuery<{ data: RealUser[]; pagination: { total: number } }>({
    queryKey: ["/api/real-users", "export", selectedClassification],
    queryFn: async () => {
      let url = "/api/real-users?limit=10000"; // Get all users for export
      if (selectedClassification !== "all") {
        // Map UI classification to database field values
        if (selectedClassification === "verified") {
          url += `&verificationStatus=verified`;
        } else {
          url += `&classification=${selectedClassification}`;
        }
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch real users");
      return res.json();
    },
  });

  // Fetch SMTP configuration
  const { data: smtpData, isLoading: isLoadingSMTP } = useQuery<SMTPConfig>({
    queryKey: ["/api/smtp-config"],
    queryFn: async () => {
      const res = await fetch("/api/smtp-config");
      if (!res.ok) throw new Error("Failed to fetch SMTP config");
      const data = await res.json();
      setSMTPConfig(data);
      return data;
    },
  });

  // Update SMTP configuration mutation
  const updateSMTPMutation = useMutation({
    mutationFn: async (config: SMTPConfig) => {
      const res = await fetch("/api/smtp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to update SMTP config");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Cấu hình SMTP đã được cập nhật",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/smtp-config"] });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật cấu hình SMTP",
        variant: "destructive",
      });
    },
  });

  // Test SMTP configuration mutation
  const testSMTPMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/smtp-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail: testEmail || user?.username + "@test.com" }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to test SMTP");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Test thành công",
        description: `Email test đã được gửi thành công đến: ${testEmail || user?.username + "@test.com"}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Test thất bại",
        description: error.message || "Không thể gửi email test. Vui lòng kiểm tra cấu hình.",
        variant: "destructive",
      });
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
                    user.classification === "potential" ? "Tiềm năng" :
                    user.classification === "non_potential" ? "Không tiềm năng" : 
                    user.verified === "verified" ? "Đã xác minh" : user.classification,
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
                     selectedClassification === "potential" ? "tiềm năng" :
                     selectedClassification === "non_potential" ? "không tiềm năng" :
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

  const handleSMTPConfigChange = (field: keyof SMTPConfig, value: string | number | boolean) => {
    setSMTPConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveSMTPConfig = () => {
    updateSMTPMutation.mutate(smtpConfig);
  };

  const handleTestSMTP = () => {
    testSMTPMutation.mutate();
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
                    <SelectItem value="potential">Tiềm năng</SelectItem>
                    <SelectItem value="non_potential">Không tiềm năng</SelectItem>
                    <SelectItem value="verified">Đã xác minh</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Số lượng</Label>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary">
                    {isLoading ? "Đang tải..." : `${realUsersData?.pagination?.total || 0} người dùng`}
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

        {/* SMTP Configuration Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Cấu hình SMTP Email (Gmail)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-host">SMTP Host</Label>
                <Input
                  id="smtp-host"
                  value={smtpConfig.host}
                  onChange={(e) => handleSMTPConfigChange('host', e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-port">Port</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  value={smtpConfig.port}
                  onChange={(e) => handleSMTPConfigChange('port', parseInt(e.target.value))}
                  placeholder="587"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-user">Gmail Email</Label>
                <Input
                  id="smtp-user"
                  type="email"
                  value={smtpConfig.user}
                  onChange={(e) => handleSMTPConfigChange('user', e.target.value)}
                  placeholder="your-email@gmail.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-password">App Password</Label>
                <Input
                  id="smtp-password"
                  type="password"
                  value={smtpConfig.password}
                  onChange={(e) => handleSMTPConfigChange('password', e.target.value)}
                  placeholder="Gmail App Password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="from-name">Tên người gửi</Label>
                <Input
                  id="from-name"
                  value={smtpConfig.fromName}
                  onChange={(e) => handleSMTPConfigChange('fromName', e.target.value)}
                  placeholder="EMSO System"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="from-email">Email người gửi</Label>
                <Input
                  id="from-email"
                  type="email"
                  value={smtpConfig.fromEmail}
                  onChange={(e) => handleSMTPConfigChange('fromEmail', e.target.value)}
                  placeholder="noreply@emso.vn"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex gap-2">
                <Button 
                  onClick={handleSaveSMTPConfig}
                  disabled={updateSMTPMutation.isPending}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {updateSMTPMutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}
                </Button>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Email test (để trống sẽ dùng email mặc định)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Input
                      id="test-email"
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder={`tubn@emso.vn`}
                    />
                  </div>

                  <Button 
                    variant="outline"
                    onClick={handleTestSMTP}
                    disabled={testSMTPMutation.isPending || !smtpConfig.user || !smtpConfig.password}
                    className="w-full md:w-auto"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {testSMTPMutation.isPending ? "Đang test..." : "Test gửi email"}
                  </Button>

                  <div className="text-sm text-muted-foreground">
                    Email test sẽ được gửi đến: <strong>{testEmail || `tubn@emso.vn`}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md">
              <p className="font-medium mb-2">Hướng dẫn cấu hình Gmail:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li><strong>Bật xác thực 2 bước</strong>: Google Account → Security → 2-Step Verification</li>
                <li><strong>Tạo App Password</strong>: Google Account → Security → App passwords → Select app: Mail → Generate</li>
                <li><strong>Sao chép App Password</strong> (16 ký tự) và dán vào ô "App Password" ở trên</li>
                <li><strong>Sử dụng email Gmail</strong> của bạn trong ô "Gmail Email"</li>
                <li><strong>Port 587</strong> với TLS (không phải SSL)</li>
              </ol>
              <p className="mt-2 text-amber-600"><strong>Lưu ý:</strong> App Password khác với mật khẩu Gmail thường!</p>
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