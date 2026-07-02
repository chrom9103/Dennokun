"""Matches and standings router."""
from fastapi import APIRouter, HTTPException
from typing import List

from app.models.matches import MatchListItem, MatchDetail, MatchResultSave, StandingsEntry, MatchSummary
from app.core.db import (
    get_all_matches,
    get_match_by_id,
    save_match_result,
    get_pre_round_standings,
    get_event_match_summary,
)

router = APIRouter(prefix="/api/events/{event_id}", tags=["matches"])


@router.get("/matches", response_model=List[MatchListItem])
async def list_matches(event_id: int):
    """大会の試合一覧（タイムテーブル・部屋・チーム名結合済み）を返す。"""
    try:
        return await get_all_matches(event_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/matches/{match_id}", response_model=MatchDetail)
async def get_match(event_id: int, match_id: int):
    """試合詳細（投票詳細含む）を返す。"""
    try:
        match = await get_match_by_id(match_id)
        if not match or match["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="Match not found")
        return match
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/matches/{match_id}/result", response_model=MatchDetail)
async def save_result(event_id: int, match_id: int, data: MatchResultSave):
    """試合結果（スコア・投票詳細）を保存する。"""
    try:
        voting = [vd.dict() for vd in data.voting_details] if data.voting_details else None
        match = await save_match_result(
            match_id=match_id,
            aff_votes=data.aff_votes,
            neg_votes=data.neg_votes,
            aff_comm_sum=data.aff_comm_sum,
            neg_comm_sum=data.neg_comm_sum,
            aff_manner=data.aff_manner,
            neg_manner=data.neg_manner,
            is_result_confirmed=data.is_result_confirmed,
            voting_details=voting,
        )
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        return match
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/standings", response_model=List[StandingsEntry])
async def get_standings(event_id: int):
    """部門別の予選順位集計を返す。"""
    try:
        return await get_pre_round_standings(event_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/match-summary", response_model=MatchSummary)
async def get_match_summary(event_id: int):
    """試合のサマリー（総数・確定済み）を返す。"""
    try:
        return await get_event_match_summary(event_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
