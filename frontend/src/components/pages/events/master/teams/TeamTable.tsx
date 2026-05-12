import React from "react";
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

interface Team {
  id: string;
  name: string;
  schoolName: string;
  division: string;
  group: string;
}

interface TeamTableProps {
  teams: Team[];
}

export default function TeamTable({ teams }: TeamTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow hover={false}>
          <TableHead>チーム名</TableHead>
          <TableHead>学校</TableHead>
          <TableHead>部門</TableHead>
          <TableHead>グループ</TableHead>
          <TableHead align="right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.length === 0 ? (
          <TableRow hover={false}>
            <TableCell colSpan={5} align="center" className="py-12 text-muted-foreground">
              チームが見つかりません
            </TableCell>
          </TableRow>
        ) : (
          teams.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-semibold text-primary">{t.name}</TableCell>
              <TableCell>{t.schoolName}</TableCell>
              <TableCell>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {t.division}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {t.group}
                </Badge>
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
  );
}
