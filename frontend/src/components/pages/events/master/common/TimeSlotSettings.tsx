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

interface TimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface TimeSlotSettingsProps {
  timeSlots: TimeSlot[];
}

export default function TimeSlotSettings({ timeSlots }: TimeSlotSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">時間枠一覧</h3>
        <Button icon="add" size="sm">
          時間枠追加
        </Button>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow hover={false}>
            <TableHead>時間枠名</TableHead>
            <TableHead>開始時刻</TableHead>
            <TableHead>終了時刻</TableHead>
            <TableHead align="right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {timeSlots.length === 0 ? (
            <TableRow hover={false}>
              <TableCell colSpan={4} align="center" className="py-12 text-muted-foreground">
                時間枠が登録されていません
              </TableCell>
            </TableRow>
          ) : (
            timeSlots.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon name="schedule" size={16} />
                    {s.startTime}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon name="schedule" size={16} />
                    {s.endTime}
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
    </div>
  );
}
