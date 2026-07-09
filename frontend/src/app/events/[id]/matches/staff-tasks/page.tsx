"use client";

import { useParams } from "next/navigation";
import Icon from "@/components/ui/Icon";

export default function StaffTasksPage() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const eventId = rawId ? parseInt(rawId as string) : null;

  if (!eventId || isNaN(eventId)) {
    return <div className="text-center py-16 text-muted-foreground"><p>大会IDが無効です</p></div>;
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">スタッフタスク表</h1>
        <p className="text-sm text-muted-foreground mt-1">
          各時間枠のジャッジ配置状況と空きスタッフをマトリクスで確認できます。
        </p>
      </div>

      {/* Under Construction */}
      <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-border rounded-2xl bg-muted/20 gap-6">
        <div className="p-5 rounded-full bg-primary/10">
          <Icon name="construction" size={48} className="text-primary" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-foreground">このページは準備中です</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            スタッフタスク表ページは現在開発中です。実装が完了するとこのページで以下の情報が確認できるようになります。
          </p>
        </div>

        {/* Feature preview cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mt-4">
          {[
            {
              icon: "event_seat",
              title: "時間枠別配置一覧",
              desc: "どの時間枠にどのスタッフが配置されているかをマトリクスで表示",
            },
            {
              icon: "person_off",
              title: "フリースタッフ管理",
              desc: "現在空いている（未割り当て）スタッフの一覧をリアルタイム表示",
            },
            {
              icon: "gavel",
              title: "役割別フィルタ",
              desc: "審判・副審・タイムキーパーの役割別に配置状況を絞り込み",
            },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-white rounded-xl border border-border p-4 text-center shadow-sm opacity-60"
            >
              <div className="p-2 rounded-lg bg-primary/10 w-fit mx-auto mb-3">
                <Icon name={icon} size={24} className="text-primary" />
              </div>
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          実装状況は開発チームにお問い合わせください。
        </p>
      </div>
    </div>
  );
}
