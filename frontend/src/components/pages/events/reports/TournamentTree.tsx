"use client";

import { useState } from "react";
import { MatchListItem } from "@/lib/matchApi";
import { saveMatchResult } from "@/lib/matchApi";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";

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
 * 簡易的なブラケット形式で表示し、スコア編集を可能にするコンポーネント。
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

  return (
    <div className="space-y-6">
      {segmentGroups.map(({ segId, segName, matches: segMatches }) => (
        <div key={segId}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Icon name="emoji_events" size={16} className="text-primary" />
            </div>
            <h3 className="font-bold text-base">{segName}</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {segMatches.length} 試合
            </span>
          </div>

          {/* ブラケット行（横並び） */}
          <div className="flex flex-wrap gap-3">
            {segMatches.map((m) => {
              const affWon = (m.aff_won ?? 0) > (m.neg_won ?? 0);
              const negWon = (m.neg_won ?? 0) > (m.aff_won ?? 0);
              const isEditing = editState?.matchId === m.id;

              return (
                <div
                  key={m.id}
                  className="bg-white rounded-xl border border-border shadow-sm min-w-[260px] max-w-[320px] flex-1"
                >
                  {/* 会場・部門 */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/20 rounded-t-xl">
                    <span className="text-xs font-medium text-muted-foreground">
                      {m.room_name ?? "未割当"}
                    </span>
                    <div className="flex items-center gap-2">
                      {m.section_name && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {m.section_name}
                        </span>
                      )}
                      {m.is_result_confirmed && (
                        <Icon name="check_circle" size={14} className="text-green-500" />
                      )}
                    </div>
                  </div>

                  {/* 対戦内容 */}
                  <div className="p-3 space-y-2">
                    {/* 肯定側 */}
                    <div
                      className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${
                        affWon ? "bg-blue-50 border border-blue-200" : "bg-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {affWon && <Icon name="emoji_events" size={14} className="text-yellow-500" />}
                        <span className={`text-sm ${affWon ? "font-bold text-blue-700" : "text-foreground"}`}>
                          {m.aff_team_name ?? "未設定"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground">肯定</span>
                        {m.is_result_confirmed && (
                          <div className="text-xs font-mono font-bold text-foreground">
                            {m.aff_votes ?? "-"}票 / {m.aff_comm_sum ?? "-"}pt
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-center text-[10px] text-muted-foreground font-bold tracking-widest">
                      VS
                    </div>

                    {/* 否定側 */}
                    <div
                      className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${
                        negWon ? "bg-red-50 border border-red-200" : "bg-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {negWon && <Icon name="emoji_events" size={14} className="text-yellow-500" />}
                        <span className={`text-sm ${negWon ? "font-bold text-red-700" : "text-foreground"}`}>
                          {m.neg_team_name ?? "未設定"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground">否定</span>
                        {m.is_result_confirmed && (
                          <div className="text-xs font-mono font-bold text-foreground">
                            {m.neg_votes ?? "-"}票 / {m.neg_comm_sum ?? "-"}pt
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 編集ボタン */}
                  <div className="px-3 pb-3">
                    <Button
                      variant="outlined"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => openEdit(m)}
                    >
                      <Icon name="edit" size={14} />
                      <span className="ml-1">結果を入力・編集</span>
                    </Button>
                  </div>

                  {/* インライン編集フォーム */}
                  {isEditing && editState && (
                    <div className="border-t border-border px-3 pb-3 pt-2 space-y-3 bg-muted/10 rounded-b-xl">
                      <p className="text-xs font-bold text-foreground">スコア入力</p>

                      {error && (
                        <p className="text-xs text-red-600">{error}</p>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground mb-1 font-semibold">肯定側</p>
                          <div className="space-y-1">
                            <input
                              type="number"
                              placeholder="得票数"
                              value={editState.affVotes}
                              onChange={(e) => setEditState({ ...editState, affVotes: e.target.value })}
                              className="w-full px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <input
                              type="number"
                              placeholder="コミュ合計"
                              value={editState.affComm}
                              onChange={(e) => setEditState({ ...editState, affComm: e.target.value })}
                              className="w-full px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <input
                              type="number"
                              placeholder="マナー点"
                              value={editState.affManner}
                              onChange={(e) => setEditState({ ...editState, affManner: e.target.value })}
                              className="w-full px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1 font-semibold">否定側</p>
                          <div className="space-y-1">
                            <input
                              type="number"
                              placeholder="得票数"
                              value={editState.negVotes}
                              onChange={(e) => setEditState({ ...editState, negVotes: e.target.value })}
                              className="w-full px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <input
                              type="number"
                              placeholder="コミュ合計"
                              value={editState.negComm}
                              onChange={(e) => setEditState({ ...editState, negComm: e.target.value })}
                              className="w-full px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <input
                              type="number"
                              placeholder="マナー点"
                              value={editState.negManner}
                              onChange={(e) => setEditState({ ...editState, negManner: e.target.value })}
                              className="w-full px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => handleSave(true)}
                          loading={saving}
                        >
                          確定保存
                        </Button>
                        <Button
                          variant="outlined"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => handleSave(false)}
                          loading={saving}
                        >
                          一時保存
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs px-2"
                          onClick={() => setEditState(null)}
                        >
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
