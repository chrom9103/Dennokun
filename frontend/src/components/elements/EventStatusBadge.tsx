import Badge from "@/components/ui/Badge";
import { Event } from "@/lib/eventApi";

interface EventStatusBadgeProps {
  event: Event;
}

export default function EventStatusBadge({ event }: EventStatusBadgeProps) {
  if (!event.start_date) return <Badge variant="info" dot>予定</Badge>;
  
  const d = new Date(event.start_date);
  const now = new Date();
  const dayDiff = Math.floor(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (dayDiff > 0) return <Badge variant="info" dot>予定</Badge>;
  if (dayDiff >= -1) return <Badge variant="success" dot>進行中</Badge>;
  return <Badge variant="default" dot>終了</Badge>;
}
