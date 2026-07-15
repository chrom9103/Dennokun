"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Team, TeamCreate, fetchTeams, createTeam, updateTeam, deleteTeam,
  Section, fetchSections,
  School, fetchSchools,
  TeamGroup, fetchTeamGroups, createTeamGroup,
} from "@/lib/masterApi";

interface FormState {
  name: string;
  event_section_id: string;
  event_school_id: string;
  team_group_id: string;
  is_seed: boolean;
  order_of_application: string;
  note: string;
}

const emptyForm = (): FormState => ({
  name: "", event_section_id: "", event_school_id: "",
  team_group_id: "", is_seed: false, order_of_application: "", note: "",
});

export default function TeamsPage() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const eventId = rawId ? parseInt(rawId as string) : null;

  const [teams, setTeams] = useState<Team[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("all");
  const [filterGroupId, setFilterGroupId] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Team | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [isImporting, setIsImporting] = useState(false);

  // New group creation inline
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const [teamsData, sectionsData, schoolsData, groupsData] = await Promise.all([
        fetchTeams(eventId),
        fetchSections(eventId),
        fetchSchools(eventId),
        fetchTeamGroups(eventId),
      ]);
      setTeams(teamsData);
      setSections(sectionsData);
      setSchools(schoolsData);
      setGroups(groupsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleSectionChange = (sectionId: string) => {
    setForm((f) => ({
      ...f,
      event_section_id: sectionId,
    }));
  };

  const handleSchoolChange = (schoolId: string) => {
    const selectedSchool = schools.find((s) => String(s.id) === schoolId);
    setForm((f) => {
      const prevSchool = schools.find((s) => String(s.id) === f.event_school_id);
      const shouldUpdateName = !f.name.trim() || (prevSchool && f.name === prevSchool.name);
      return {
        ...f,
        event_school_id: schoolId,
        name: shouldUpdateName && selectedSchool ? selectedSchool.name : f.name,
      };
    });
  };

  const filteredTeams = teams.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.school_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchSec = filterSectionId === "all" || String(t.event_section_id) === filterSectionId;
    const matchGrp = filterGroupId === "all" || String(t.team_group_id) === filterGroupId;
    return matchSearch && matchSec && matchGrp;
  });

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm());
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEdit(t: Team) {
    setEditTarget(t);
    setForm({
      name: t.name,
      event_section_id: t.event_section_id != null ? String(t.event_section_id) : "",
      event_school_id: t.event_school_id != null ? String(t.event_school_id) : "",
      team_group_id: t.team_group_id != null ? String(t.team_group_id) : "",
      is_seed: t.is_seed,
      order_of_application: t.order_of_application != null ? String(t.order_of_application) : "",
      note: t.note ?? "",
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (!eventId || !form.name.trim()) {
      setFormError("チーム名は必須です");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload: TeamCreate = {
        name: form.name.trim(),
        event_section_id: form.event_section_id ? parseInt(form.event_section_id) : null,
        event_school_id: form.event_school_id ? parseInt(form.event_school_id) : null,
        team_group_id: form.team_group_id ? parseInt(form.team_group_id) : null,
        is_seed: form.is_seed,
        order_of_application: form.order_of_application ? parseInt(form.order_of_application) : null,
        note: form.note.trim() || null,
      };
      if (editTarget) {
        await updateTeam(eventId, editTarget.id, payload);
      } else {
        await createTeam(eventId, payload);
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
      await deleteTeam(eventId, deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddGroup() {
    if (!eventId || !newGroupName.trim()) return;
    setAddingGroup(true);
    try {
      const g = await createTeamGroup(eventId, newGroupName.trim());
      setGroups((prev) => [...prev, g]);
      setForm((f) => ({ ...f, team_group_id: String(g.id) }));
      setNewGroupName("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "グループの追加に失敗しました");
    } finally {
      setAddingGroup(false);
    }
  }

  const handleImport = async (rows: string[][]) => {
    if (!eventId) return;
    setIsImporting(true);
    try {
      let count = 0;
      for (const row of rows) {
        if (row.length < 2) continue;
        const [orderStr, name, schoolName, sectionName, groupName] = row;
        const school = schools.find((s) => s.name === schoolName?.trim());
        const section = sections.find((s) => s.name === sectionName?.trim());
        let group = groups.find((g) => g.name === groupName?.trim());
        if (!group && groupName?.trim()) {
          group = await createTeamGroup(eventId, groupName.trim());
          setGroups((prev) => [...prev, group!]);
        }
        await createTeam(eventId, {
          name: name.trim(),
          order_of_application: orderStr ? parseInt(orderStr) : null,
          event_school_id: school?.id ?? null,
          event_section_id: section?.id ?? null,
          team_group_id: group?.id ?? null,
        });
        count++;
      }
      await load();
      alert(`${count}件のチームをインポートしました`);
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
          <h1 className="text-2xl font-bold">チーム管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            大会に参加する各チームの編成と部門・グループを管理します。
          </p>
        </div>
        <div className="flex gap-2">
          <TsvImportButton onImport={handleImport} isLoading={isImporting} />
          <Button icon="group_add" onClick={openCreate}>チーム追加</Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <Icon name="error_outline" size={18} />
          <p>{error}</p>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col md:flex-row gap-4 items-end md:items-center">
          <div className="flex-1 w-full">
            <Input
              placeholder="チーム名、学校名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="search-teams"
              className="h-10"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select
              value={filterSectionId}
              onChange={(e) => setFilterSectionId(e.target.value)}
              className="flex-1 md:w-44 h-10 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            >
              <option value="all">すべての部門</option>
              {sections.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
            <select
              value={filterGroupId}
              onChange={(e) => setFilterGroupId(e.target.value)}
              className="flex-1 md:w-44 h-10 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            >
              <option value="all">すべてのグループ</option>
              {groups.map((g) => (
                <option key={g.id} value={String(g.id)}>{g.name}</option>
              ))}
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table className="border-none rounded-none">
            <TableHeader>
              <TableRow hover={false}>
                <TableHead className="w-16">順番</TableHead>
                <TableHead>チーム名</TableHead>
                <TableHead>学校</TableHead>
                <TableHead>部門</TableHead>
                <TableHead>グループ</TableHead>
                <TableHead align="center">シード</TableHead>
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
              ) : filteredTeams.length === 0 ? (
                <TableRow hover={false}>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    {searchQuery || filterSectionId !== "all" || filterGroupId !== "all"
                      ? "条件に一致するチームが見つかりません"
                      : "チームが登録されていません"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground text-sm">{t.order_of_application ?? "-"}</TableCell>
                    <TableCell className="font-semibold text-primary">{t.name}</TableCell>
                    <TableCell>{t.school_name ?? <span className="text-muted-foreground text-xs">未設定</span>}</TableCell>
                    <TableCell>
                      {t.section_name
                        ? <Badge variant="outline" className="border-primary/30 text-primary">{t.section_name}</Badge>
                        : <span className="text-muted-foreground text-xs">未設定</span>}
                    </TableCell>
                    <TableCell>
                      {t.group_name
                        ? <Badge variant="secondary">{t.group_name}</Badge>
                        : <span className="text-muted-foreground text-xs">-</span>}
                    </TableCell>
                    <TableCell align="center">
                      {t.is_seed && <Badge variant="warning" className="text-[10px]">シード</Badge>}
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="p-1.5 h-auto rounded-full text-primary" onClick={() => openEdit(t)}>
                          <Icon name="edit" size={18} />
                        </Button>
                        <Button variant="ghost" size="sm" className="p-1.5 h-auto rounded-full text-destructive" onClick={() => setDeleteTarget(t)}>
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

      <p className="text-xs text-muted-foreground">全 {teams.length} チーム中 {filteredTeams.length} チームを表示</p>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editTarget ? "チームを編集" : "チームを追加"}
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>キャンセル</Button>
            <Button onClick={handleSave} loading={saving}>保存</Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">部門</label>
            <select value={form.event_section_id} onChange={(e) => handleSectionChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none">
              <option value="">未設定</option>
              {sections.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">学校</label>
            <select value={form.event_school_id} onChange={(e) => handleSchoolChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none">
              <option value="">未設定</option>
              {schools.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input id="team-name" label="チーム名" placeholder="例：Team Alpha" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            <Input id="team-order" label="申込順（任意）" type="number" placeholder="例：1" value={form.order_of_application}
              onChange={(e) => setForm((f) => ({ ...f, order_of_application: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">グループ</label>
            <div className="flex gap-2">
              <select value={form.team_group_id} onChange={(e) => setForm((f) => ({ ...f, team_group_id: e.target.value }))}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                <option value="">未設定</option>
                {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
              </select>
              <div className="flex gap-1">
                <input type="text" placeholder="新規グループ名" value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-32 px-2 py-2 rounded-lg border border-border text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <Button size="sm" variant="secondary" onClick={handleAddGroup} loading={addingGroup} disabled={!newGroupName.trim()}>
                  追加
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" id="team-seed" checked={form.is_seed}
                onChange={(e) => setForm((f) => ({ ...f, is_seed: e.target.checked }))} />
              <div className="w-10 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
            </label>
            <label htmlFor="team-seed" className="text-sm font-medium cursor-pointer">シードチーム</label>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="チームを削除"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>削除</Button>
          </>
        }
      >
        <p className="text-sm">チーム「<span className="font-semibold">{deleteTarget?.name}</span>」を削除しますか？この操作は元に戻せません。</p>
      </Modal>
    </div>
  );
}
