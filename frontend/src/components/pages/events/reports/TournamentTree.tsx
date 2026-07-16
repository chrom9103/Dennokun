"use client";

import { MatchListItem } from "@/lib/matchApi";
import Icon from "@/components/ui/Icon";
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
  matches: MatchListItem[];
}

/**
 * 本戦（is_pre_round=false）のセグメントに属する試合を
 * 進行ボードと同様の表（Table）形式で表示するコンポーネント（閲覧専用）。
 */
export default function TournamentTree({ matches }: Props) {
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
                  <TableHead className="w-48">会場</TableHead>
                  <TableHead className="w-32">部門</TableHead>
                  <TableHead>肯定側（Aff）</TableHead>
                  <TableHead align="center" className="w-16">VS</TableHead>
                  <TableHead>否定側（Neg）</TableHead>
                  <TableHead align="center" className="w-56">結果</TableHead>
                  <TableHead align="center" className="w-28">状態</TableHead>
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
