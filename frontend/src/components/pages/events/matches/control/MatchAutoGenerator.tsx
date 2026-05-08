"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";

interface MatchAutoGeneratorProps {
  onGenerate: (params: any) => void;
  isGenerating: boolean;
  progress: number;
}

export default function MatchAutoGenerator({
  onGenerate,
  isGenerating,
  progress,
}: MatchAutoGeneratorProps) {
  return (
    <div className="bg-white rounded-lg shadow-[var(--shadow-sm)] border border-border p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg bg-info-light flex items-center justify-center">
          <Icon name="auto_awesome" className="text-primary" size={28} />
        </div>
        <div>
          <h3 className="font-semibold text-lg">自動組み合わせ生成</h3>
          <p className="text-xs text-muted-foreground">アルゴリズムによる最適化</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        設定に基づいて試合の組み合わせを自動生成します。利害関係校の制約やスタッフの参加可能枠を考慮し、公平なマッチングを行います。
      </p>

      <div className="space-y-4 mb-8 flex-1">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ラウンド</label>
          <select className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all">
            <option>予選 第1試合</option>
            <option>予選 第2試合</option>
            <option>予選 第3試合</option>
            <option>本選</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">部門</label>
          <select className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all">
            <option>高校生部門</option>
            <option>中学生部門</option>
          </select>
        </div>
        <Input
          label="グループ数"
          type="number"
          defaultValue={4}
          className="h-10"
        />
      </div>

      {isGenerating && (
        <div className="mb-6 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              最適化エンジン実行中...
            </span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <Button
        onClick={onGenerate}
        loading={isGenerating}
        fullWidth
        size="lg"
        icon="play_arrow"
      >
        {isGenerating ? "生成中..." : "組み合わせを生成"}
      </Button>
    </div>
  );
}
