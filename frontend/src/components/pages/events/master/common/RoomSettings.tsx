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

interface Room {
  id: string;
  name: string;
}

interface RoomSettingsProps {
  rooms: Room[];
}

export default function RoomSettings({ rooms }: RoomSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">会場一覧</h3>
        <Button icon="add" size="sm">
          会場追加
        </Button>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow hover={false}>
            <TableHead>会場名</TableHead>
            <TableHead align="right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rooms.length === 0 ? (
            <TableRow hover={false}>
              <TableCell colSpan={2} align="center" className="py-12 text-muted-foreground">
                会場が登録されていません
              </TableCell>
            </TableRow>
          ) : (
            rooms.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
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
