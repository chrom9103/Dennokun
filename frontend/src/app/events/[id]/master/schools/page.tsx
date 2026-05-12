"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
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
import TsvImportButton from "@/components/elements/TsvImportButton";

interface School {
  id: string;
  name: string;
  nameAliases: string[];
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const filteredSchools = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleImport = async (rows: string[][]) => {
    setIsImporting(true);
    console.log("Imported data:", rows);
    // Simulation of API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsImporting(false);
    alert(`${rows.length}件のデータをインポートしました（デモ）`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">参加校管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            大会に参加する学校の基本情報を管理します。
          </p>
        </div>
        <div className="flex gap-2">
          <TsvImportButton onImport={handleImport} isLoading={isImporting} />
          <Button icon="add">学校追加</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="max-w-md">
            <Input
              placeholder="学校名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="search-schools"
              className="h-10"
              autoComplete="off"
            />
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <Table className="border-none rounded-none">
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>学校名</TableHead>
                <TableHead>エイリアス</TableHead>
                <TableHead align="right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchools.length === 0 ? (
                <TableRow hover={false}>
                  <TableCell colSpan={3} className="py-12 text-center text-muted-foreground">
                    学校が見つかりません
                  </TableCell>
                </TableRow>
              ) : (
                filteredSchools.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.nameAliases.map((alias, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] py-0">
                            {alias}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="p-1.5 h-auto rounded-full text-primary">
                          <Icon name="edit" size={18} />
                        </Button>
                        <Button variant="ghost" size="sm" className="p-1.5 h-auto rounded-full text-destructive">
                          <Icon name="delete" size={18} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <p className="text-xs text-muted-foreground">
        全 {filteredSchools.length} 校中 {filteredSchools.length} 校を表示
      </p>
    </div>
  );
}
