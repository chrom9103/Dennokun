"use client";

import { useRef } from "react";
import { MatchListItem } from "@/lib/matchApi";
import { TimetableSegment, Section, Room } from "@/lib/masterApi";

interface Props {
  matches: MatchListItem[];
  segments: TimetableSegment[];
  sections: Section[];
  rooms: Room[];
  eventName?: string;
}

/**
 * 参考画像（旧システムの静的HTML）のフォーマットを再現する試合結果テーブル。
 * このコンポーネント自体をキャプチャして PNG/JPEG/PDF に出力する。
 */
export default function MatchResultExport({
  matches,
  segments,
  sections,
  rooms,
  eventName = "大会",
}: Props) {
  // 予選セグメントのみ（is_pre_round=true）でフィルタ
  const preRoundSegments = segments
    .filter((s) => s.is_pre_round)
    .sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0));

  // セグメントIDごとに試合をグループ化
  const matchesBySegment: Record<number, MatchListItem[]> = {};
  preRoundSegments.forEach((seg) => {
    matchesBySegment[seg.id] = matches
      .filter((m) => m.event_timetable_segment_id === seg.id)
      .sort((a, b) => (a.order_number_in_segment ?? 0) - (b.order_number_in_segment ?? 0));
  });

  // 確定済み試合が1件でもある場合のみ表示
  const hasAnyConfirmed = matches.some((m) => m.is_result_confirmed);

  return (
    <div
      id="match-result-export-root"
      style={{
        background: "#fff",
        fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif",
        padding: "24px 20px",
        minWidth: "900px",
        color: "#111",
        fontSize: "13px",
      }}
    >
      {/* タイトル */}
      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "4px" }}>
          {eventName} — 試合結果
        </h1>
        <p style={{ color: "#666", fontSize: "11px" }}>
          ※確定済み試合のみ表示しています
        </p>
      </div>

      {preRoundSegments.map((seg) => {
        const segMatches = matchesBySegment[seg.id] ?? [];
        const confirmedMatches = segMatches.filter((m) => m.is_result_confirmed);
        if (confirmedMatches.length === 0) return null;

        return (
          <div key={seg.id} style={{ marginBottom: "20px" }}>
            {/* 時間枠ヘッダー */}
            <div
              style={{
                background: "#1e3a5f",
                color: "#fff",
                padding: "6px 12px",
                fontWeight: "bold",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>{seg.name}</span>
              {seg.start_time && (
                <span style={{ fontSize: "11px", opacity: 0.85 }}>
                  {seg.start_time}
                  {seg.end_time ? `〜${seg.end_time}` : ""}
                </span>
              )}
            </div>

            {/* 試合テーブル */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
              }}
            >
              <thead>
                <tr style={{ background: "#dbe8f5" }}>
                  <th style={thStyle("60px")}>会場</th>
                  <th style={thStyle("80px")}>部門</th>
                  <th style={thStyle()}>肯定側</th>
                  <th style={thStyle("44px")}>コミュ</th>
                  <th style={thStyle("50px")}>得票</th>
                  <th style={thStyle()}>否定側</th>
                  <th style={thStyle("44px")}>コミュ</th>
                </tr>
              </thead>
              <tbody>
                {confirmedMatches.map((m, idx) => {
                  const isEven = idx % 2 === 0;
                  const rowBg = isEven ? "#fff" : "#f5f9ff";
                  const affWon = (m.aff_won ?? 0) > (m.neg_won ?? 0);
                  const negWon = (m.neg_won ?? 0) > (m.aff_won ?? 0);
                  const isTie = (m.aff_won ?? 0) === (m.neg_won ?? 0);

                  return (
                    <tr key={m.id} style={{ background: rowBg }}>
                      <td style={tdStyle("center")}>{m.room_name ?? "-"}</td>
                      <td style={tdStyle("center")}>
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "1px 4px",
                            background: "#e8eef7",
                            borderRadius: "3px",
                          }}
                        >
                          {m.section_name ?? "-"}
                        </span>
                      </td>
                      {/* 肯定側 */}
                      <td
                        style={{
                          ...tdStyle("left"),
                          fontWeight: affWon ? "bold" : "normal",
                          color: affWon ? "#1a4a8a" : "#111",
                        }}
                      >
                        {m.aff_team_name ?? "-"}
                      </td>
                      <td style={{ ...tdStyle("center"), color: "#555" }}>
                        ({m.aff_comm_sum ?? "-"})
                      </td>
                      {/* 得票スコア */}
                      <td style={{ ...tdStyle("center"), fontWeight: "bold" }}>
                        {isTie ? (
                          <span style={{ color: "#888" }}>
                            {m.aff_votes ?? "-"} - {m.neg_votes ?? "-"}
                          </span>
                        ) : affWon ? (
                          <span style={{ color: "#1a4a8a" }}>
                            {m.aff_votes ?? "-"} - {m.neg_votes ?? "-"}
                          </span>
                        ) : (
                          <span style={{ color: "#c0392b" }}>
                            {m.aff_votes ?? "-"} - {m.neg_votes ?? "-"}
                          </span>
                        )}
                      </td>
                      {/* 否定側 */}
                      <td
                        style={{
                          ...tdStyle("left"),
                          fontWeight: negWon ? "bold" : "normal",
                          color: negWon ? "#8a1a1a" : "#111",
                        }}
                      >
                        {m.neg_team_name ?? "-"}
                      </td>
                      <td style={{ ...tdStyle("center"), color: "#555" }}>
                        ({m.neg_comm_sum ?? "-"})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {!hasAnyConfirmed && (
        <p style={{ textAlign: "center", color: "#888", padding: "40px 0" }}>
          確定済みの試合がまだありません。
        </p>
      )}
    </div>
  );
}

// スタイルヘルパー
function thStyle(width?: string): React.CSSProperties {
  return {
    border: "1px solid #c0cfe0",
    padding: "5px 8px",
    textAlign: "center",
    fontSize: "11px",
    fontWeight: "bold",
    width: width,
    whiteSpace: "nowrap",
  };
}

function tdStyle(align: "left" | "center" | "right" = "left"): React.CSSProperties {
  return {
    border: "1px solid #dde6f0",
    padding: "5px 8px",
    textAlign: align,
    fontSize: "12px",
    verticalAlign: "middle",
  };
}
