"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import {
  fetchSections,
  fetchRooms,
  fetchTimetableSegments,
  fetchSchools,
  fetchTeamGroups,
  fetchTeams,
  fetchStaffs,
  Section,
  Room,
  TimetableSegment,
  School,
  TeamGroup,
  Team,
  Staff,
} from "@/lib/masterApi";

type MasterType = "sections" | "rooms" | "timetableSegments" | "schools" | "teamGroups" | "teams" | "staffs";

interface TabConfig {
  id: MasterType;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { id: "sections", label: "部門", icon: "tune" },
  { id: "rooms", label: "会場", icon: "room" },
  { id: "timetableSegments", label: "時間枠", icon: "schedule" },
  { id: "schools", label: "参加校", icon: "school" },
  { id: "teamGroups", label: "チームグループ", icon: "folder_shared" },
  { id: "teams", label: "チーム", icon: "groups" },
  { id: "staffs", label: "スタッフ", icon: "admin_panel_settings" },
];

function escapeCSVValue(val: any): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function AllDataManagementPage() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const eventId = rawId ? parseInt(rawId as string, 10) : null;

  const [activeTab, setActiveTab] = useState<MasterType>("sections");
  const [searchQuery, setSearchQuery] = useState("");

  // Data states
  const [sections, setSections] = useState<Section[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [segments, setSegments] = useState<TimetableSegment[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [teamGroups, setTeamGroups] = useState<TeamGroup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const segmentDayGroups = useMemo(() => {
    const map = new Map<number, number>();
    let dayIndex = 0;
    let prevTime: string | null = null;
    
    const sorted = [...segments].sort((a, b) => 
      (a.order_number ?? 999999) - (b.order_number ?? 999999)
    );
    
    for (const seg of sorted) {
      if (seg.start_time && prevTime && seg.start_time < prevTime) {
        dayIndex++;
      }
      map.set(seg.id, dayIndex);
      if (seg.start_time) {
        prevTime = seg.start_time;
      }
    }
    return map;
  }, [segments]);

  useEffect(() => {
    if (eventId && !isNaN(eventId)) {
      loadData();
    }
  }, [eventId, activeTab]);

  async function loadData() {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      switch (activeTab) {
        case "sections":
          const sectionData = await fetchSections(eventId);
          setSections(sectionData);
          break;
        case "rooms":
          const roomData = await fetchRooms(eventId);
          setRooms(roomData);
          break;
        case "timetableSegments":
          const segmentData = await fetchTimetableSegments(eventId);
          setSegments(segmentData);
          break;
        case "schools":
          const schoolData = await fetchSchools(eventId);
          setSchools(schoolData);
          break;
        case "teamGroups":
          const groupData = await fetchTeamGroups(eventId);
          setTeamGroups(groupData);
          break;
        case "teams":
          const teamData = await fetchTeams(eventId);
          setTeams(teamData);
          break;
        case "staffs":
          const staffData = await fetchStaffs(eventId);
          setStaffs(staffData);
          break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  // --- CSV Export Logic ---
  const handleExport = () => {
    if (!eventId) return;

    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = "";

    switch (activeTab) {
      case "sections":
        headers = ["ID", "部門名", "表示順"];
        rows = sections.map(s => [s.id, s.name, s.order_number ?? ""]);
        filename = `sections_event${eventId}.csv`;
        break;
      case "rooms":
        headers = ["ID", "会場名", "表示順", "備考"];
        rows = rooms.map(r => [r.id, r.name, r.order_number ?? "", r.note ?? ""]);
        filename = `rooms_event${eventId}.csv`;
        break;
      case "timetableSegments":
        headers = ["ID", "時間枠名", "表示順", "開始時間", "終了時間", "予選枠", "別名"];
        rows = segments.map(s => [
          s.id,
          s.name,
          s.order_number ?? "",
          s.start_time ?? "",
          s.end_time ?? "",
          s.is_pre_round ? "true" : "false",
          s.name_aliases?.join("|") ?? "",
        ]);
        filename = `timetable_segments_event${eventId}.csv`;
        break;
      case "schools":
        headers = ["ID", "学校名", "表示順", "備考", "別名"];
        rows = schools.map(s => [
          s.id,
          s.name,
          s.order_number ?? "",
          s.note ?? "",
          s.name_aliases?.join("|") ?? "",
        ]);
        filename = `schools_event${eventId}.csv`;
        break;
      case "teamGroups":
        headers = ["ID", "グループ名"];
        rows = teamGroups.map(g => [g.id, g.name]);
        filename = `team_groups_event${eventId}.csv`;
        break;
      case "teams":
        headers = ["ID", "チーム名", "部門名", "学校名", "グループ名", "シード枠", "申込順", "備考"];
        rows = teams.map(t => [
          t.id,
          t.name,
          t.section_name ?? "",
          t.school_name ?? "",
          t.group_name ?? "",
          t.is_seed ? "true" : "false",
          t.order_of_application ?? "",
          t.note ?? "",
        ]);
        filename = `teams_event${eventId}.csv`;
        break;
      case "staffs":
        headers = ["ID", "スタッフ名", "主審可", "副審可", "タイムキーパー可", "申込順", "備考", "担当可能時間枠ID", "関連校名"];
        rows = staffs.map(st => [
          st.id,
          st.name,
          st.can_be_main_judge ? "true" : "false",
          st.can_be_sub_judge ? "true" : "false",
          st.can_be_timekeeper ? "true" : "false",
          st.order_of_application ?? "",
          st.note ?? "",
          st.present_segment_ids?.join("|") ?? "",
          st.interested_school_names?.join("|") ?? "",
        ]);
        filename = `staffs_event${eventId}.csv`;
        break;
    }

    const csvContent = [
      headers.map(escapeCSVValue).join(","),
      ...rows.map(row => row.map(escapeCSVValue).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Filtering Preview Data ---
  const getFilteredData = () => {
    const query = searchQuery.toLowerCase();
    switch (activeTab) {
      case "sections":
        return sections.filter(s => s.name.toLowerCase().includes(query));
      case "rooms":
        return rooms.filter(r => r.name.toLowerCase().includes(query) || r.note?.toLowerCase().includes(query));
      case "timetableSegments":
        return segments.filter(s => s.name.toLowerCase().includes(query) || s.name_aliases?.some(a => a.toLowerCase().includes(query)));
      case "schools":
        return schools.filter(s => s.name.toLowerCase().includes(query) || s.name_aliases?.some(a => a.toLowerCase().includes(query)) || s.note?.toLowerCase().includes(query));
      case "teamGroups":
        return teamGroups.filter(g => g.name.toLowerCase().includes(query));
      case "teams":
        return teams.filter(t => t.name.toLowerCase().includes(query) || t.school_name?.toLowerCase().includes(query) || t.section_name?.toLowerCase().includes(query));
      case "staffs":
        return staffs.filter(st => st.name.toLowerCase().includes(query) || st.note?.toLowerCase().includes(query));
      default:
        return [];
    }
  };

  if (!eventId || isNaN(eventId)) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>大会IDが無効です</p>
      </div>
    );
  }

  const filteredData = getFilteredData();

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold">全データ管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          大会の全マスタデータの閲覧、CSVダウンロード、およびインポート用のExcelテンプレートの取得ができます。
        </p>
      </div>

      {/* Excel Download Template Banner */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-blue-500 rounded-lg text-white">
              <Icon name="description" size={28} />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 text-lg">インポート用 csv テンプレート</h3>
              <p className="text-sm text-blue-700 mt-1 max-w-xl">
                インポートの書式が揃ったサンプルエクセルファイル。このテンプレートに基づいてcsvデータを作成・アップロードしてください。
              </p>
            </div>
          </div>
          <a
            href="/dennokun_csv_sample.xlsx"
            download="dennokun_csv_sample.xlsx"
            className="shrink-0"
          >
            <Button variant="primary" icon="download" className="bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all">
              サンプル Excel のダウンロード
            </Button>
          </a>
        </CardContent>
      </Card>

      {/* Tabs & Table Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1 space-y-1 bg-white p-2 border border-border rounded-xl">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery("");
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all ${isActive
                    ? "bg-primary text-white font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                  }`}
              >
                <Icon name={tab.icon} size={20} className={isActive ? "text-white" : "text-muted-foreground"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Icon name={TABS.find(t => t.id === activeTab)?.icon ?? "storage"} size={22} className="text-primary" />
                  {TABS.find(t => t.id === activeTab)?.label}一覧
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {filteredData.length} 件
                  </Badge>
                </h2>
              </div>
              <div className="flex gap-3 items-center w-full sm:w-auto">
                <Input
                  placeholder="検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-60 h-10"
                  autoComplete="off"
                />
                <Button
                  variant="outlined"
                  icon="download"
                  onClick={handleExport}
                  disabled={loading || filteredData.length === 0}
                  className="shrink-0"
                >
                  CSVエクスポート
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0 min-h-[300px] relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                  <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : null}

              {error && (
                <div className="p-6 flex items-center gap-2 text-destructive text-sm">
                  <Icon name="error_outline" size={18} />
                  <p>{error}</p>
                </div>
              )}

              {!loading && !error && filteredData.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-2">
                  <Icon name="info" size={36} className="text-muted-foreground/60" />
                  <p>該当するデータが見つかりません</p>
                </div>
              ) : null}

              {!loading && !error && filteredData.length > 0 && (
                <div className="overflow-x-auto max-h-[500px]">
                  <Table className="border-none rounded-none">
                    <TableHeader>
                      <TableRow hover={false}>
                        {activeTab === "sections" && (
                          <>
                            <TableHead className="w-24">ID</TableHead>
                            <TableHead>部門名</TableHead>
                            <TableHead className="w-32">表示順</TableHead>
                          </>
                        )}
                        {activeTab === "rooms" && (
                          <>
                            <TableHead className="w-24">ID</TableHead>
                            <TableHead>会場名</TableHead>
                            <TableHead className="w-32">表示順</TableHead>
                            <TableHead>備考</TableHead>
                          </>
                        )}
                        {activeTab === "timetableSegments" && (
                          <>
                            <TableHead className="w-24">ID</TableHead>
                            <TableHead>時間枠名</TableHead>
                            <TableHead className="w-32">表示順</TableHead>
                            <TableHead>時間帯</TableHead>
                            <TableHead className="w-28">予選枠</TableHead>
                            <TableHead>別名</TableHead>
                          </>
                        )}
                        {activeTab === "schools" && (
                          <>
                            <TableHead className="w-24">ID</TableHead>
                            <TableHead>学校名</TableHead>
                            <TableHead className="w-32">表示順</TableHead>
                            <TableHead>別名</TableHead>
                            <TableHead>備考</TableHead>
                          </>
                        )}
                        {activeTab === "teamGroups" && (
                          <>
                            <TableHead className="w-24">ID</TableHead>
                            <TableHead>グループ名</TableHead>
                          </>
                        )}
                        {activeTab === "teams" && (
                          <>
                            <TableHead className="w-24">ID</TableHead>
                            <TableHead>チーム名</TableHead>
                            <TableHead>部門</TableHead>
                            <TableHead>学校</TableHead>
                            <TableHead>グループ</TableHead>
                            <TableHead className="w-28">シード</TableHead>
                            <TableHead className="w-28">申込順</TableHead>
                            <TableHead>備考</TableHead>
                          </>
                        )}
                        {activeTab === "staffs" && (
                          <>
                            <TableHead className="w-24">ID</TableHead>
                            <TableHead>スタッフ名</TableHead>
                            <TableHead className="w-24 text-center">主審可</TableHead>
                            <TableHead className="w-24 text-center">副審可</TableHead>
                            <TableHead className="w-28 text-center">タイムキーパー可</TableHead>
                            <TableHead className="w-24">表示順</TableHead>
                            <TableHead>担当可能時間枠数</TableHead>
                            <TableHead>関連校</TableHead>
                            <TableHead>備考</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeTab === "sections" &&
                        (filteredData as Section[]).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">{row.id}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.order_number ?? "-"}</TableCell>
                          </TableRow>
                        ))}
                      {activeTab === "rooms" &&
                        (filteredData as Room[]).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">{row.id}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.order_number ?? "-"}</TableCell>
                            <TableCell className="text-muted-foreground text-xs max-w-xs truncate">{row.note ?? "-"}</TableCell>
                          </TableRow>
                        ))}
                      {activeTab === "timetableSegments" &&
                        (filteredData as TimetableSegment[]).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">{row.id}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.order_number ?? "-"}</TableCell>
                            <TableCell className="text-xs">
                              {row.start_time || row.end_time ? `${row.start_time ?? ""}〜${row.end_time ?? ""}` : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {row.is_pre_round ? (
                                  <Badge variant="warning" className="bg-amber-100 border-amber-200 text-amber-800 text-[10px]">予選枠</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">本戦枠</Badge>
                                )}
                                <Badge variant="outline" className="text-[10px]">
                                  {`${(segmentDayGroups.get(row.id) ?? 0) + 1}日目`}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                              {row.name_aliases?.join(", ") || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      {activeTab === "schools" &&
                        (filteredData as School[]).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">{row.id}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.order_number ?? "-"}</TableCell>
                            <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                              {row.name_aliases?.join(", ") || "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs max-w-xs truncate">{row.note ?? "-"}</TableCell>
                          </TableRow>
                        ))}
                      {activeTab === "teamGroups" &&
                        (filteredData as TeamGroup[]).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">{row.id}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                          </TableRow>
                        ))}
                      {activeTab === "teams" &&
                        (filteredData as Team[]).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">{row.id}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-xs">{row.section_name ?? "-"}</TableCell>
                            <TableCell className="text-xs">{row.school_name ?? "-"}</TableCell>
                            <TableCell className="text-xs">
                              {row.group_name ? (
                                <Badge variant="secondary" className="text-[10px]">{row.group_name}</Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              {row.is_seed ? (
                                <Badge variant="success" className="bg-emerald-100 border-emerald-200 text-emerald-800 text-[10px]">シード</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>{row.order_of_application ?? "-"}</TableCell>
                            <TableCell className="text-muted-foreground text-xs max-w-xs truncate">{row.note ?? "-"}</TableCell>
                          </TableRow>
                        ))}
                      {activeTab === "staffs" &&
                        (filteredData as Staff[]).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">{row.id}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-center">
                              {row.can_be_main_judge ? (
                                <Icon name="check_circle" className="text-emerald-500" size={18} />
                              ) : (
                                <span className="text-muted-foreground/30 font-light">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {row.can_be_sub_judge ? (
                                <Icon name="check_circle" className="text-emerald-500" size={18} />
                              ) : (
                                <span className="text-muted-foreground/30 font-light">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {row.can_be_timekeeper ? (
                                <Icon name="check_circle" className="text-emerald-500" size={18} />
                              ) : (
                                <span className="text-muted-foreground/30 font-light">-</span>
                              )}
                            </TableCell>
                            <TableCell>{row.order_of_application ?? "-"}</TableCell>
                            <TableCell className="text-xs">
                              {row.present_segment_ids?.length ?? 0}枠
                            </TableCell>
                            <TableCell className="text-xs max-w-xs truncate">
                              {row.interested_school_names?.join(", ") || "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs max-w-xs truncate">{row.note ?? "-"}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
