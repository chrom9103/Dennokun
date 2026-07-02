"use client";

import React, { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import {
  Section,
  fetchSections,
  createSection,
  updateSection,
  deleteSection,
} from "@/lib/masterApi";

interface DivisionSettingsProps {
  eventId: number;
}

interface FormState {
  name: string;
  order_number: string;
}

const emptyForm = (): FormState => ({ name: "", order_number: "" });

export default function DivisionSettings({ eventId }: DivisionSettingsProps) {
  const [divisions, setDivisions] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Section | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<Section | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSections(eventId);
      setDivisions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm());
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEdit(d: Section) {
    setEditTarget(d);
    setForm({ name: d.name, order_number: d.order_number != null ? String(d.order_number) : "" });
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditTarget(null);
    setFormError(null);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFormError("部門名は必須です");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        order_number: form.order_number ? parseInt(form.order_number) : null,
      };
      if (editTarget) {
        await updateSection(eventId, editTarget.id, payload);
      } else {
        await createSection(eventId, payload);
      }
      closeModal();
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSection(eventId, deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">部門一覧</h3>
        <Button icon="add" size="sm" onClick={openCreate}>
          部門追加
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <Icon name="error_outline" size={18} />
          <p>{error}</p>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow hover={false}>
            <TableHead className="w-16">順番</TableHead>
            <TableHead>部門名</TableHead>
            <TableHead align="right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow hover={false}>
              <TableCell colSpan={3} align="center" className="py-12 text-muted-foreground">
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  読み込み中...
                </span>
              </TableCell>
            </TableRow>
          ) : divisions.length === 0 ? (
            <TableRow hover={false}>
              <TableCell colSpan={3} align="center" className="py-12 text-muted-foreground">
                部門が登録されていません
              </TableCell>
            </TableRow>
          ) : (
            divisions.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="text-muted-foreground text-sm">{d.order_number ?? "-"}</TableCell>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell align="right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1.5 h-auto rounded-full text-primary"
                      onClick={() => openEdit(d)}
                    >
                      <Icon name="edit" size={18} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1.5 h-auto rounded-full text-destructive"
                      onClick={() => setDeleteTarget(d)}
                    >
                      <Icon name="delete" size={18} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editTarget ? "部門を編集" : "部門を追加"}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              キャンセル
            </Button>
            <Button onClick={handleSave} loading={saving}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}
          <Input
            id="division-name"
            label="部門名"
            placeholder="例：高校生の部"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <Input
            id="division-order"
            label="順番（任意）"
            type="number"
            placeholder="例：1"
            value={form.order_number}
            onChange={(e) => setForm((f) => ({ ...f, order_number: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="部門を削除"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>
              削除
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          部門「<span className="font-semibold">{deleteTarget?.name}</span>」を削除しますか？
          この操作は元に戻せません。
        </p>
      </Modal>
    </div>
  );
}
