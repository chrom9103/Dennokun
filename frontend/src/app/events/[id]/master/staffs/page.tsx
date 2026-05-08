"use client";

import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import TsvImportButton from "@/components/elements/TsvImportButton";
import StaffTable from "@/components/pages/events/master/staffs/StaffTable";

export default function StaffsPage() {
  const [staffs] = useState<{ 
    id: string; 
    name: string; 
    can_be_main_judge: boolean;
    can_be_sub_judge: boolean;
    can_be_timekeeper: boolean;
    interestedSchools: string[]; 
    availableSlots: number 
  }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const filteredStaffs = staffs.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold">スタッフ管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ジャッジや運営スタッフの役割と利害関係を管理します。
          </p>
        </div>
        <div className="flex gap-2">
          <TsvImportButton onImport={handleImport} isLoading={isImporting} />
          <Button icon="person_add">スタッフ追加</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="max-w-md">
            <Input
              placeholder="名前、役割、所属で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="search-staffs"
              className="h-10"
              autoComplete="off"
            />
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <StaffTable staffs={filteredStaffs} />
        </CardContent>
      </Card>
      
      <p className="text-xs text-muted-foreground">
        全 {filteredStaffs.length} 名を表示中
      </p>
    </div>
  );
}
