"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { fetchMatch, saveMatchResult, MatchDetail, VotingDetail } from "@/lib/matchApi";

const emptyVote = (idx: number): VotingDetail => ({
  judge_index: idx,
  aff_won: 0, neg_won: 0,
  aff_constructive_comm: 3, aff_question_comm: 3, aff_answer_comm: 3,
  aff_first_rebuttal_comm: 3, aff_second_rebuttal_comm: 3,
  neg_constructive_comm: 3, neg_question_comm: 3, neg_answer_comm: 3,
  neg_first_rebuttal_comm: 3, neg_second_rebuttal_comm: 3,
  aff_comm_sum: 15, neg_comm_sum: 15,
  aff_manner: 0, neg_manner: 0,
  note: null,
});

function calcCommSum(vd: VotingDetail, side: "aff" | "neg"): number {
  return vd[`${side}_constructive_comm`] + vd[`${side}_question_comm`] + vd[`${side}_answer_comm`]
    + vd[`${side}_first_rebuttal_comm`] + vd[`${side}_second_rebuttal_comm`] - (side === "aff" ? (vd.aff_manner ?? 0) : (vd.neg_manner ?? 0));
}

function NumInput({
  value, onChange, className = "",
}: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <div className="inline-flex items-center gap-1 shadow-sm rounded-lg border border-border p-0.5 bg-secondary/30 select-none">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-8 h-8 rounded-md bg-white hover:bg-muted active:scale-90 flex items-center justify-center font-bold text-sm text-foreground transition-all shadow-sm border border-border/60"
      >
        -
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        min={0}
        className={`bg-transparent text-sm font-semibold text-center focus:outline-none w-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-md bg-white hover:bg-muted active:scale-90 flex items-center justify-center font-bold text-sm text-foreground transition-all shadow-sm border border-border/60"
      >
        +
      </button>
    </div>
  );
}

export default function MatchEditPage() {
  const params = useParams();
  const router = useRouter();
  const rawEventId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const rawMatchId = Array.isArray(params?.match_id) ? params.match_id[0] : params?.match_id;
  const eventId = rawEventId ? parseInt(rawEventId as string) : null;
  const matchId = rawMatchId ? parseInt(rawMatchId as string) : null;

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [votes, setVotes] = useState<VotingDetail[]>([emptyVote(0), emptyVote(1), emptyVote(2)]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const load = useCallback(async () => {
    if (!eventId || !matchId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMatch(eventId, matchId);
      setMatch(data);
      setIsConfirmed(data.is_result_confirmed);
      if (data.voting_details && data.voting_details.length > 0) {
        setVotes(data.voting_details.map((vd, i) => ({ ...emptyVote(i), ...vd })));
      } else {
        const judgeCount = data.judges_assignment_count ?? 3;
        setVotes(Array.from({ length: judgeCount }, (_, i) => emptyVote(i)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "試合データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [eventId, matchId]);

  useEffect(() => { load(); }, [load]);

  // Sync comm sums on vote change
  const syncedVotes = votes.map((vd) => ({
    ...vd,
    aff_comm_sum: calcCommSum(vd, "aff"),
    neg_comm_sum: calcCommSum(vd, "neg"),
  }));

  const totalAffVotes = syncedVotes.filter((v) => v.aff_won === 1).length;
  const totalNegVotes = syncedVotes.filter((v) => v.neg_won === 1).length;
  const totalAffComm = syncedVotes.reduce((s, v) => s + v.aff_comm_sum, 0);
  const totalNegComm = syncedVotes.reduce((s, v) => s + v.neg_comm_sum, 0);
  const totalAffManner = syncedVotes.reduce((s, v) => s + (v.aff_manner ?? 0), 0);
  const totalNegManner = syncedVotes.reduce((s, v) => s + (v.neg_manner ?? 0), 0);

  function updateVote(idx: number, field: keyof VotingDetail, value: number | string | null) {
    setVotes((prev) => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  }

  function updateVoteTarget(idx: number, target: "aff" | "neg") {
    setVotes((prev) => prev.map((v, i) => i === idx ? {
      ...v,
      aff_won: target === "aff" ? 1 : 0,
      neg_won: target === "neg" ? 1 : 0,
    } : v));
  }

  async function handleSave(confirm: boolean) {
    if (!eventId || !matchId) return;
    setSaving(true);
    try {
      await saveMatchResult(eventId, matchId, {
        aff_votes: totalAffVotes,
        neg_votes: totalNegVotes,
        aff_comm_sum: totalAffComm,
        neg_comm_sum: totalNegComm,
        aff_manner: totalAffManner,
        neg_manner: totalNegManner,
        is_result_confirmed: confirm,
        voting_details: syncedVotes,
      });
      setIsConfirmed(confirm);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (!eventId || !matchId) {
    return <div className="text-center py-16 text-muted-foreground"><p>IDが無効です</p></div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <Icon name="error_outline" size={48} className="text-destructive opacity-60 mx-auto" />
        <p className="text-destructive mt-2">{error}</p>
        <Button className="mt-4" onClick={load}>再読み込み</Button>
      </div>
    );
  }

  const affName = match?.aff_team_name ?? "肯定側チーム";
  const negName = match?.neg_team_name ?? "否定側チーム";

  const commLabels = [
    { key: "constructive_comm", label: "立論" },
    { key: "question_comm", label: "質疑" },
    { key: "answer_comm", label: "応答" },
    { key: "first_rebuttal_comm", label: "第一反駁" },
    { key: "second_rebuttal_comm", label: "第二反駁" },
    { key: "manner", label: "マナー点(減点)" },
  ] as const;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(`/events/${eventId}/matches/board`)}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Icon name="arrow_back" size={16} /> 進行ボードに戻る
        </button>
        {isConfirmed && <Badge variant="success" className="text-xs">確定済み</Badge>}
      </div>

      <div>
        <h1 className="text-2xl font-bold">試合結果入力</h1>
        <p className="text-sm text-muted-foreground mt-1">
          各ジャッジのコミュニケーション点を入力してください。勝敗・合計は自動計算されます。
        </p>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          <Icon name="check_circle" size={18} /> 保存しました
        </div>
      )}

      {/* Match info */}
      <div className="bg-white rounded-xl shadow-sm border border-border p-6">
        <h3 className="font-semibold mb-4 text-muted-foreground text-sm uppercase tracking-wide">試合情報</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            ["時間枠", match?.timetable_segment_name ?? "-"],
            ["会場", match?.room_name ?? "-"],
            ["部門", match?.section_name ?? "-"],
            ["開始", match?.start_time ?? "-"],
            ["司会タイマー", match?.timekeeper_name ?? "-"],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="text-xs text-muted-foreground mb-1">{l}</p>
              <p className="text-sm font-medium">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Score header */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-info-light/40 rounded-xl p-5 text-center border border-info-light">
          <p className="text-xs text-muted-foreground mb-1">肯定側 (Affirmative)</p>
          <p className="text-2xl font-bold text-primary">{affName}</p>
          <div className="mt-3 grid grid-cols-2 text-center gap-2">
            <div><p className="text-xs text-muted-foreground">投票数</p><p className="text-3xl font-bold text-primary">{totalAffVotes}</p></div>
            <div><p className="text-xs text-muted-foreground">コミュ合計</p><p className="text-xl font-semibold">{totalAffComm}</p></div>
          </div>
        </div>
        <div className="bg-pink-50 rounded-xl p-5 text-center border border-pink-200">
          <p className="text-xs text-muted-foreground mb-1">否定側 (Negative)</p>
          <p className="text-2xl font-bold text-pink-700">{negName}</p>
          <div className="mt-3 grid grid-cols-2 text-center gap-2">
            <div><p className="text-xs text-muted-foreground">投票数</p><p className="text-3xl font-bold text-pink-700">{totalNegVotes}</p></div>
            <div><p className="text-xs text-muted-foreground">コミュ合計</p><p className="text-xl font-semibold">{totalNegComm}</p></div>
          </div>
        </div>
      </div>

      {/* Judge votes */}
      <div className="bg-white rounded-xl shadow-sm border border-border p-6">
        <h3 className="font-semibold mb-5">ジャッジ別コミュニケーション点</h3>
        <div className="space-y-6">
          {votes.map((vd, idx) => {
            const affSum = calcCommSum(vd, "aff");
            const negSum = calcCommSum(vd, "neg");
            
            let judgeLabel = `ジャッジ ${idx + 1}`;
            if (idx === 0) {
              judgeLabel = match?.main_judge_name ? `主審(${match.main_judge_name})` : "主審";
            } else if (idx === 1) {
              judgeLabel = match?.sub_judge1_name ? `副審1(${match.sub_judge1_name})` : "副審1";
            } else if (idx === 2) {
              judgeLabel = match?.sub_judge2_name ? `副審2(${match.sub_judge2_name})` : "副審2";
            }

            return (
              <div key={idx} className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-secondary">
                  <p className="text-sm font-semibold">{judgeLabel}</p>
                </div>
                <div className="p-4">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">投票先</label>
                    <div className="inline-flex rounded-full border border-border bg-secondary/60 p-1">
                      <button
                        type="button"
                        onClick={() => updateVoteTarget(idx, "aff")}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${vd.aff_won === 1 ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        肯定側
                      </button>
                      <button
                        type="button"
                        onClick={() => updateVoteTarget(idx, "neg")}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${vd.neg_won === 1 ? "bg-pink-700 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        否定側
                      </button>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left pb-2 text-muted-foreground font-normal w-32">スピーチ</th>
                        <th className="text-center pb-2 text-primary font-medium">{affName}</th>
                        <th className="text-center pb-2 text-pink-700 font-medium">{negName}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commLabels.map(({ key, label }) => (
                        <tr key={key} className="border-b border-border/50 last:border-0">
                          <td className="py-2 text-muted-foreground">{label}</td>
                          <td className="py-2 text-center">
                            <div className="flex justify-center">
                              {key === "manner" ? (
                                <NumInput
                                  value={vd.aff_manner ?? 0}
                                  onChange={(v) => updateVote(idx, "aff_manner", v)}
                                />
                              ) : (
                                <NumInput
                                  value={vd[`aff_${key}` as keyof VotingDetail] as number}
                                  onChange={(v) => updateVote(idx, `aff_${key}` as keyof VotingDetail, v)}
                                />
                              )}
                            </div>
                          </td>
                          <td className="py-2 text-center">
                            <div className="flex justify-center">
                              {key === "manner" ? (
                                <NumInput
                                  value={vd.neg_manner ?? 0}
                                  onChange={(v) => updateVote(idx, "neg_manner", v)}
                                />
                              ) : (
                                <NumInput
                                  value={vd[`neg_${key}` as keyof VotingDetail] as number}
                                  onChange={(v) => updateVote(idx, `neg_${key}` as keyof VotingDetail, v)}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-secondary/50">
                        <td className="py-2 font-semibold">合計</td>
                        <td className="py-2 text-center font-bold text-primary text-lg">{affSum}</td>
                        <td className="py-2 text-center font-bold text-pink-700 text-lg">{negSum}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-3">
                    <input
                      placeholder="コメント（任意）"
                      value={vd.note ?? ""}
                      onChange={(e) => updateVote(idx, "note", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-end gap-3 pb-8">
        <Button variant="secondary" onClick={() => router.push(`/events/${eventId}/matches/board`)}>
          キャンセル
        </Button>
        <Button variant="outlined" onClick={() => handleSave(false)} loading={saving}>
          下書き保存
        </Button>
        <Button onClick={() => handleSave(true)} loading={saving}>
          <Icon name="check_circle" size={18} />
          <span className="ml-1">確定保存</span>
        </Button>
      </div>
    </div>
  );
}
