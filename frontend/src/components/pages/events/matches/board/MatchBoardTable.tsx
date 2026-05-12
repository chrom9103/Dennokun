"use client";

import React from "react";
import { useRouter, useParams } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";

interface Match {
  id: string;
  round: string;
  division: string;
  team1: string;
  team2: string;
  room: string;
  startTime: string;
  endTime: string;
  status: "scheduled" | "in-progress" | "completed";
  score1?: number;
  score2?: number;
}

interface MatchBoardTableProps {
  matches: Match[];
}

export default function MatchBoardTable({ matches }: MatchBoardTableProps) {
  const router = useRouter();
  const params = useParams();

  const getStatusCfg = (status: string) => {
    switch (status) {
      case "completed": return { label: "完了", variant: "success" as const };
      case "in-progress": return { label: "進行中", variant: "warning" as const };
      default: return { label: "予定", variant: "default" as const };
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow hover={false}>
          <TableHead>ステータス</TableHead>
          <TableHead>ラウンド</TableHead>
          <TableHead>部門</TableHead>
          <TableHead>対戦</TableHead>
          <TableHead>会場 / 時間</TableHead>
          <TableHead align="center">スコア</TableHead>
          <TableHead align="right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {matches.length === 0 ? (
          <TableRow hover={false}>
            <TableCell colSpan={7} align="center" className="py-12 text-muted-foreground">
              条件に一致する試合が見つかりません
            </TableCell>
          </TableRow>
        ) : (
          matches.map((m) => {
            const cfg = getStatusCfg(m.status);
            return (
              <TableRow key={m.id}>
                <TableCell>
                  <Badge variant={cfg.variant} dot>
                    {cfg.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{m.round}</TableCell>
                <TableCell>
                  <Badge variant="outline">{m.division}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 font-bold">
                    <span className="text-primary">{m.team1}</span>
                    <span className="text-muted-foreground font-normal text-xs">vs</span>
                    <span className="text-primary">{m.team2}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div className="font-medium">{m.room}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.startTime} - {m.endTime}
                    </div>
                  </div>
                </TableCell>
                <TableCell align="center">
                  {m.status === "completed" ? (
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-secondary rounded font-mono font-bold">
                      {m.score1} - {m.score2}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 h-auto rounded-full text-primary"
                    onClick={() => router.push(`/events/${params?.id}/matches/${m.id}/edit`)}
                  >
                    <Icon name={m.status === "completed" ? "visibility" : "edit"} size={18} />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
