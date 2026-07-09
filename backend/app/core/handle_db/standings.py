"""Standings (順位集計) DB handlers."""
from typing import List


async def get_pre_round_standings(event_id: int) -> List[dict]:
    """
    予選の順位集計を返す。
    部門ごとにチームの勝数・コミュニケーション点合計・マナー点合計を集計し、
    勝数 > コミュ点合計 > マナー点合計 の順でソートする。
    """
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """WITH match_results AS (
                -- 肯定側としての結果
                SELECT
                    m.event_section_id,
                    m.aff_team_id AS team_id,
                    CASE WHEN m.aff_won = 1 THEN 1 ELSE 0 END AS win,
                    CASE WHEN m.neg_won = 1 THEN 1 ELSE 0 END AS loss,
                    COALESCE(m.aff_votes, 0) AS votes,
                    COALESCE(m.aff_comm_sum, 0) AS comm_sum,
                    COALESCE(m.aff_manner, 0) AS manner
                FROM event_matches m
                WHERE m.event_id = $1
                  AND m.deleted_at IS NULL
                  AND m.aff_team_id IS NOT NULL
                  AND m.is_result_confirmed = TRUE
                UNION ALL
                -- 否定側としての結果
                SELECT
                    m.event_section_id,
                    m.neg_team_id AS team_id,
                    CASE WHEN m.neg_won = 1 THEN 1 ELSE 0 END AS win,
                    CASE WHEN m.aff_won = 1 THEN 1 ELSE 0 END AS loss,
                    COALESCE(m.neg_votes, 0) AS votes,
                    COALESCE(m.neg_comm_sum, 0) AS comm_sum,
                    COALESCE(m.neg_manner, 0) AS manner
                FROM event_matches m
                WHERE m.event_id = $1
                  AND m.deleted_at IS NULL
                  AND m.neg_team_id IS NOT NULL
                  AND m.is_result_confirmed = TRUE
            ),
            team_stats AS (
                SELECT
                    mr.event_section_id,
                    mr.team_id,
                    SUM(mr.win) AS wins,
                    SUM(mr.loss) AS losses,
                    SUM(mr.votes) AS total_votes,
                    SUM(mr.comm_sum) AS total_comm,
                    SUM(mr.manner) AS total_manner,
                    COUNT(*) AS matches_played
                FROM match_results mr
                GROUP BY mr.event_section_id, mr.team_id
            )
            SELECT
                ts.event_section_id,
                sec.name AS section_name,
                ts.team_id,
                t.name AS team_name,
                sc.name AS school_name,
                ts.wins,
                ts.losses,
                ts.matches_played,
                ts.total_votes,
                ts.total_comm,
                ts.total_manner,
                RANK() OVER (
                    PARTITION BY ts.event_section_id
                    ORDER BY ts.wins DESC, ts.total_votes DESC, ts.total_comm DESC
                ) AS rank,
                t.final_rank AS final_rank
            FROM team_stats ts
            JOIN event_teams t ON t.id = ts.team_id AND t.deleted_at IS NULL
            LEFT JOIN event_schools sc ON sc.id = t.event_school_id AND sc.deleted_at IS NULL
            LEFT JOIN event_sections sec ON sec.id = ts.event_section_id AND sec.deleted_at IS NULL
            ORDER BY sec.order_number ASC NULLS LAST, rank ASC""",
            event_id,
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def get_main_round_standings(event_id: int) -> List[dict]:
    """
    本戦（is_pre_round=FALSE）の順位集計を返す。
    部門ごとにチームの勝数・コミュニケーション点合計を集計する。
    """
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """WITH match_results AS (
                -- 肯定側としての結果（本戦のみ）
                SELECT
                    m.event_section_id,
                    m.aff_team_id AS team_id,
                    CASE WHEN m.aff_won = 1 THEN 1 ELSE 0 END AS win,
                    CASE WHEN m.neg_won = 1 THEN 1 ELSE 0 END AS loss,
                    COALESCE(m.aff_comm_sum, 0) AS comm_sum
                FROM event_matches m
                JOIN event_timetable_segments seg ON seg.id = m.event_timetable_segment_id
                WHERE m.event_id = $1
                  AND m.deleted_at IS NULL
                  AND m.aff_team_id IS NOT NULL
                  AND m.is_result_confirmed = TRUE
                  AND seg.is_pre_round = FALSE
                  AND seg.deleted_at IS NULL
                UNION ALL
                -- 否定側としての結果（本戦のみ）
                SELECT
                    m.event_section_id,
                    m.neg_team_id AS team_id,
                    CASE WHEN m.neg_won = 1 THEN 1 ELSE 0 END AS win,
                    CASE WHEN m.aff_won = 1 THEN 1 ELSE 0 END AS loss,
                    COALESCE(m.neg_comm_sum, 0) AS comm_sum
                FROM event_matches m
                JOIN event_timetable_segments seg ON seg.id = m.event_timetable_segment_id
                WHERE m.event_id = $1
                  AND m.deleted_at IS NULL
                  AND m.neg_team_id IS NOT NULL
                  AND m.is_result_confirmed = TRUE
                  AND seg.is_pre_round = FALSE
                  AND seg.deleted_at IS NULL
            ),
            team_stats AS (
                SELECT
                    mr.event_section_id,
                    mr.team_id,
                    SUM(mr.win) AS wins,
                    SUM(mr.loss) AS losses,
                    SUM(mr.comm_sum) AS total_comm,
                    COUNT(*) AS matches_played
                FROM match_results mr
                GROUP BY mr.event_section_id, mr.team_id
            )
            SELECT
                ts.event_section_id,
                sec.name AS section_name,
                ts.team_id,
                t.name AS team_name,
                sc.name AS school_name,
                ts.wins,
                ts.losses,
                ts.matches_played,
                ts.total_comm,
                RANK() OVER (
                    PARTITION BY ts.event_section_id
                    ORDER BY ts.wins DESC, ts.total_comm DESC
                ) AS rank,
                t.final_rank AS final_rank
            FROM team_stats ts
            JOIN event_teams t ON t.id = ts.team_id AND t.deleted_at IS NULL
            LEFT JOIN event_schools sc ON sc.id = t.event_school_id AND sc.deleted_at IS NULL
            LEFT JOIN event_sections sec ON sec.id = ts.event_section_id AND sec.deleted_at IS NULL
            ORDER BY sec.order_number ASC NULLS LAST, rank ASC""",
            event_id,
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def get_all_standings(event_id: int) -> List[dict]:
    """
    全試合（予選＋本戦）の順位集計を返す。
    """
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """WITH match_results AS (
                -- 肯定側としての結果（全試合）
                SELECT
                    m.event_section_id,
                    m.aff_team_id AS team_id,
                    CASE WHEN m.aff_won = 1 THEN 1 ELSE 0 END AS win,
                    CASE WHEN m.neg_won = 1 THEN 1 ELSE 0 END AS loss,
                    COALESCE(m.aff_comm_sum, 0) AS comm_sum
                FROM event_matches m
                WHERE m.event_id = $1
                  AND m.deleted_at IS NULL
                  AND m.aff_team_id IS NOT NULL
                  AND m.is_result_confirmed = TRUE
                UNION ALL
                -- 否定側としての結果（全試合）
                SELECT
                    m.event_section_id,
                    m.neg_team_id AS team_id,
                    CASE WHEN m.neg_won = 1 THEN 1 ELSE 0 END AS win,
                    CASE WHEN m.aff_won = 1 THEN 1 ELSE 0 END AS loss,
                    COALESCE(m.neg_comm_sum, 0) AS comm_sum
                FROM event_matches m
                WHERE m.event_id = $1
                  AND m.deleted_at IS NULL
                  AND m.neg_team_id IS NOT NULL
                  AND m.is_result_confirmed = TRUE
            ),
            team_stats AS (
                SELECT
                    mr.event_section_id,
                    mr.team_id,
                    SUM(mr.win) AS wins,
                    SUM(mr.loss) AS losses,
                    SUM(mr.comm_sum) AS total_comm,
                    COUNT(*) AS matches_played
                FROM match_results mr
                GROUP BY mr.event_section_id, mr.team_id
            )
            SELECT
                ts.event_section_id,
                sec.name AS section_name,
                ts.team_id,
                t.name AS team_name,
                sc.name AS school_name,
                ts.wins,
                ts.losses,
                ts.matches_played,
                ts.total_comm,
                RANK() OVER (
                    PARTITION BY ts.event_section_id
                    ORDER BY ts.wins DESC, ts.total_comm DESC
                ) AS rank,
                t.final_rank AS final_rank
            FROM team_stats ts
            JOIN event_teams t ON t.id = ts.team_id AND t.deleted_at IS NULL
            LEFT JOIN event_schools sc ON sc.id = t.event_school_id AND sc.deleted_at IS NULL
            LEFT JOIN event_sections sec ON sec.id = ts.event_section_id AND sec.deleted_at IS NULL
            ORDER BY sec.order_number ASC NULLS LAST, rank ASC""",
            event_id,
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def get_event_match_summary(event_id: int) -> dict:
    """試合の全体サマリー（総数・確定済み・未完了）を返す。"""
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE is_result_confirmed = TRUE) AS confirmed,
                COUNT(*) FILTER (WHERE aff_team_id IS NOT NULL AND neg_team_id IS NOT NULL) AS scheduled
               FROM event_matches
               WHERE event_id = $1 AND deleted_at IS NULL""",
            event_id,
        )
        return dict(row) if row else {"total": 0, "confirmed": 0, "scheduled": 0}
    finally:
        await conn.close()
