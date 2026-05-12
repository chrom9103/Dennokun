import React from "react";
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

interface Division {
  id: string;
  name: string;
}

interface DivisionSettingsProps {
  divisions: Division[];
}

export default function DivisionSettings({ divisions }: DivisionSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">部門一覧</h3>
        <Button icon="add" size="sm">
          部門追加
        </Button>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow hover={false}>
            <TableHead>部門名</TableHead>
            <TableHead align="right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {divisions.length === 0 ? (
            <TableRow hover={false}>
              <TableCell colSpan={2} align="center" className="py-12 text-muted-foreground">
                部門が登録されていません
              </TableCell>
            </TableRow>
          ) : (
            divisions.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
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
    </div>
  );
}
