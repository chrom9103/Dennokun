"use client";

import React, { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
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
  TimetableSegment,
  fetchTimetableSegments,
  createTimetableSegment,
  updateTimetableSegment,
  deleteTimetableSegment,
} from "@/lib/masterApi";

interface TimeSlotSettingsProps {
  eventId: number;
}

interface FormState {
  name: string;
  order_number: string;
  start_time: string;
  end_time: string;
  is_pre_round: boolean;
  aliases_input: string; // comma-separated
}

const emptyForm = (): FormState => ({
  name: "",
  order_number: "",
  start_time: "",
  end_time: "",
  is_pre_round: false,
  aliases_input: "",
});

function segmentToForm(s: TimetableSegment): FormState {
  return {
    name: s.name,
    order_number: s.order_number != null ? String(s.order_number) : "",
    start_time: s.start_time ?? "",
    end_time: s.end_time ?? "",
    is_pre_round: s.is_pre_round,
    aliases_input: s.name_aliases.join(", "),
  };
}

export default function TimeSlotSettings({ eventId }: TimeSlotSettingsProps) {
  const [segments, setSegments] = useState<TimetableSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TimetableSegment | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<TimetableSegment | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTimetableSegments(eventId);
      setSegments(data);
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

  function openEdit(s: TimetableSegment) {
    setEditTarget(s);
    setForm(segmentToForm(s));
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
      setFormError("時間枠名は必須です");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const aliases = form.aliases_input
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        name: form.name.trim(),
        order_number: form.order_number ? parseInt(form.order_number) : null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        is_pre_round: form.is_pre_round,
        name_aliases: aliases,
      };
      if (editTarget) {
        await updateTimetableSegment(eventId, editTarget.id, payload);
      } else {
        await createTimetableSegment(eventId, payload);
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
      await deleteTimetableSegment(eventId, deleteTarget.id);
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
        <h3 className="text-lg font-medium text-foreground">時間枠一覧</h3>
        <Button icon="add" size="sm" onClick={openCreate}>
          時間枠追加
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
            <TableHead>時間枠名</TableHead>
            <TableHead>開始</TableHead>
            <TableHead>終了</TableHead>
            <TableHead>種別</TableHead>
            <TableHead align="right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow hover={false}>
              <TableCell colSpan={6} align="center" className="py-12 text-muted-foreground">
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  読み込み中...
                </span>
              </TableCell>
            </TableRow>
          ) : segments.length === 0 ? (
            <TableRow hover={false}>
              <TableCell colSpan={6} align="center" className="py-12 text-muted-foreground">
                時間枠が登録されていません
              </TableCell>
            </TableRow>
          ) : (
            segments.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground text-sm">{s.order_number ?? "-"}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>
                  {s.start_time ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon name="schedule" size={16} />
                      {s.start_time}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {s.end_time ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon name="schedule" size={16} />
                      {s.end_time}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={s.is_pre_round ? "outline" : "default"} className="text-[11px]">
                    {s.is_pre_round ? "予選" : "本選"}
                  </Badge>
                </TableCell>
                <TableCell align="right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1.5 h-auto rounded-full text-primary"
                      onClick={() => openEdit(s)}
                    >
                      <Icon name="edit" size={18} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1.5 h-auto rounded-full text-destructive"
                      onClick={() => setDeleteTarget(s)}
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
        title={editTarget ? "時間枠を編集" : "時間枠を追加"}
        maxWidth="lg"
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
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="ts-name"
              label="時間枠名"
              placeholder="例：第1試合"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
            <Input
              id="ts-order"
              label="順番（任意）"
              type="number"
              placeholder="例：1"
              value={form.order_number}
              onChange={(e) => setForm((f) => ({ ...f, order_number: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="ts-start"
              label="開始時刻（任意）"
              type="time"
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
            />
            <Input
              id="ts-end"
              label="終了時刻（任意）"
              type="time"
              value={form.end_time}
              onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
            />
          </div>
          <Input
            id="ts-aliases"
            label="エイリアス（任意・カンマ区切り）"
            placeholder="例：R1, Round1"
            value={form.aliases_input}
            onChange={(e) => setForm((f) => ({ ...f, aliases_input: e.target.value }))}
            helperText="表記揺れ吸収のための別名を入力してください"
          />
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.is_pre_round}
                onChange={(e) => setForm((f) => ({ ...f, is_pre_round: e.target.checked }))}
                id="ts-pre-round"
              />
              <div className="w-10 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
            </label>
            <label htmlFor="ts-pre-round" className="text-sm font-medium text-foreground cursor-pointer">
              予選ラウンド
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="時間枠を削除"
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
          時間枠「<span className="font-semibold">{deleteTarget?.name}</span>」を削除しますか？
          この操作は元に戻せません。
        </p>
      </Modal>
    </div>
  );
}
