
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface PageEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: any | null;
}

export function PageEditDialog({ open, onOpenChange, page }: PageEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [pageName, setPageName] = useState("");
  const [classification, setClassification] = useState("new");
  const [assignedToId, setAssignedToId] = useState<string>("unassigned");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [monetizationEnabled, setMonetizationEnabled] = useState(false);

  // Fetch editor users for assignment dropdown
  const { data: editorUsers } = useQuery<Array<{id: number, username: string, name: string}>>({
    queryKey: ['/api/editors'],
    queryFn: async () => {
      const response = await fetch('/api/editors');
      if (!response.ok) throw new Error('Failed to fetch editors');
      return response.json();
    },
    enabled: open
  });

  // Reset form when dialog opens/closes or page changes
  useEffect(() => {
    if (open && page) {
      const pageData = page.pageName;
      setPageName(pageData?.page_name || pageData?.name || "");
      setClassification(page.classification || "new");
      setAssignedToId(page.assignedToId ? page.assignedToId.toString() : "unassigned");
      setPhoneNumber(page.phoneNumber || "");
      setMonetizationEnabled(page.monetizationEnabled || false);
    } else if (!open) {
      // Reset form when dialog closes
      setPageName("");
      setClassification("new");
      setAssignedToId("unassigned");
      setPhoneNumber("");
      setMonetizationEnabled(false);
    }
  }, [open, page]);

  // Update page name mutation
  const updateNameMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await fetch(`/api/pages/${page.id}/name`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: data.name }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update page name");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
    },
  });

  // Update page classification mutation
  const updateClassificationMutation = useMutation({
    mutationFn: async (data: { classification: string }) => {
      const response = await fetch(`/api/pages/${page.id}/classification`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ classification: data.classification }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update classification");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
    },
  });

  // Update page assignment mutation
  const updateAssignmentMutation = useMutation({
    mutationFn: async (data: { assignedToId: number | null }) => {
      const response = await fetch(`/api/pages/${page.id}/assign`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assignedToId: data.assignedToId }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update assignment");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
    },
  });

  // Update page info mutation (phone and monetization)
  const updateInfoMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; monetizationEnabled: boolean }) => {
      const response = await fetch(`/api/pages/${page.id}/info`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update page info");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
    },
  });

  const handleSubmit = async () => {
    if (!page) return;

    try {
      // Create array of promises for concurrent updates
      const promises = [];

      // Update page name if changed
      const currentPageName = page.pageName?.page_name || page.pageName?.name || "";
      if (pageName.trim() !== currentPageName) {
        promises.push(updateNameMutation.mutateAsync({ name: pageName.trim() }));
      }

      // Update classification if changed
      if (classification !== (page.classification || "new")) {
        promises.push(updateClassificationMutation.mutateAsync({ classification }));
      }

      // Update assignment if changed
      const currentAssignedToId = page.assignedToId ? page.assignedToId.toString() : "unassigned";
      if (assignedToId !== currentAssignedToId) {
        const newAssignedToId = assignedToId === "unassigned" ? null : parseInt(assignedToId);
        promises.push(updateAssignmentMutation.mutateAsync({ assignedToId: newAssignedToId }));
      }

      // Update phone number and monetization if changed
      const currentPhoneNumber = page.phoneNumber || "";
      const currentMonetizationEnabled = page.monetizationEnabled || false;
      if (phoneNumber !== currentPhoneNumber || monetizationEnabled !== currentMonetizationEnabled) {
        promises.push(updateInfoMutation.mutateAsync({ 
          phoneNumber: phoneNumber.trim(), 
          monetizationEnabled 
        }));
      }

      // Execute all updates
      if (promises.length > 0) {
        await Promise.all(promises);
        
        toast({
          title: "Thành công",
          description: "Đã cập nhật thông tin trang thành công",
        });
        
        onOpenChange(false);
      } else {
        toast({
          title: "Thông báo",
          description: "Không có thay đổi nào để cập nhật",
        });
      }
    } catch (error) {
      console.error("Error updating page:", error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật thông tin trang. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

  const isLoading = updateNameMutation.isPending || 
                    updateClassificationMutation.isPending || 
                    updateAssignmentMutation.isPending || 
                    updateInfoMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cập nhật thông tin trang</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Page Name */}
          <div className="space-y-2">
            <Label htmlFor="pageName">Tên trang</Label>
            <Input
              id="pageName"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              placeholder="Nhập tên trang"
            />
          </div>

          {/* Classification */}
          <div className="space-y-2">
            <Label htmlFor="classification">Phân loại</Label>
            <Select value={classification} onValueChange={setClassification}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn phân loại" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Mới</SelectItem>
                <SelectItem value="potential">Tiềm năng</SelectItem>
                <SelectItem value="non_potential">Không tiềm năng</SelectItem>
                <SelectItem value="positive">Tích cực</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assigned To */}
          <div className="space-y-2">
            <Label htmlFor="assignedTo">Người quản lý</Label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn người quản lý" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Chưa phân công</SelectItem>
                {editorUsers?.map(editor => (
                  <SelectItem key={editor.id} value={editor.id.toString()}>
                    {editor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Số điện thoại</Label>
            <Input
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Nhập số điện thoại"
            />
          </div>

          {/* Monetization Enabled */}
          <div className="flex items-center space-x-2">
            <Switch
              id="monetizationEnabled"
              checked={monetizationEnabled}
              onCheckedChange={setMonetizationEnabled}
            />
            <Label htmlFor="monetizationEnabled">Bật kiếm tiền</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Đang cập nhật..." : "Cập nhật"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
