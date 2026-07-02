"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import TsvImportButton from "@/components/elements/TsvImportButton";
import {
  Staff, StaffCreate, fetchStaffs, createStaff, updateStaff, deleteStaff,
  School, fetchSchools,
  TimetableSegment, fetchTimetableSegments,
} from "@/lib/masterApi";

interface FormState {
  name: string;
  can_be_main_judge: boolean;
  can_be_sub_judge: boolean;
  can_be_timekeeper: boolean;
  order_of_application: string;
  note: string;
  interested_school_ids: number[];
  present_segment_ids: number[];
}

const emptyForm = (): FormState => ({
  name: "", can_be_main_judge: false, can_be_sub_judge: false, can_be_timekeeper: false,
  order_of_application: "", note: "", interested_school_ids: [], present_segment_ids: [],
});

export default function StaffsPage() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const eventId = rawId ? parseInt(rawId as string) : null;

  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [segments, setSegments] = useState<TimetableSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Staff | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const [staffsData, schoolsData, segmentsData] = await Promise.all([
        fetchStaffs(eventId),
        fetchSchools(eventId),
        fetchTimetableSegments(eventId),
      ]);
      setStaffs(staffsData);
      setSchools(schoolsData);
      setSegments(segmentsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const filteredStaffs = staffs.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function openCreate() {
    setEditTarget(null);
    setForm({
      ...emptyForm(),
      present_segment_ids: segments.map((s) => s.id),
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEdit(s: Staff) {
    setEditTarget(s);
    setForm({
      name: s.name,
      can_be_main_judge: s.can_be_main_judge,
      can_be_sub_judge: s.can_be_sub_judge,
      can_be_timekeeper: s.can_be_timekeeper,
      order_of_application: s.order_of_application != null ? String(s.order_of_application) : "",
      note: s.note ?? "",
      interested_school_ids: s.interested_school_ids ?? [],
      present_segment_ids: s.present_segment_ids ?? [],
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (!eventId || !form.name.trim()) {
      setFormError("名前は必須です");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload: StaffCreate = {
        name: form.name.trim(),
        can_be_main_judge: form.can_be_main_judge,
        can_be_sub_judge: form.can_be_sub_judge,
        can_be_timekeeper: form.can_be_timekeeper,
        order_of_application: form.order_of_application ? parseInt(form.order_of_application) : null,
        note: form.note.trim() || null,
        interested_school_ids: form.interested_school_ids,
        present_segment_ids: form.present_segment_ids,
      };
      if (editTarget) {
        await updateStaff(eventId, editTarget.id, payload);
      } else {
        await createStaff(eventId, payload);
      }
      setIsModalOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !eventId) return;
    setDeleting(true);
    try {
      await deleteStaff(eventId, deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  function toggleSchool(schoolId: number) {
    setForm((f) => ({
      ...f,
      interested_school_ids: f.interested_school_ids.includes(schoolId)
        ? f.interested_school_ids.filter((id) => id !== schoolId)
        : [...f.interested_school_ids, schoolId],
    }));
  }

  function toggleSegment(segId: number) {
    setForm((f) => ({
      ...f,
      present_segment_ids: f.present_segment_ids.includes(segId)
        ? f.present_segment_ids.filter((id) => id !== segId)
        : [...f.present_segment_ids, segId],
    }));
  }

  const handleImport = async (rows: string[][]) => {
    if (!eventId) return;
    setIsImporting(true);
    try {
      let count = 0;
      for (const row of rows) {
        if (row.length < 2) continue;
        const [orderStr, name, rolesStr] = row;
        const roles = (rolesStr || "").split("|").map((r) => r.trim());
        await createStaff(eventId, {
          name: name.trim(),
          order_of_application: orderStr ? parseInt(orderStr) : null,
          can_be_main_judge: roles.includes("主審"),
          can_be_sub_judge: roles.includes("副審"),
          can_be_timekeeper: roles.includes("司会"),
        });
        count++;
      }
      await load();
      alert(`${count}名のスタッフをインポートしました`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "インポートに失敗しました");
    } finally {
      setIsImporting(false);
    }
  };

  if (!eventId || isNaN(eventId)) {
    return <div className="text-center py-16 text-muted-foreground"><p>大会IDが無効です</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">スタッフ管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ジャッジや運営スタッフの役割と利害関係を管理します。
          </p>
        </div>
        <div className="flex gap-2">
          <TsvImportButton onImport={handleImport} isLoading={isImporting} />
          <Button icon="person_add" onClick={openCreate}>スタッフ追加</Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <Icon name="error_outline" size={18} />
          <p>{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="max-w-md">
            <Input placeholder="名前で検索..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} id="search-staffs" className="h-10" autoComplete="off" />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table className="border-none rounded-none">
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>名前</TableHead>
                <TableHead align="center">主審</TableHead>
                <TableHead align="center">副審</TableHead>
                <TableHead align="center">司会</TableHead>
                <TableHead>利害関係校</TableHead>
                <TableHead>参加可能時間枠</TableHead>
                <TableHead align="right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow hover={false}>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      読み込み中...
                    </span>
                  </TableCell>
                </TableRow>
              ) : filteredStaffs.length === 0 ? (
                <TableRow hover={false}>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    スタッフが見つかりません
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaffs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell align="center">
                      {s.can_be_main_judge ? <Badge variant="info" className="w-8 justify-center">○</Badge> : <span className="text-muted-foreground opacity-30">-</span>}
                    </TableCell>
                    <TableCell align="center">
                      {s.can_be_sub_judge ? <Badge variant="success" className="w-8 justify-center">○</Badge> : <span className="text-muted-foreground opacity-30">-</span>}
                    </TableCell>
                    <TableCell align="center">
                      {s.can_be_timekeeper ? <Badge variant="warning" className="w-8 justify-center">○</Badge> : <span className="text-muted-foreground opacity-30">-</span>}
                    </TableCell>
                    <TableCell>
                      {(s.interested_school_names ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(s.interested_school_names ?? []).map((name, i) => (
                            <Badge key={i} variant="warning" className="text-[10px] py-0">{name}</Badge>
                          ))}
                        </div>
                      ) : <span className="text-xs text-muted-foreground italic">なし</span>}
                    </TableCell>
                    <TableCell>
                      {(s.present_segment_ids ?? []).length > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {(s.present_segment_ids ?? []).length}枠
                        </span>
                      ) : <span className="text-xs text-muted-foreground italic">全枠</span>}
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="p-1.5 h-auto rounded-full text-primary" onClick={() => openEdit(s)}>
                          <Icon name="edit" size={18} />
                        </Button>
                        <Button variant="ghost" size="sm" className="p-1.5 h-auto rounded-full text-destructive" onClick={() => setDeleteTarget(s)}>
                          <Icon name="delete" size={18} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">全 {filteredStaffs.length} 名を表示中</p>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editTarget ? "スタッフを編集" : "スタッフを追加"}
        maxWidth="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>キャンセル</Button>
            <Button onClick={handleSave} loading={saving}>保存</Button>
          </>
        }
      >
        <div className="space-y-5">
          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="grid grid-cols-2 gap-4">
            <Input id="staff-name" label="名前" placeholder="例：山田 太郎" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            <Input id="staff-order" label="申込順（任意）" type="number" placeholder="例：1" value={form.order_of_application}
              onChange={(e) => setForm((f) => ({ ...f, order_of_application: e.target.value }))} />
          </div>

          {/* Role checkboxes */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">担当可能役割</p>
            <div className="flex gap-4 flex-wrap">
              {[
                { key: "can_be_main_judge", label: "主審（ヘッドジャッジ）", color: "text-blue-600" },
                { key: "can_be_sub_judge", label: "副審（サブジャッジ）", color: "text-green-600" },
                { key: "can_be_timekeeper", label: "司会・タイマー", color: "text-amber-600" },
              ].map(({ key, label, color }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox"
                    checked={form[key as keyof FormState] as boolean}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <span className={`text-sm ${color} font-medium`}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Interested schools */}
          {schools.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                利害関係のある学校{" "}
                <span className="text-xs text-muted-foreground font-normal">（選択した学校の試合は担当不可）</span>
              </p>
              <div className="border border-border rounded-lg p-3 max-h-36 overflow-y-auto grid grid-cols-2 gap-1.5">
                {schools.map((sc) => (
                  <label key={sc.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                    <input type="checkbox"
                      checked={form.interested_school_ids.includes(sc.id)}
                      onChange={() => toggleSchool(sc.id)}
                      className="w-3.5 h-3.5 accent-amber-500 rounded"
                    />
                    <span className="text-xs">{sc.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Present segments */}
          {segments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                参加可能な時間枠{" "}
                <span className="text-xs text-muted-foreground font-normal">（未選択は全枠参加可能）</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {segments.map((seg) => (
                  <label key={seg.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-xs transition-all ${
                      form.present_segment_ids.includes(seg.id)
                        ? "bg-primary text-white border-primary"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}
                  >
                    <input type="checkbox" className="sr-only"
                      checked={form.present_segment_ids.includes(seg.id)}
                      onChange={() => toggleSegment(seg.id)}
                    />
                    {seg.name}
                    {seg.start_time && <span className="opacity-70">({seg.start_time})</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="staff-note" className="block text-sm font-medium text-foreground">備考（任意）</label>
            <textarea id="staff-note" rows={2} placeholder="備考を入力..." value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="スタッフを削除"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>削除</Button>
          </>
        }
      >
        <p className="text-sm">スタッフ「<span className="font-semibold">{deleteTarget?.name}</span>」を削除しますか？この操作は元に戻せません。</p>
      </Modal>
    </div>
  );
}
