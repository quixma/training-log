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
import sqlite3

class DrillEntryThrowingPlan(BaseModel):
    drill_names: Optional[str]
    drill_types: Literal['Plyo', 'Mound_Plyo', 'Throwing', 'Pitching', 'Medball', 'CVB', 'AB', 'Club']
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
    drills: list[DrillEntryThrowingPlan]

class DashboardMetrics(BaseModel):
    metric: Literal['body_weight', 'max_velo', 'total_throws', 'one_day_workload', 'rpe', 'arm_readiness']
    time: Literal['7', '14', '21', '30', '60', '90']

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
    """
    try:
        validated = DashboardMetrics(**)
        print(validated)
        #proceed to insertion
    except ValidationError as e:
        print(e)
        #show error on screen
    """
def ThrowingPlanTest():
    drill_names = ["4", "5"]
    drill_types = ["Plyo", "Mound_Plyo"]
    drill_weights = ['3', '3.5']
    drill_throws = ["6-8", "lick my nuts"]
    drillsTP = []
    
    if(len(drill_names) == len(drill_types) == len(drill_weights) == len(drill_throws)):
        for x in range(len(drill_names)):
            drill_entryTP = {
                "drill_names": drill_names[x],
                "drill_types": drill_types[x],
                "drill_weights": drill_weights[x],
                "drill_throws": drill_throws[x]
                }
            drill_entryTP = {key: None if value == "" else value for key, value in drill_entryTP.items()}
            drillsTP.append(drill_entryTP)
            
    test_data = {
        "date": date.today(),
        "throwing_block": "on_ramp",
        "num_throwing_days": 7,
        "throwing_sessions": "test 1",
        "throwing_notes": "test 2",
        "pitching_notes": "test 3",
        "drill_notes": "",
        "drills": drillsTP
        }
    test_data = {key: None if value == "" else value for key, value in test_data.items()}
    
    try:
        validated = ThrowingPlanModel(**test_data)
        print(validated)
        #proceed to insertion
    except ValidationError as e:
        print(e)
        #show error on screen
    
def DashboardTest():
    test = {
        "metric": "bodyweight",
        "time": "7"
        }
    
    try:
        validated = DashboardMetrics(**test)
        print(validated)
        #proceed to insertion
    except ValidationError as e:
        print(e)
        #show error on screen
        
def ThrowingLogTest():
    drill_names = ["4", "5"]
    ball_weights = [4, 5]
    drill_velos = [4, None]
    throw_counts = [4, 5]
    drills = []
    if(len(drill_names) == len(ball_weights) == len(drill_velos) == len(throw_counts)):
        for x in range(len(drill_names)):
            drill_entry = {
                "drill_name": drill_names[x],
                "ball_weight": ball_weights[x],
                "max_velocity": drill_velos[x],
                "throw_count": throw_counts[x]
                }
            drills.append(drill_entry)
    raw_data = {
        "date": date.today(),
        "throwing_block": "deload",
        "session_type": "recovery",
        "total_throws": 23,
        "body_weight": 214,
        "one_day_workload": None,
        "rpe": 1,
        "arm_readiness": 9,
        "notes": "test test",
        "drills": drills
        }
    
    
    try:
        validated = ThrowingLogModel(**raw_data)
        print(validated)
        #proceed to insertion
    except ValidationError as e:
        print(e)
        
def test():
    conn = sqlite3.connect('training_log.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
   
    results = cursor.execute("Select * from throwing_plan Where date = '2025-12-23'").fetchall()
    for x in results:
        xd = dict(x)

    drills = cursor.execute("Select * from throwing_plan_drills Where sessionId = ?", (xd["id"],)).fetchall()
    xdr = {}
    xdr["drills"] = [dict(row) for row in drills]
        
    print(xdr)
    conn.close()
        
    

if(__name__ == '__main__'):
        #main()
        #ThrowingPlanTest()
        #ThrowingLogTest()
        #DashboardTest()
        test()
