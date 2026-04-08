from typing import Annotated, Literal, Optional
from pydantic import BaseModel, Field
from datetime import date

class ThrowingLogDrillEntry(BaseModel):
    drill_name: Optional[str]
    ball_weight: Optional[Annotated[float, Field(ge= 0, le=64)]]
    max_velocity: Optional[Annotated[float, Field(gt= 0)]]
    throw_count: Optional[Annotated[int, Field(gt= 0)]]

class ThrowingLogModel(BaseModel):
    date: date
    throwing_block: Literal["deload", "on_ramp", "velo_phase", "pre_season", "in_season", "return_to_throw"]
    session_type: Literal["recovery", "hybrid_a","hybrid_b", "constraint_long_toss", "mound_blend", "plyo_velo", "pitch_design", "command_training", "bullpen", "live_abs"]
    total_throws: Optional[Annotated[int, Field(ge = 0)]]
    body_weight: Optional[Annotated[float, Field(gt= 0)]]
    max_velo: Optional[Annotated[float, Field(gt= 0)]]
    one_day_workload: Optional[Annotated[float, Field(gt= 0)]]
    rpe: Optional[Annotated[float, Field(ge= 1, le=10)]]
    arm_readiness: Optional[Annotated[float, Field(ge= 1, le=10)]]
    notes: Optional[str]
    drills: list[ThrowingLogDrillEntry]

class ThrowingPlanDrillEntry(BaseModel):
    drill_names: Optional[str]
    drill_types: Optional[Literal['Plyo', 'Mound_Plyo', 'Throwing', 'Pitching', 'Medball', 'CVB', 'AB', 'Club']]
    drill_weights: Optional[Literal['3', '3.5', '4', '5', '6', '7', '9', '11', '16', '21', '32', '48', '64']]
    drill_throws: Optional[str]
    
class ThrowingPlanModel(BaseModel):
    date: date
    throwing_block: Literal['deload', 'on_ramp', 'velo_phase', 'pre_season', 'in_season', 'return_to_throw']
    num_throwing_days: Optional[Annotated[int, Field(ge = 1, le = 7)]]
    throwing_sessions: Optional[str]
    throwing_notes: Optional[str]
    pitching_notes: Optional[str]
    drill_notes: Optional[str]
    drills: list[ThrowingPlanDrillEntry]

class UpdateThrowingPlanModel(BaseModel):
    #num_throwing_days: Optional[Annotated[int, Field(ge = 1, le = 7)]]
    throwing_sessions: Optional[str]
    throwing_notes: Optional[str]
    pitching_notes: Optional[str]
    drill_notes: Optional[str]
    
class DashboardMetrics(BaseModel):
    metric: Literal['body_weight', 'max_velo', 'total_throws', 'one_day_workload', 'rpe', 'arm_readiness', 'totalThrows7d']
    time: Literal['7', '14', '21', '30', '60', '90']