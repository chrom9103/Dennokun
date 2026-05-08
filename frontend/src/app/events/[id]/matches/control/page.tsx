"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import MatchAutoGenerator from "@/components/pages/events/matches/control/MatchAutoGenerator";
import MatchImportCard from "@/components/pages/events/matches/control/MatchImportCard";

export default function ControlPage() {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setSuccess(false);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setGenerating(false);
          setSuccess(true);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const handleImport = async (data: string[][]) => {
    setImportLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setImportLoading(false);
    setSuccess(true);
    console.log("Imported matches:", data);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">組み合わせ制御</h1>
          <p className="text-sm text-muted-foreground mt-1">
            大会の対戦カードを自動生成、またはファイルから登録します。
          </p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-success-light border border-success/20 text-success text-sm font-medium animate-in slide-in-from-top-2">
          <Icon name="check_circle" size={20} />
          試合枠の処理が完了しました
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MatchAutoGenerator
          onGenerate={handleGenerate}
          isGenerating={generating}
          progress={progress}
        />
        <MatchImportCard
          onImport={handleImport}
          isLoading={importLoading}
        />
      </div>

      {/* Generated matches area */}
      <div className="bg-white rounded-xl shadow-[var(--shadow-sm)] border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/10 flex items-center justify-between">
          <h3 className="font-semibold">生成済み試合枠</h3>
          <Badge variant="outline">0 試合</Badge>
        </div>
        <div className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Icon name="sports_score" size={32} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            試合枠を生成すると、ここに詳細が表示されます
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            左のパネルから生成を開始してください
          </p>
        </div>
      </div>
    </div>
  );
}
