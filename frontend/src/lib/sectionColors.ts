/**
 * sectionColors.ts — 部門ラベル色分けユーティリティ
 *
 * 部門一覧のインデックス（マスタの登録順）に基づいて背景色・テキスト色を返す。
 * 1番目: 赤 / 2番目: 青 / 3番目: 黄 / 4番目: 緑 / 5番目: オレンジ / 6番目: 紫 / 7番目以降: ランダム
 */

export interface SectionColor {
  /** Tailwind の bg-* クラスには使わず、インラインスタイルで使うHEX */
  bg: string;
  text: string;
  border: string;
}

const PRESET_COLORS: SectionColor[] = [
  { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" }, // 赤
  { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" }, // 青
  { bg: "#fef9c3", text: "#a16207", border: "#fde047" }, // 黄
  { bg: "#dcfce7", text: "#15803d", border: "#86efac" }, // 緑
  { bg: "#ffedd5", text: "#c2410c", border: "#fdba74" }, // オレンジ
  { bg: "#f3e8ff", text: "#7e22ce", border: "#d8b4fe" }, // 紫
];

/**
 * インデックスに基づいて部門の色を返す。
 * 7番目以降は文字列ハッシュからランダムに色を生成する。
 *
 * @param index - 部門の0始まりインデックス（sections配列の順）
 * @param sectionId - 7番目以降のランダム色を一意にするためのID
 */
export function getSectionColor(index: number, sectionId?: number): SectionColor {
  if (index < PRESET_COLORS.length) {
    return PRESET_COLORS[index];
  }

  // 7番目以降: sectionId または index をもとにした疑似ランダム色
  const seed = sectionId ?? index;
  const hue = (seed * 137 + 30) % 360; // 黄金角ベースで分散
  return {
    bg: `hsl(${hue}, 70%, 92%)`,
    text: `hsl(${hue}, 60%, 30%)`,
    border: `hsl(${hue}, 60%, 70%)`,
  };
}

/**
 * 部門IDと部門リストから色を取得するヘルパー。
 * 部門IDが一致するインデックスを探し、getSectionColor を呼ぶ。
 */
export function getSectionColorById(
  sectionId: number | null | undefined,
  sections: Array<{ id: number }>
): SectionColor {
  if (sectionId == null) {
    return { bg: "#f1f5f9", text: "#64748b", border: "#cbd5e1" };
  }
  const idx = sections.findIndex((s) => s.id === sectionId);
  if (idx === -1) {
    return { bg: "#f1f5f9", text: "#64748b", border: "#cbd5e1" };
  }
  return getSectionColor(idx, sectionId);
}
