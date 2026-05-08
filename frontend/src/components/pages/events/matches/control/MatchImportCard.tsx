"use client";

import React from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import TsvImportButton from "@/components/elements/TsvImportButton";

interface MatchImportCardProps {
  onImport: (data: any) => void;
  isLoading: boolean;
}

export default function MatchImportCard({ onImport, isLoading }: MatchImportCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-[var(--shadow-sm)] border border-border p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg bg-success-light flex items-center justify-center">
          <Icon name="upload_file" className="text-success" size={28} />
        </div>
        <div>
          <h3 className="font-semibold text-lg">TSVインポート</h3>
          <p className="text-xs text-muted-foreground">外部データの一括登録</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        外部のツール等で作成した試合枠データをTSVファイルから一括登録します。既存の試合枠がある場合は上書きされる可能性があります。
      </p>

      <div className="bg-secondary/50 rounded-xl p-5 mb-8 flex-1 border border-border border-dashed">
        <p className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">推奨TSVフォーマット</p>
        <div className="font-mono text-[10px] text-muted-foreground space-y-1 bg-white p-3 rounded border border-border">
          <p>ラウンド [TAB] 部門 [TAB] チーム1 [TAB] チーム2 [TAB] 会場 [TAB] 時間枠</p>
          <hr className="my-1.5 border-border" />
          <p className="text-primary/70">例: 予選第1試合 [TAB] 高校生部門 [TAB] チームA [TAB] チームB [TAB] 第1会場 [TAB] 午前の部</p>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 flex items-start gap-1">
          <Icon name="info" size={12} className="mt-0.5" />
          UTF-8形式のテキストファイルを選択してください。
        </p>
      </div>

      <TsvImportButton
        onImport={onImport}
        isLoading={isLoading}
        label="TSVファイルを選択してインポート"
      />
    </div>
  );
}
