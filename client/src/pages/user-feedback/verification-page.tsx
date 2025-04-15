
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function VerificationPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="min-h-[400px] flex items-center justify-center">
          <Card className="w-full max-w-lg">
            <CardContent className="pt-6 text-center">
              <Construction className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
              <h1 className="text-2xl font-bold mb-2">Tính năng đang phát triển</h1>
              <p className="text-muted-foreground">
                Chúng tôi đang phát triển tính năng này. Vui lòng quay lại sau.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
