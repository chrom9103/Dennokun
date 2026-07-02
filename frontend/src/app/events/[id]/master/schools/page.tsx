"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import TsvImportButton from "@/components/elements/TsvImportButton";
import {
  School,
  fetchSchools,
  createSchool,
  updateSchool,
  deleteSchool,
} from "@/lib/masterApi";

interface FormState {
  name: string;
  order_number: string;
  note: string;
  aliases_input: string;
}

const emptyForm = (): FormState => ({
  name: "",
  order_number: "",
  note: "",
  aliases_input: "",
});

function schoolToForm(s: School): FormState {
  return {
    name: s.name,
    order_number: s.order_number != null ? String(s.order_number) : "",
    note: s.note ?? "",
    aliases_input: s.name_aliases.join(", "),
  };
}

export default function SchoolsPage() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const eventId = rawId ? parseInt(rawId as string) : null;

  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<School | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);
  const [deleting, setDeleting] = useState(false);

  // TSV import
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (eventId && !isNaN(eventId)) load();
  }, [eventId]);

  async function load() {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSchools(eventId);
      setSchools(data);
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

  function openEdit(s: School) {
    setEditTarget(s);
    setForm(schoolToForm(s));
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditTarget(null);
    setFormError(null);
  }

  async function handleSave() {
    if (!eventId || !form.name.trim()) {
      setFormError("学校名は必須です");
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
        note: form.note.trim() || null,
        name_aliases: aliases,
      };
      if (editTarget) {
        await updateSchool(eventId, editTarget.id, payload);
      } else {
        await createSchool(eventId, payload);
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
    if (!deleteTarget || !eventId) return;
    setDeleting(true);
    try {
      await deleteSchool(eventId, deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  const handleImport = async (rows: string[][]) => {
    if (!eventId) return;
    setIsImporting(true);
    try {
      // TSV format: orderNumber, name, nameAliases
      let created = 0;
      for (const row of rows) {
        if (row.length < 2) continue;
        const [orderStr, name, aliasesStr] = row;
        const aliases = aliasesStr
          ? aliasesStr.split("|").map((a) => a.trim()).filter(Boolean)
          : [];
        await createSchool(eventId, {
          name: name.trim(),
          order_number: orderStr ? parseInt(orderStr) : null,
          name_aliases: aliases,
        });
        created++;
      }
      await load();
      alert(`${created}件の学校データをインポートしました`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "インポートに失敗しました");
    } finally {
      setIsImporting(false);
    }
  };

  const filteredSchools = schools.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name_aliases.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!eventId || isNaN(eventId)) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>大会IDが無効です</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">参加校管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            大会に参加する学校の基本情報を管理します。
          </p>
        </div>
        <div className="flex gap-2">
          <TsvImportButton onImport={handleImport} isLoading={isImporting} />
          <Button icon="add" onClick={openCreate}>学校追加</Button>
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
            <Input
              placeholder="学校名・エイリアスで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="search-schools"
              className="h-10"
              autoComplete="off"
            />
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <Table className="border-none rounded-none">
            <TableHeader>
              <TableRow hover={false}>
                <TableHead className="w-16">順番</TableHead>
                <TableHead>学校名</TableHead>
                <TableHead>エイリアス</TableHead>
                <TableHead>備考</TableHead>
                <TableHead align="right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow hover={false}>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      読み込み中...
                    </span>
                  </TableCell>
                </TableRow>
              ) : filteredSchools.length === 0 ? (
                <TableRow hover={false}>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    {searchQuery ? "条件に一致する学校が見つかりません" : "学校が登録されていません"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSchools.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground text-sm">{s.order_number ?? "-"}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.name_aliases.map((alias, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] py-0">
                            {alias}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.note || "-"}</TableCell>
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
        </CardContent>
      </Card>
      
      <p className="text-xs text-muted-foreground">
        全 {schools.length} 校中 {filteredSchools.length} 校を表示
      </p>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editTarget ? "学校を編集" : "学校を追加"}
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
              id="school-name"
              label="学校名"
              placeholder="例：〇〇高等学校"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
            <Input
              id="school-order"
              label="順番（任意）"
              type="number"
              placeholder="例：1"
              value={form.order_number}
              onChange={(e) => setForm((f) => ({ ...f, order_number: e.target.value }))}
            />
          </div>
          <Input
            id="school-aliases"
            label="エイリアス（任意・カンマ区切り）"
            placeholder="例：〇〇高校, ○○高"
            value={form.aliases_input}
            onChange={(e) => setForm((f) => ({ ...f, aliases_input: e.target.value }))}
            helperText="表記揺れ吸収のための別名を入力してください"
          />
          <div className="space-y-1.5">
            <label htmlFor="school-note" className="block text-sm font-medium text-foreground">
              備考（任意）
            </label>
            <textarea
              id="school-note"
              rows={2}
              placeholder="備考を入力..."
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm transition-all placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="学校を削除"
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
          学校「<span className="font-semibold">{deleteTarget?.name}</span>」を削除しますか？
          この操作は元に戻せません。
        </p>
      </Modal>
    </div>
  );
}
