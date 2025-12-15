#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Sun Dec 14 17:58:54 2025

@author: quixma
"""

import pathlib
from typing import Annotated, Literal, Optional
from pydantic import BaseModel, Field, ValidationError
from datetime import date

class DrillEntry(BaseModel):
    drill_name: str
    ball_weight: Optional[Annotated[float, Field(ge= 0, le=64)]]
    max_velocity: Optional[Annotated[float, Field(gt= 0)]]
    throw_count: Optional[Annotated[int, Field(gt= 0)]]

class ThrowingLogModel(BaseModel):
    date: date
    throwing_block: Literal["deload", "on_ramp", "velo_phase", "pre_season", "in_season", "return_to_throw"]
    session_type: Literal["recovery", "hybrid_a","hybrid_b", "constraint_long_toss", "mound_blend", "plyo_velo", "pitch_design", "command_training", "bullpen", "live_abs"]
    total_throws: Optional[Annotated[int, Field(ge = 0)]]
    body_weight: Optional[Annotated[float, Field(gt= 0)]]
    one_day_workload: Optional[Annotated[float, Field(gt= 0)]]
    rpe: Optional[Annotated[float, Field(ge= 1, le=10)]]
    arm_readiness: Optional[Annotated[int, Field(ge= 1, le=10)]]
    notes: Optional[str]
    drills: list[DrillEntry]

def main():
    raw_data = {
        "date": date.today(),
        "throwing_block": "deload",
        "session_type": "recovery",
        "total_throws": 23,
        "body_weight": 214,
        "one_day_workload": 12.2,
        "rpe": 1,
        "arm_readiness": 9,
        "notes": "test test",
        "drills": [ 
            {
                "drill_name": "hi",
                "ball_weight": 3.5,
                "max_velocity": 99,
                "throw_count": 44
              },
            {
              "drill_name": "hi",
              "ball_weight": 3.5,
              "max_velocity": 99,
              "throw_count": 44  
              }
            ]
        
        }
    
    try:
        validated = ThrowingLogModel(**raw_data)
        print(validated)
        #proceed to insertion
    except ValidationError as e:
        print(e)
        #show error on screen

if(__name__ == '__main__'):
        main()
    
