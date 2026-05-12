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

interface Staff {
  id: string;
  name: string;
  can_be_main_judge: boolean;
  can_be_sub_judge: boolean;
  can_be_timekeeper: boolean;
  interestedSchools: string[];
  availableSlots: number;
}

interface StaffTableProps {
  staffs: Staff[];
}

export default function StaffTable({ staffs }: StaffTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow hover={false}>
          <TableHead>名前</TableHead>
          <TableHead align="center">主審</TableHead>
          <TableHead align="center">副審</TableHead>
          <TableHead align="center">計時</TableHead>
          <TableHead>利害関係校</TableHead>
          <TableHead align="center">参加可能枠</TableHead>
          <TableHead align="right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {staffs.length === 0 ? (
          <TableRow hover={false}>
            <TableCell colSpan={7} align="center" className="py-12 text-muted-foreground">
              スタッフが見つかりません
            </TableCell>
          </TableRow>
        ) : (
          staffs.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell align="center">
                {s.can_be_main_judge ? (
                  <Badge variant="info" className="w-8 justify-center">○</Badge>
                ) : (
                  <span className="text-muted-foreground opacity-20">-</span>
                )}
              </TableCell>
              <TableCell align="center">
                {s.can_be_sub_judge ? (
                  <Badge variant="success" className="w-8 justify-center">○</Badge>
                ) : (
                  <span className="text-muted-foreground opacity-20">-</span>
                )}
              </TableCell>
              <TableCell align="center">
                {s.can_be_timekeeper ? (
                  <Badge variant="warning" className="w-8 justify-center">○</Badge>
                ) : (
                  <span className="text-muted-foreground opacity-20">-</span>
                )}
              </TableCell>
              <TableCell>
                {s.interestedSchools.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {s.interestedSchools.map((school, i) => (
                      <Badge key={i} variant="warning" className="text-[10px] py-0">
                        {school}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">なし</span>
                )}
              </TableCell>
              <TableCell align="center" className="font-medium">
                {s.availableSlots} 試合
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
