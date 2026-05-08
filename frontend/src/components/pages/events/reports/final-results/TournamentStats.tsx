import React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

interface Stat {
  label: string;
  value: string;
}

export default function TournamentStats({ stats }: { stats: Stat[] }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-bold">大会統計</h3>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-secondary rounded-xl p-5 text-center transition-transform hover:scale-[1.02]">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                {stat.label}
              </p>
              <p className="text-3xl font-bold text-primary tracking-tight">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Tournament date and venue will be displayed here */}
        </div>
      </CardContent>
    </Card>
  );
}
