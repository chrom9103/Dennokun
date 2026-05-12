"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

function Icon({ name, className = "", size = 20 }: { name: string; className?: string; size?: number }) {
  return <span className={`material-icons-outlined ${className}`} style={{ fontSize: size }}>{name}</span>;
}

export default function MatchEditPage() {
  const params = useParams();
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const [data, setData] = useState({
    round: "予選第1試合", division: "高校生部門", team1: "チームA", team2: "チームB",
    room: "第1会場", timeSlot: "09:00-10:00", t1Comm: 85, t2Comm: 78, t1Manner: 90, t2Manner: 88,
  });

  const [votes, setVotes] = useState([
    { name: "山田審査員", t1: 42, t2: 38, comment: "良いディベートでした" },
    { name: "佐藤審査員", t1: 43, t2: 34, comment: "論理的構成が素晴らしい" },
    { name: "鈴木審査員", t1: 40, t2: 40, comment: "互角の戦い" },
  ]);

  const t1Total = votes.reduce((s, v) => s + v.t1, 0) + data.t1Comm + data.t1Manner;
  const t2Total = votes.reduce((s, v) => s + v.t2, 0) + data.t2Comm + data.t2Manner;

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  return (
    <div>
      <button onClick={() => router.push(`/events/${params?.id}/matches/board`)} className="flex items-center gap-1 text-sm text-primary hover:underline mb-4">
        <Icon name="arrow_back" size={16} /> 進行ボードに戻る
      </button>
      <h1 className="mb-6">試合結果入力</h1>

      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg bg-success-light text-green-800 text-sm">
          <Icon name="check_circle" size={18} /> 試合結果を保存しました
        </div>
      )}

      <div className="space-y-4">
        {/* Match info */}
        <div className="bg-white rounded-lg shadow-[var(--shadow-sm)] p-6">
          <h3 className="font-normal mb-4">試合情報</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[["ラウンド", data.round], ["部門", data.division], ["会場", data.room], ["時間", data.timeSlot]].map(([l, v]) => (
              <div key={l}><p className="text-xs text-muted-foreground mb-0.5">{l}</p><p className="text-sm">{v}</p></div>
            ))}
          </div>
        </div>

        {/* Team scores */}
        <div className="bg-white rounded-lg shadow-[var(--shadow-sm)] p-6">
          <h3 className="font-normal mb-4">対戦チーム</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-info-light rounded-lg p-4">
              <h4 className="text-primary mb-3">{data.team1}</h4>
              <div className="space-y-2">
                <div><label className="text-xs text-muted-foreground">コミュニケーション点</label>
                  <input type="number" value={data.t1Comm} onChange={(e) => setData({...data, t1Comm: +e.target.value || 0})} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none" /></div>
                <div><label className="text-xs text-muted-foreground">マナー点</label>
                  <input type="number" value={data.t1Manner} onChange={(e) => setData({...data, t1Manner: +e.target.value || 0})} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none" /></div>
              </div>
            </div>
            <div className="bg-pink-50 rounded-lg p-4">
              <h4 className="text-pink-700 mb-3">{data.team2}</h4>
              <div className="space-y-2">
                <div><label className="text-xs text-muted-foreground">コミュニケーション点</label>
                  <input type="number" value={data.t2Comm} onChange={(e) => setData({...data, t2Comm: +e.target.value || 0})} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none" /></div>
                <div><label className="text-xs text-muted-foreground">マナー点</label>
                  <input type="number" value={data.t2Manner} onChange={(e) => setData({...data, t2Manner: +e.target.value || 0})} className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none" /></div>
              </div>
            </div>
          </div>
        </div>

        {/* Judge votes */}
        <div className="bg-white rounded-lg shadow-[var(--shadow-sm)] p-6">
          <h3 className="font-normal mb-4">ジャッジ投票</h3>
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-secondary"><tr>
                <th className="text-left px-4 py-3 text-sm font-medium">ジャッジ</th>
                <th className="text-center px-4 py-3 text-sm font-medium">{data.team1}</th>
                <th className="text-center px-4 py-3 text-sm font-medium">{data.team2}</th>
                <th className="text-left px-4 py-3 text-sm font-medium">コメント</th>
              </tr></thead>
              <tbody>{votes.map((v, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3 text-sm">{v.name}</td>
                  <td className="px-4 py-3 text-center"><input type="number" value={v.t1} onChange={(e) => { const n=[...votes]; n[i].t1=+e.target.value||0; setVotes(n); }} className="w-20 px-2 py-1.5 rounded border border-border text-sm text-center focus:ring-2 focus:ring-primary focus:outline-none" /></td>
                  <td className="px-4 py-3 text-center"><input type="number" value={v.t2} onChange={(e) => { const n=[...votes]; n[i].t2=+e.target.value||0; setVotes(n); }} className="w-20 px-2 py-1.5 rounded border border-border text-sm text-center focus:ring-2 focus:ring-primary focus:outline-none" /></td>
                  <td className="px-4 py-3"><input value={v.comment} onChange={(e) => { const n=[...votes]; n[i].comment=e.target.value; setVotes(n); }} className="w-full px-2 py-1.5 rounded border border-border text-sm focus:ring-2 focus:ring-primary focus:outline-none" /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-lg shadow-[var(--shadow-sm)] p-6">
          <h3 className="font-normal mb-4">合計スコア</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-info-light rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">{data.team1}</p>
              <p className="text-4xl font-medium text-primary">{t1Total}</p>
            </div>
            <div className="bg-pink-50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">{data.team2}</p>
              <p className="text-4xl font-medium text-pink-700">{t2Total}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={() => router.push(`/events/${params?.id}/matches/board`)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">キャンセル</button>
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
            <Icon name="save" size={18} /> 保存
          </button>
        </div>
      </div>
    </div>
  );
}
