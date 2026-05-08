import React, { useState } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; start_date: string }) => Promise<void>;
  isLoading: boolean;
}

export default function CreateEventModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: CreateEventModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
    setFormData({ name: "", start_date: "" });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="新規大会作成"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            キャンセル
          </Button>
          <Button
            type="submit"
            form="create-event-form"
            loading={isLoading}
          >
            作成
          </Button>
        </>
      }
    >
      <form id="create-event-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="大会名"
          required
          placeholder="例: 2026年度 春季大会"
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          disabled={isLoading}
        />

        <Input
          label="開催日"
          type="date"
          value={formData.start_date}
          onChange={(e) =>
            setFormData({
              ...formData,
              start_date: e.target.value,
            })
          }
          disabled={isLoading}
        />
        
        <p className="text-xs text-muted-foreground mt-2">
          大会作成後、参加校やチームのマスタデータを登録できます。
        </p>
      </form>
    </Modal>
  );
}
