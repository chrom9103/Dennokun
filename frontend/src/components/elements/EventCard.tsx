import React from "react";
import { Event } from "@/lib/eventApi";
import { formatYMD } from "@/lib/formatDate";
import { Card, CardContent } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import EventStatusBadge from "./EventStatusBadge";

interface EventCardProps {
  event: Event;
  onClick: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function EventCard({ event, onClick, onDelete }: EventCardProps) {
  return (
    <Card onClick={() => onClick(event.id)} className="group">
      <CardContent>
        {/* Top row: icon + status */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-lg bg-info-light flex items-center justify-center group-hover:bg-primary transition-colors">
            <Icon 
              name="emoji_events" 
              className="text-primary group-hover:text-white transition-colors" 
              size={24} 
            />
          </div>
          <EventStatusBadge event={event} />
        </div>

        {/* Name */}
        <h3 className="text-base font-medium text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-1">
          {event.name}
        </h3>

        {/* Date */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
          <Icon name="calendar_today" size={16} />
          <span>
            {event.start_date ? formatYMD(event.start_date) : "日程未定"}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex -space-x-2">
            {/* Staff/User icons will be dynamically loaded here */}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(event.id);
            }}
            className="text-muted-foreground hover:text-destructive p-1.5 h-auto rounded-full"
            title="削除"
          >
            <Icon name="delete_outline" size={18} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
