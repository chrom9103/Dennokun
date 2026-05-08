"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";

const mockStandings: { rank: number; team: string; school: string; wins: number; losses: number; total: number; avg: number }[] = [];

function TrophyIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Icon name="emoji_events" size={20} className="text-yellow-500" />;
  if (rank === 2) return <Icon name="emoji_events" size={20} className="text-gray-400" />;
  if (rank === 3) return <Icon name="emoji_events" size={20} className="text-amber-600" />;
  return null;
}

export default function StandingsPage() {
  const [division, setDivision] = useState("high-school");

  const handleExport = () => {
    console.log("Exporting standings...");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">順位表</h1>
          <p className="text-sm text-muted-foreground mt-1">
            現在の対戦結果に基づいたリアルタイムの順位を表示します。
          </p>
        </div>
        <Button variant="outlined" icon="download" onClick={handleExport}>
          CSVエクスポート
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2">
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none min-w-[160px]"
            >
              <option value="high-school">高校生部門</option>
              <option value="middle-school">中学生部門</option>
            </select>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Icon name="info" size={14} />
            順位は勝数、総得点、平均点の順で決定されます
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <Table className="border-none rounded-none">
            <TableHeader>
              <TableRow hover={false}>
                <TableHead align="center" className="w-16">順位</TableHead>
                <TableHead>チーム名</TableHead>
                <TableHead>学校</TableHead>
                <TableHead align="center">勝</TableHead>
                <TableHead align="center">負</TableHead>
                <TableHead align="center">勝率</TableHead>
                <TableHead align="center">総得点</TableHead>
                <TableHead align="center">平均点</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockStandings.length === 0 ? (
                <TableRow hover={false}>
                  <TableCell colSpan={8} className="py-20 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="analytics" size={40} className="opacity-20" />
                      <p>試合結果がまだ入力されていません</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                mockStandings.map((s) => (
                  <TableRow key={s.rank}>
                    <TableCell align="center">
                      <div className="flex items-center justify-center gap-1.5">
                        <TrophyIcon rank={s.rank} />
                        <span className={`text-lg font-bold ${s.rank <= 3 ? "text-primary" : "text-muted-foreground"}`}>
                          {s.rank}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{s.team}</TableCell>
                    <TableCell className="text-muted-foreground">{s.school}</TableCell>
                    <TableCell align="center">
                      <Badge variant="success">{s.wins}</Badge>
                    </TableCell>
                    <TableCell align="center">
                      <Badge variant="destructive">{s.losses}</Badge>
                    </TableCell>
                    <TableCell align="center" className="font-mono">
                      {((s.wins / (s.wins + s.losses || 1)) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell align="center" className="font-bold">
                      {s.total}
                    </TableCell>
                    <TableCell align="center">
                      {s.avg.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-info-light/30 border-info-light">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info-light text-info">
              <Icon name="groups" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">参加チーム</p>
              <p className="text-xl font-bold">0 チーム</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-success-light/30 border-success-light">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-light text-success">
              <Icon name="check_circle" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">完了済み試合</p>
              <p className="text-xl font-bold">0 / 0</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-warning-light/30 border-warning-light">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-light text-yellow-700">
              <Icon name="pending_actions" size={24} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">残り試合数</p>
              <p className="text-xl font-bold">0 試合</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
