from typing import Annotated, Literal, Optional
from pydantic import BaseModel, Field
from datetime import date

class ThrowingLogDrillEntry(BaseModel):
    drill_name: Optional[str]
    ball_weight: Optional[Annotated[float, Field(ge= 0, le=64)]]
    drill_velo: Optional[Annotated[float, Field(gt= 0)]]
    throw_count: Optional[Annotated[int, Field(gt= 0)]]

class ThrowingLogModel(BaseModel):
    date: date
    throwing_block: Literal["deload", "on_ramp", "velo_phase", "pre_season", "in_season", "return_to_throw"]
    session_type: Literal["recovery", "recovery+", "game_prep", "hybrid_a", "hybrid_b_pitching", "hybrid_b_delivery", "extension_day", "mound_blend", "plyo_velo", "pitch_design", "command_training", "bullpen", "live_abs"]
    body_weight: Optional[Annotated[float, Field(gt= 0)]]
    total_throws: Optional[Annotated[int, Field(ge = 0)]]
    non_baseball_throws: Optional[Annotated[int, Field(ge = 0)]]
    working_set_throws: Optional[Annotated[int, Field(ge = 0)]]
    max_velo: Optional[Annotated[float, Field(gt= 0)]]
    acr: Optional[float]
    rpe: Optional[Annotated[float, Field(ge= 1, le=10)]]
    arm_readiness: Optional[Annotated[float, Field(ge= 1, le=10)]]
    notes: Optional[str]
    drills: list[ThrowingLogDrillEntry]

class ThrowingPlanPrethrowDrillEntry(BaseModel):
    drill_name: Optional[str]
    drill_type: Optional[Literal['Medball', 'CVB', 'AB', 'Club', 'Plyo']]

class ThrowingPlanDrillEntry(BaseModel):
    drill_name: Optional[str]
    drill_type: Optional[Literal['Plyo', 'Mound_Plyo', 'Throwing']]
    throw_count: Optional[str]

class ThrowingPlanModel(BaseModel):
    date: date
    throwing_block: Literal['deload', 'on_ramp', 'velo_phase', 'pre_season', 'in_season', 'return_to_throw']
    throwing_sessions: Optional[str]
    throwing_notes: Optional[str]
    pitching_notes: Optional[str]
    prethrow_notes: Optional[str]
    drill_notes: Optional[str]
    prethrow_drills: list[ThrowingPlanPrethrowDrillEntry]
    drills: list[ThrowingPlanDrillEntry]

class UpdateThrowingPlanModel(BaseModel):
    #num_throwing_days: Optional[Annotated[int, Field(ge = 1, le = 7)]]
    throwing_sessions: Optional[str]
    throwing_notes: Optional[str]
    pitching_notes: Optional[str]
    drill_notes: Optional[str]

class PlayerGoalsModel(BaseModel):
    date: date
    plan_type: Literal['offszn', 'inszn', 'workout']
    pitching: Optional[str]
    arsenal: Optional[str]
    delivery: Optional[str]
    execution: Optional[str]
    gym: Optional[str]
    back: Optional[str]
    nutrition: Optional[str]
