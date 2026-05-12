"use client";

import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import TsvImportButton from "@/components/elements/TsvImportButton";
import TeamTable from "@/components/pages/events/master/teams/TeamTable";

export default function TeamsPage() {
  const [teams] = useState<{ id: string; name: string; schoolName: string; division: string; group: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDivision, setFilterDivision] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [isImporting, setIsImporting] = useState(false);

  const filteredTeams = teams.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.schoolName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDiv = filterDivision === "all" || t.division === filterDivision;
    const matchGrp = filterGroup === "all" || t.group === filterGroup;
    return matchSearch && matchDiv && matchGrp;
  });

  const handleImport = async (rows: string[][]) => {
    setIsImporting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsImporting(false);
    alert(`${rows.length}件のデータをインポートしました（デモ）`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">チーム管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            大会に参加する各チームの編成と部門・グループを管理します。
          </p>
        </div>
        <div className="flex gap-2">
          <TsvImportButton onImport={handleImport} isLoading={isImporting} />
          <Button icon="group_add">チーム追加</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row gap-4 items-end md:items-center">
          <div className="flex-1 w-full">
            <Input
              placeholder="チーム名、学校名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="search-teams"
              className="h-10"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select 
              value={filterDivision} 
              onChange={(e) => setFilterDivision(e.target.value)} 
              className="flex-1 md:w-40 h-10 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            >
              <option value="all">すべての部門</option>
              <option value="高校生部門">高校生部門</option>
              <option value="中学生部門">中学生部門</option>
            </select>
            <select 
              value={filterGroup} 
              onChange={(e) => setFilterGroup(e.target.value)} 
              className="flex-1 md:w-40 h-10 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            >
              <option value="all">すべてのグループ</option>
              <option value="グループ1">グループ1</option>
              <option value="グループ2">グループ2</option>
            </select>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <TeamTable teams={filteredTeams} />
        </CardContent>
      </Card>
      
      <p className="text-xs text-muted-foreground">
        全 {filteredTeams.length} チームを表示中
      </p>
    </div>
  );
}
