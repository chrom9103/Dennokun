"""
match_generator.py — 対戦カード生成ロジック
==============================================

【現在の実装】
  シンプルなラウンドロビン（総当たり）方式。
  同一グループ内のチームを総当たりで対戦させる。
  グループが設定されていない場合は部門内で総当たり。

【将来の最適化について】
  このファイルだけ差し替えれば、より高度な最適化（遺伝的アルゴリズム、
  線形計画法など）に移行できるよう設計している。
  generate_match_pairs() の入出力インターフェースを維持すること。

【入力】
  teams: list[dict]   — event_teams テーブルの行（id, event_section_id, team_group_id 必須）
  rounds: int         — 実施するラウンド数
  config: dict        — 将来の最適化パラメータ用（現在は未使用）

【出力】
  list[dict] with keys:
    aff_team_id   : int — 肯定側チームID
    neg_team_id   : int — 否定側チームID
    event_section_id : int | None — 部門ID
    round_number  : int — ラウンド番号（1始まり）
"""

from __future__ import annotations
from typing import Any


def generate_match_pairs(
    teams: list[dict],
    rounds: int = 1,
    config: dict[str, Any] | None = None,  # noqa: ARG001 (reserved for future optimizer)
) -> list[dict]:
    """
    チームリストからラウンドロビン対戦ペアを生成して返す。

    同一グループ（team_group_id）内で総当たり。
    グループ未設定チームは同一部門（event_section_id）内で総当たり。
    それも未設定の場合は全体で総当たり。

    Returns: list of match-pair dicts (not yet saved to DB).
    """
    # グループ優先 → 部門 → 全体 でチームをグルーピング
    group_map: dict[tuple, list[dict]] = {}
    for team in teams:
        group_key: tuple
        if team.get("team_group_id") is not None:
            group_key = ("group", team["team_group_id"])
        elif team.get("event_section_id") is not None:
            group_key = ("section", team["event_section_id"])
        else:
            group_key = ("all", 0)
        group_map.setdefault(group_key, []).append(team)

    pairs: list[dict] = []
    for group_key, group_teams in group_map.items():
        section_id = _extract_section_id(group_key, group_teams)
        group_pairs = _round_robin_pairs(group_teams, rounds, section_id)
        pairs.extend(group_pairs)

    return pairs


# ─── Private helpers ──────────────────────────────────────────────────────────

def _extract_section_id(group_key: tuple, group_teams: list[dict]) -> int | None:
    if group_key[0] == "section":
        return group_key[1]
    if group_teams:
        return group_teams[0].get("event_section_id")
    return None


def _round_robin_pairs(
    teams: list[dict],
    rounds: int,
    section_id: int | None,
) -> list[dict]:
    """
    チームリスト内で総当たりペアを生成する。

    rounds > 1 の場合、同じペアを複数ラウンド実施する。
    Aff/Neg は1ラウンド目と2ラウンド目で入れ替わる（公平化）。
    """
    pairs: list[dict] = []
    round_number = 1

    for r in range(rounds):
        for i in range(len(teams)):
            for j in range(i + 1, len(teams)):
                # 奇数ラウンドは (i=Aff, j=Neg)、偶数ラウンドは逆転
                if r % 2 == 0:
                    aff, neg = teams[i], teams[j]
                else:
                    aff, neg = teams[j], teams[i]

                pairs.append({
                    "aff_team_id": aff["id"],
                    "neg_team_id": neg["id"],
                    "event_section_id": section_id,
                    "round_number": round_number,
                })
        round_number += 1

    return pairs
