
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface GroupEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: any;
  onSuccess: () => void;
}

export function GroupEditDialog({ open, onOpenChange, group, onSuccess }: GroupEditDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    groupName: "",
    classification: "new",
    assignedToId: null as number | null,
    phoneNumber: "",
    monetizationEnabled: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch editor users for assignment
  const { data: editorUsers } = useQuery<Array<{id: number, username: string, name: string}>>({
    queryKey: ['/api/editors'],
    queryFn: async () => {
      const response = await fetch('/api/editors');
      if (!response.ok) throw new Error('Failed to fetch editors');
      return response.json();
    }
  });

  useEffect(() => {
    if (group) {
      const groupName = group.groupName?.group_name || group.groupName?.name || "";
      setFormData({
        groupName,
        classification: group.classification || "new",
        assignedToId: group.assignedToId || null,
        phoneNumber: group.phoneNumber || "",
        monetizationEnabled: group.monetizationEnabled || false
      });
    }
  }, [group]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Update group name
      if (formData.groupName !== (group.groupName?.group_name || group.groupName?.name || "")) {
        const nameResponse = await fetch(`/api/groups/${group.id}/name`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formData.groupName }),
        });

        if (!nameResponse.ok) {
          throw new Error("Failed to update group name");
        }
      }

      // Update classification
      if (formData.classification !== group.classification) {
        const classificationResponse = await fetch(`/api/groups/${group.id}/classification`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classification: formData.classification }),
        });

        if (!classificationResponse.ok) {
          throw new Error("Failed to update classification");
        }
      }

      // Update assignment
      if (formData.assignedToId !== group.assignedToId) {
        const assignResponse = await fetch(`/api/groups/${group.id}/assign`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignedToId: formData.assignedToId }),
        });

        if (!assignResponse.ok) {
          throw new Error("Failed to update assignment");
        }
      }

      // Update phone number and monetization
      if (formData.phoneNumber !== group.phoneNumber || formData.monetizationEnabled !== group.monetizationEnabled) {
        const infoResponse = await fetch(`/api/groups/${group.id}/info`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            phoneNumber: formData.phoneNumber,
            monetizationEnabled: formData.monetizationEnabled 
          }),
        });

        if (!infoResponse.ok) {
          throw new Error("Failed to update group info");
        }
      }

      toast({
        title: "Thành công",
        description: "Đã cập nhật thông tin nhóm thành công",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating group:", error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật thông tin nhóm. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cập nhật thông tin nhóm</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="groupName">Tên nhóm</Label>
            <Input
              id="groupName"
              value={formData.groupName}
              onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
              placeholder="Nhập tên nhóm"
              required
            />
          </div>

          <div>
            <Label htmlFor="classification">Phân loại</Label>
            <Select 
              value={formData.classification} 
              onValueChange={(value) => setFormData({ ...formData, classification: value })}
            >
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

          <div>
            <Label htmlFor="assignedTo">Người quản lý</Label>
            <Select 
              value={formData.assignedToId?.toString() || "none"} 
              onValueChange={(value) => setFormData({ 
                ...formData, 
                assignedToId: value === "none" ? null : parseInt(value) 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn người quản lý" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không phân công</SelectItem>
                {editorUsers?.map(user => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name} (@{user.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="phoneNumber">Số điện thoại</Label>
            <Input
              id="phoneNumber"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              placeholder="Nhập số điện thoại"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="monetizationEnabled"
              checked={formData.monetizationEnabled}
              onCheckedChange={(checked) => setFormData({ ...formData, monetizationEnabled: checked })}
            />
            <Label htmlFor="monetizationEnabled">Bật kiếm tiền</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Đang cập nhật..." : "Cập nhật"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
