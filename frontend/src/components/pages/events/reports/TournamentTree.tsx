"use client";

import { useState } from "react";
import { MatchListItem } from "@/lib/matchApi";
import { saveMatchResult } from "@/lib/matchApi";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";

interface Props {
  eventId: number;
  matches: MatchListItem[];
  onResultSaved?: () => void;
}

interface EditState {
  matchId: number;
  affVotes: string;
  negVotes: string;
  affComm: string;
  negComm: string;
  affManner: string;
  negManner: string;
}

/**
 * 本戦（is_pre_round=false）のセグメントに属する試合を
 * 進行ボードと同様の表（Table）形式で表示し、結果入力をモーダルで行えるコンポーネント。
 */
export default function TournamentTree({ eventId, matches, onResultSaved }: Props) {
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <Icon name="account_tree" size={44} className="opacity-20" />
        <p className="text-sm font-medium">本戦（決勝トーナメント）の試合がありません</p>
        <p className="text-xs">
          タイムテーブル設定で「予選」フラグが OFF のセグメントに試合を生成してください。
        </p>
      </div>
    );
  }

  // セグメント順にグループ化（本戦セグメント）
  const segmentGroups = Array.from(
    matches.reduce((acc, m) => {
      const segId = m.event_timetable_segment_id ?? 0;
      if (!acc.has(segId)) {
        acc.set(segId, {
          segId,
          segName: m.timetable_segment_name ?? `ラウンド ${segId}`,
          segOrder: m.segment_order ?? 0,
          matches: [],
        });
      }
      acc.get(segId)!.matches.push(m);
      return acc;
    }, new Map<number, { segId: number; segName: string; segOrder: number; matches: MatchListItem[] }>())
    .values()
  ).sort((a, b) => a.segOrder - b.segOrder);

  function openEdit(m: MatchListItem) {
    setEditState({
      matchId: m.id,
      affVotes: String(m.aff_votes ?? ""),
      negVotes: String(m.neg_votes ?? ""),
      affComm: String(m.aff_comm_sum ?? ""),
      negComm: String(m.neg_comm_sum ?? ""),
      affManner: String(m.aff_manner ?? ""),
      negManner: String(m.neg_manner ?? ""),
    });
    setError(null);
  }

  async function handleSave(confirmed: boolean) {
    if (!editState) return;
    setSaving(true);
    setError(null);
    try {
      await saveMatchResult(eventId, editState.matchId, {
        aff_votes: parseInt(editState.affVotes) || 0,
        neg_votes: parseInt(editState.negVotes) || 0,
        aff_comm_sum: parseInt(editState.affComm) || 0,
        neg_comm_sum: parseInt(editState.negComm) || 0,
        aff_manner: parseInt(editState.affManner) || 0,
        neg_manner: parseInt(editState.negManner) || 0,
        is_result_confirmed: confirmed,
      });
      setEditState(null);
      onResultSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const currentEditingMatch = editState ? matches.find(m => m.id === editState.matchId) : null;

  return (
    <div className="space-y-8">
      {segmentGroups.map(({ segId, segName, matches: segMatches }) => (
        <div key={segId} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Icon name="emoji_events" size={16} className="text-primary" />
            </div>
            <h3 className="font-bold text-base">{segName}</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {segMatches.length} 試合
            </span>
          </div>

          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow hover={false}>
                  <TableHead className="w-40">会場</TableHead>
                  <TableHead className="w-32">部門</TableHead>
                  <TableHead>肯定側（Aff）</TableHead>
                  <TableHead align="center" className="w-16">VS</TableHead>
                  <TableHead>否定側（Neg）</TableHead>
                  <TableHead align="center" className="w-56">結果</TableHead>
                  <TableHead align="center" className="w-28">状態</TableHead>
                  <TableHead align="right" className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segMatches.map((m) => {
                  const affWon = m.is_result_confirmed && (m.aff_won ?? 0) > (m.neg_won ?? 0);
                  const negWon = m.is_result_confirmed && (m.neg_won ?? 0) > (m.aff_won ?? 0);

                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm font-medium">{m.room_name ?? "未割当"}</TableCell>
                      <TableCell>
                        {m.section_name && (
                          <Badge variant="outline">{m.section_name}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${affWon ? "text-primary font-bold" : ""}`}>
                          {m.aff_team_name ?? "未設定"}
                        </span>
                        {affWon && <Badge variant="success" className="ml-2 text-[10px]">勝</Badge>}
                      </TableCell>
                      <TableCell align="center">
                        <span className="text-muted-foreground font-bold text-xs">VS</span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${negWon ? "text-pink-600 font-bold" : ""}`}>
                          {m.neg_team_name ?? "未設定"}
                        </span>
                        {negWon && <Badge variant="success" className="ml-2 text-[10px]">勝</Badge>}
                      </TableCell>
                      <TableCell align="center">
                        {m.is_result_confirmed ? (
                          <span className="text-sm font-mono font-bold">
                            {m.aff_votes ?? 0} - {m.neg_votes ?? 0} ({m.aff_comm_sum ?? 0}pt - {m.neg_comm_sum ?? 0}pt)
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {m.is_result_confirmed ? (
                          <Badge variant="success" className="text-[10px]">確定済</Badge>
                        ) : m.aff_votes !== null || m.neg_votes !== null ? (
                          <Badge variant="warning" className="text-[10px]">一時保存</Badge>
                        ) : (
                          <Badge variant="default" className="text-[10px]">未入力</Badge>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2 h-auto rounded-full text-primary"
                          onClick={() => openEdit(m)}
                        >
                          <Icon name="edit" size={18} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      {/* Edit Modal */}
      {editState && (
        <Modal
          isOpen={editState !== null}
          onClose={() => setEditState(null)}
          title="対戦結果の入力・編集"
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditState(null)} disabled={saving}>
                キャンセル
              </Button>
              <Button variant="outlined" onClick={() => handleSave(false)} loading={saving} disabled={saving}>
                下書き保存
              </Button>
              <Button onClick={() => handleSave(true)} loading={saving} disabled={saving}>
                確定保存
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Aff Form */}
              <div className="space-y-3 p-4 bg-blue-50/30 border border-blue-100 rounded-xl">
                <p className="font-bold text-sm text-blue-900 border-b border-blue-100 pb-1 flex items-center justify-between">
                  <span>肯定側 (Aff)</span>
                  <span className="text-xs text-blue-700 font-medium truncate max-w-[180px]">
                    {currentEditingMatch?.aff_team_name ?? "未設定"}
                  </span>
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">得票数</label>
                    <input
                      type="number"
                      placeholder="得票数"
                      value={editState.affVotes}
                      onChange={(e) => setEditState({ ...editState, affVotes: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">コミュニケーション点合計</label>
                    <input
                      type="number"
                      placeholder="コミュ合計"
                      value={editState.affComm}
                      onChange={(e) => setEditState({ ...editState, affComm: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">マナー点</label>
                    <input
                      type="number"
                      placeholder="マナー点"
                      value={editState.affManner}
                      onChange={(e) => setEditState({ ...editState, affManner: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Neg Form */}
              <div className="space-y-3 p-4 bg-pink-50/30 border border-pink-100 rounded-xl">
                <p className="font-bold text-sm text-pink-900 border-b border-pink-100 pb-1 flex items-center justify-between">
                  <span>否定側 (Neg)</span>
                  <span className="text-xs text-pink-700 font-medium truncate max-w-[180px]">
                    {currentEditingMatch?.neg_team_name ?? "未設定"}
                  </span>
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">得票数</label>
                    <input
                      type="number"
                      placeholder="得票数"
                      value={editState.negVotes}
                      onChange={(e) => setEditState({ ...editState, negVotes: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">コミュニケーション点合計</label>
                    <input
                      type="number"
                      placeholder="コミュ合計"
                      value={editState.negComm}
                      onChange={(e) => setEditState({ ...editState, negComm: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">マナー点</label>
                    <input
                      type="number"
                      placeholder="マナー点"
                      value={editState.negManner}
                      onChange={(e) => setEditState({ ...editState, negManner: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
