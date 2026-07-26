"use client";

import React from "react";
import { MatchListItem } from "@/lib/matchApi";
import { TimetableSegment, Section, Room } from "@/lib/masterApi";

interface Props {
  matches: MatchListItem[];
  segments: TimetableSegment[];
  sections: Section[];
  rooms: Room[];
  eventName?: string;
  /** "pre" = 予選のみ, "main" = 本選のみ */
  roundType: "pre" | "main";
  /** html2canvas でキャプチャするルート要素の id */
  rootId: string;
}

interface FlatRowItem {
  match: MatchListItem;
  isFirstInSegment: boolean;
  rowSpan: number;
  segmentName: string;
  timeStr: string;
}

/**
 * 参考画像（格子状印刷テーブル）のデザインを忠実に再現する試合結果テーブル。
 * roundType で予選 / 本選を切り替える。1インスタンス = 1テーブル。
 */
export default function MatchResultExport({
  matches,
  segments,
  eventName = "大会",
  roundType,
  rootId,
}: Props) {
  // roundType に応じてセグメントを絞り込みソート
  const targetSegments = segments
    .filter((s) => (roundType === "pre" ? s.is_pre_round : !s.is_pre_round))
    .sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0));

  const flatRows: FlatRowItem[] = [];
  targetSegments.forEach((seg) => {
    const segMatches = matches
      .filter((m) => m.event_timetable_segment_id === seg.id && m.is_result_confirmed)
      .sort((a, b) =>
        (a.room_name ?? "").localeCompare(b.room_name ?? "", undefined, { numeric: true })
      );

    if (segMatches.length === 0) return;

    const timeStr = [seg.start_time, seg.end_time].filter(Boolean).join("-");

    segMatches.forEach((m, idx) => {
      flatRows.push({
        match: m,
        isFirstInSegment: idx === 0,
        rowSpan: segMatches.length,
        segmentName: seg.name,
        timeStr,
      });
    });
  });

  return (
    <div
      id={rootId}
      style={{
        background: "#fff",
        fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif",
        padding: "24px 20px",
        width: "1024px",
        boxSizing: "border-box",
        color: "#000",
      }}
    >
      {flatRows.length === 0 ? (
        <p style={{ textAlign: "center", color: "#888", padding: "40px 0" }}>
          確定済みの試合がまだありません。
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 50px 80px 1fr 1fr 60px 70px 60px",
            border: "2px solid #000",
            backgroundColor: "#000",
            gap: "1px",
            width: "100%",
          }}
        >
          {/* ヘッダー行 */}
          <div style={{ ...thStyle(), gridRow: "1", gridColumn: "1" }}>時間</div>
          <div style={{ ...thStyle(), gridRow: "1", gridColumn: "2" }}>会場</div>
          <div style={{ ...thStyle(), gridRow: "1", gridColumn: "3" }}>部門</div>
          <div style={{ ...thStyle(), gridRow: "1", gridColumn: "4" }}>肯定側</div>
          <div style={{ ...thStyle(), gridRow: "1", gridColumn: "5" }}>否定側</div>
          <div style={{ ...thStyle(), gridRow: "1", gridColumn: "6" }}>コミュ点</div>
          <div style={{ ...thStyle(), gridRow: "1", gridColumn: "7" }}>得票</div>
          <div style={{ ...thStyle(), gridRow: "1", gridColumn: "8" }}>コミュ点</div>

          {/* データ行 */}
          {flatRows.map((row, idx) => {
            const m = row.match;
            const gridRowIndex = idx + 2;

            return (
              <React.Fragment key={m.id}>
                {row.isFirstInSegment && (
                  <div
                    style={{
                      gridRow: `${gridRowIndex} / span ${row.rowSpan}`,
                      gridColumn: "1",
                      backgroundColor: "#fff",
                      padding: "8px 4px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: "13px",
                      whiteSpace: "pre-line",
                      lineHeight: "1.4",
                      color: "#000",
                    }}
                  >
                    {row.segmentName}
                    {row.timeStr ? `\n${row.timeStr}` : ""}
                  </div>
                )}
                <div style={{ ...tdStyle("center"), gridRow: `${gridRowIndex}`, gridColumn: "2" }}>
                  {m.room_name ?? "-"}
                </div>
                <div style={{ ...tdStyle("center"), gridRow: `${gridRowIndex}`, gridColumn: "3" }}>
                  {m.section_name ?? "-"}
                </div>
                <div style={{ ...tdStyle("left"), gridRow: `${gridRowIndex}`, gridColumn: "4" }}>
                  {m.aff_team_name ?? "-"}
                </div>
                <div style={{ ...tdStyle("left"), gridRow: `${gridRowIndex}`, gridColumn: "5" }}>
                  {m.neg_team_name ?? "-"}
                </div>
                <div style={{ ...commTdStyle, gridRow: `${gridRowIndex}`, gridColumn: "6" }}>
                  ({m.aff_comm_sum ?? "-"})
                </div>
                <div style={{ ...votesTdStyle, gridRow: `${gridRowIndex}`, gridColumn: "7" }}>
                  {m.aff_votes ?? "-"} - {m.neg_votes ?? "-"}
                </div>
                <div style={{ ...commTdStyle, gridRow: `${gridRowIndex}`, gridColumn: "8" }}>
                  ({m.neg_comm_sum ?? "-"})
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ヘッダースタイル
function thStyle(width?: string): React.CSSProperties {
  return {
    padding: "6px 4px",
    textAlign: "center",
    fontSize: "13px",
    fontWeight: "bold",
    width: width,
    whiteSpace: "nowrap",
    backgroundColor: "#fff",
    color: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

// データセルスタイル
function tdStyle(align: "left" | "center" = "left"): React.CSSProperties {
  return {
    padding: "6px 8px",
    textAlign: align,
    fontSize: "13px",
    verticalAlign: "middle",
    backgroundColor: "#fff",
    color: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: align === "left" ? "flex-start" : "center",
  };
}

// コミュ点（太字・青）
const commTdStyle: React.CSSProperties = {
  padding: "6px 4px",
  textAlign: "center",
  verticalAlign: "middle",
  fontWeight: "bold",
  color: "#0000ff",
  fontSize: "13px",
  backgroundColor: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// 得票数（太字・赤）
const votesTdStyle: React.CSSProperties = {
  padding: "6px 4px",
  textAlign: "center",
  verticalAlign: "middle",
  fontWeight: "bold",
  color: "#ff0000",
  fontSize: "13px",
  backgroundColor: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
