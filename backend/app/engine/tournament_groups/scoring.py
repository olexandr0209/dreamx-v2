# backend/app/engine/tournament_groups/scoring.py
from .rules import POINTS_WIN, POINTS_DRAW, POINTS_LOSE

def decide(p1_move: str, p2_move: str) -> str:
    if p1_move == p2_move:
        return "draw"
    if (
        (p1_move == "rock" and p2_move == "scissors") or
        (p1_move == "scissors" and p2_move == "paper") or
        (p1_move == "paper" and p2_move == "rock")
    ):
        return "p1"
    return "p2"

def points_for(result: str) -> tuple[int, int]:
    # повертає (p1_points, p2_points)
    if result == "draw":
        return (POINTS_DRAW, POINTS_DRAW)
    if result == "p1":
        return (POINTS_WIN, POINTS_LOSE)
    return (POINTS_LOSE, POINTS_WIN)
