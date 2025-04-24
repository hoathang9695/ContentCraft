
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface PushFollowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (count: number) => void;
}

export function PushFollowDialog({ open, onOpenChange, onSubmit }: PushFollowDialogProps) {
  const [count, setCount] = useState<string>('');

  const handleSubmit = () => {
    const followCount = parseInt(count, 10);
    if (!isNaN(followCount) && followCount > 0) {
      onSubmit(followCount);
      onOpenChange(false);
      setCount('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Push Follow</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            type="number"
            min="1"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="Nhập số lượng"
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit}>
            Lưu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
