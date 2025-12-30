
# -*- coding: utf-8 -*-
from flask import Flask, render_template, request, jsonify
import sqlite3
from typing import Annotated, Literal, Optional
from pydantic import BaseModel, Field, ValidationError
from datetime import date

#Next steps:
#check on editing prior thorwing notes, pushing update to most recent instead (save most recent thorwing note to kwrite first to avoid retyping it everytime.)
#go thru and make sure all variable names, function names, casing all makes sense and is consistent
#in season forms: throwing log, data upload/post outing report page, stuff+/other metric page
#any error handling redirects
#style w css


app = Flask(__name__)

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
    
class DrillEntryThrowingPlan(BaseModel):
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
    drills: list[DrillEntryThrowingPlan]

class UpdateThrowingPlanModel(BaseModel):
    num_throwing_days: Optional[Annotated[int, Field(ge = 1, le = 7)]]
    throwing_sessions: Optional[str]
    throwing_notes: Optional[str]
    pitching_notes: Optional[str]
    drill_notes: Optional[str]
    
class DashboardMetrics(BaseModel):
    metric: Literal['body_weight', 'max_velo', 'total_throws', 'one_day_workload', 'rpe', 'arm_readiness']
    time: Literal['7', '14', '21', '30', '60', '90']

@app.route("/", methods=["GET"])
def index():
    throwing_notes = get_throwing_notes()  
    throwing_plan, drills = get_throwing_plan()
    plan_dates = get_throwing_plan_dates()
    notes_dates = get_throwing_notes_dates()
    #get id of throwing plan
    for x in throwing_plan:
        tableID = x['id']
    
    return render_template('index.html', throwing_notes = throwing_notes, throwing_plan=throwing_plan, drills=drills, tableID = tableID, plan_dates = plan_dates, notes_dates = notes_dates)

@app.route('/offszn-throwing-form', methods=["GET","POST"])
def offszn_throwing_form():
    return render_template('offszn_throwing_form.html')

@app.route('/dashboard', methods=["GET", "POST"])
def dashboard():
    peak_velo, avg_readiness, total_throws = get_summary_data()
    return render_template('dashboard.html', peak_velo = peak_velo, avg_readiness = avg_readiness, total_throws = total_throws)

@app.route('/throwing-plan', methods = ["GET", "POST"])
def throwing_plan():
    return render_template('throwing_plan.html')

@app.route('/inszn-home', methods = ["GET", "POST"])
def inszn_home():
    return render_template('inszn_home.html')

@app.route('/api/data', methods = ["POST"])
def get_chart_data():
    data = request.get_json()
    dict_data = {
        'metric': data.get('metric'),
        'time': data.get('time')
        }
    try:
        DashboardMetrics(**dict_data)
        #proceed to insertion
    except ValidationError as e:
        return jsonify(e)
    
    conn= get_db_connection()
    cursor = conn.cursor()
    results = cursor.execute(f'select {dict_data["metric"]}, date from throwing_sessions Where date >= datetime("now", "-{dict_data["time"]} days")').fetchall()
    conn.close()
    return jsonify([dict(row) for row in results])

@app.route('/api/updatedThrowingPlan', methods = ["POST"])
def updateThrowingPlan():
    #have to get drills and upadte that as well
    data = request.get_json()
    throwing_planID = data.get('throwing_planID')
    
    throwing_plan = {
        "num_throwing_days": data.get('num_throwing_days'),
        "throwing_sessions": data.get('throwing_sessions'),
        "throwing_notes": data.get('throwing_notes'),
        "pitching_notes": data.get('pitching_notes'),
        "drill_notes": data.get('drill_notes')
        }
    try:
        UpdateThrowingPlanModel(**throwing_plan)
        #proceed to insertion
    except ValidationError as e:
        return jsonify(e)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE throwing_plan SET num_throwing_days = ?, throwing_sessions = ?, throwing_notes = ?, pitching_notes = ?, drill_notes = ? WHERE id = ?",
                   (throwing_plan['num_throwing_days'], throwing_plan['throwing_sessions'], throwing_plan['throwing_notes'], throwing_plan['pitching_notes'], throwing_plan['drill_notes'], throwing_planID))
    conn.commit()
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "No row updated"}), 404

    conn.close()
    return jsonify({"status": "update complete"}), 200

@app.route("/api/updatedNotes", methods = ["POST"])
def updateNotes():
    data = request.get_json()
    notesID = data.get('notesID')
    throwing_notes= data.get("throwing_notes")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE throwing_sessions SET notes = ? WHERE id = ?",
                   (throwing_notes, notesID))
    conn.commit()
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "No row updated"}), 404

    conn.close()
    return jsonify({"status": "update complete"}), 200

@app.route("/api/getThrowingPlan", methods = ["POST"])
def getThrowingPlan():
    date = request.get_json()
    conn = get_db_connection()
    cursor = conn.cursor()
    results = cursor.execute("Select * from throwing_plan Where date = ?", (date,)).fetchall()
    
    for x in results: #converts sqlite objects into dictionary, since its only one "row" returned dont need to do it like drills where there is multiple
        rdict = dict(x) #just have to add the one row to dict
        
    drills = cursor.execute("Select * from throwing_plan_drills Where sessionId = ?", (rdict["id"],)).fetchall() #gets drills based on id from first query
    
    drdict = {}
    drdict["drills"] = [dict(row) for row in drills] #gets each individual drill and appends to dict.
    allData = { #combines into one dict to pass back to javascript
        "tp": rdict,
        "drills": drdict
        }
    conn.close()
    
    return jsonify(allData)
     

@app.route("/api/getThrowingNotes", methods = ["POST"])
def getThrowingNotes():
    data = request.get_json()
    date = data.get("date")
    time = data.get("time")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    results = cursor.execute('Select date, notes from throwing_sessions Where date <= ? Order by date desc LIMIT ?', (date,time,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in results])

@app.route("/submit_throw", methods=["POST"])
def submit_throw():
    if request.method == "POST":
        #transforming drill arrays to list of dict entries for all values per drill, b4 validation
        drill_names = request.form.getlist("drill_name[]")
        ball_weights = request.form.getlist('drill_ball_weight[]')
        drill_velos = request.form.getlist('drill_velocity[]')
        throw_counts = request.form.getlist('throw_count[]')
        drills_list = [] 
        
        if(len(drill_names) == len(ball_weights) == len(drill_velos) == len(throw_counts)):
            for x in range(len(drill_names)):
                drill_entry = {
                    "drill_name": drill_names[x],
                    "ball_weight": ball_weights[x],
                    "max_velocity": drill_velos[x],
                    "throw_count": throw_counts[x]
                    }
                drill_entry = {key: None if value == "" else value for key, value in drill_entry.items()}
                drills_list.append(drill_entry)  
                
        form_data = {
           "date": request.form.get("date"),
           "throwing_block": request.form.get('throwing_block'),
           "session_type": request.form.get('session_type'),
           "total_throws": request.form.get('total_throws'),
           "body_weight": request.form.get('body_weight'),
           "max_velo": request.form.get('max_velocity'),
           "one_day_workload": request.form.get('one_day_workload'),
           "rpe": request.form.get('rpe'),
           "arm_readiness": request.form.get('arm_readiness'),
           "notes": request.form.get('notes'),
           "drills": drills_list
           }
        #converts unentered field values to None
        form_data = {key: None if value == "" else value for key, value in form_data.items()}
        
        try:
            ThrowingLogModel(**form_data)
            #proceed to insertion
        except ValidationError as e:
            return render_template('validation_error.html', error_details = e)

        #insert data
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO throwing_sessions (date, throwing_block, session_type, total_throws, body_weight, one_day_workload, max_velo, rpe, arm_readiness, notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
                       (form_data["date"],form_data["throwing_block"], form_data["session_type"], form_data["total_throws"], form_data["body_weight"], form_data["one_day_workload"], form_data["max_velo"], form_data["rpe"], form_data["arm_readiness"], form_data["notes"]))
        
        session_id = cursor.lastrowid
        for x in range(len(drill_names)):
            cursor.execute("INSERT INTO drills (session_id, drill_name, ball_weight, drill_max_velo, throw_count) VALUES (?,?,?,?,?)",
                           (session_id, drills_list[x]['drill_name'], drills_list[x]['ball_weight'], drills_list[x]['max_velocity'], drills_list[x]['throw_count']))   
        conn.commit()
        conn.close()
        return index()
    
@app.route('/submit_throwing_plan', methods = ["GET","POST"])
def submit_throwing_plan():
    if request.method == "POST":
        drill_names = request.form.getlist('drill_name[]')
        drill_types = request.form.getlist('drill_type[]')
        drill_weights = request.form.getlist('drill_ball_weight[]')
        drill_throws = request.form.getlist('drill_throw_count[]')
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
                
        tp_data = {
            "date": request.form.get("date"),
            "throwing_block": request.form.get("throwing_block"),
            "num_throwing_days": request.form.get("num_throwing_days"),
            "throwing_sessions": request.form.get("throwing_days"),
            "throwing_notes": request.form.get("throwing_notes"),
            "pitching_notes": request.form.get("pitching_notes"),
            "drill_notes": request.form.get('drill_notes'),
            "drills": drillsTP
            }
        tp_data = {key: None if value == "" else value for key, value in tp_data.items()}
        
        try:
            ThrowingPlanModel(**tp_data)
            #proceed to insertion
        except ValidationError as e:
            return render_template('validation_error.html', error_details = e)
            
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO throwing_plan (date, throwing_block, num_throwing_days, throwing_sessions, throwing_notes, pitching_notes, drill_notes) VALUES (?,?,?,?,?,?,?)",
                       (tp_data["date"], tp_data["throwing_block"], tp_data["num_throwing_days"], tp_data["throwing_sessions"], tp_data["throwing_notes"], tp_data["pitching_notes"], tp_data["drill_notes"]))
        
        session_id = cursor.lastrowid
        for x in range(len(drill_names)):
            cursor.execute("INSERT INTO throwing_plan_drills (sessionId, drill_name, drill_type, ball_weight, throw_count) VALUES (?,?,?,?,?)",
                           (session_id, drillsTP[x]['drill_names'], drillsTP[x]['drill_types'], drillsTP[x]['drill_weights'], drillsTP[x]['drill_throws']))
        conn.commit()
        conn.close()
        return index()
    
def get_db_connection():
    conn = sqlite3.connect('training_log.db')
    conn.row_factory = sqlite3.Row
    return conn

def get_throwing_notes():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select notes, date, id from throwing_sessions Where date >= datetime("now", "-8 days") ORDER BY  date DESC')
    notes = cursor.fetchall()
    conn.close()
    
    updated_notes = []
    for row in notes:
        notes = row["notes"] or ""
        updated_notes.append({
            "date": row["date"],
            "notes_html": notes.replace(".", ".<br>"),
            "id": row["id"],
    })
    return updated_notes

def get_throwing_plan():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select * from throwing_plan order by Id desc limit 1')
    throwing_plan = cursor.fetchall()
    cursor.execute('Select * from throwing_plan_drills where sessionId = (SELECT max(sessionId) from throwing_plan_drills)')
    drills = cursor.fetchall()
    conn.close()
    
    updatedThrowing_plan = []
    for row in throwing_plan:
        sessions = row['throwing_sessions'] or ""
        th_notes = row['throwing_notes'] or ""
        p_notes = row['pitching_notes'] or ""
        d_notes = row['drill_notes'] or ""
        
        updatedThrowing_plan.append({
            "date": row["date"],
            "throwing_block": row["throwing_block"],
            "num_throwing_days": row["num_throwing_days"],
            "sessions_html": sessions.replace(".", ".<br>"),
            "th_notes_html": th_notes.replace(".", ".<br>"),
            "p_notes_html": p_notes.replace(".", ".<br>"),
            "d_notes_html": d_notes.replace(".", ".<br>"),
            "id": row['id'],
            })
       
    return (updatedThrowing_plan, drills)

def get_throwing_plan_dates():
    #getting dates to populate view prior throwing plans select.
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select date from throwing_plan order by Id desc')
    throwing_plan_dates = cursor.fetchall()
    conn.close()
    return throwing_plan_dates

def get_throwing_notes_dates():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select date from throwing_sessions order by Id desc')
    throwing_notes_dates = cursor.fetchall()
    conn.close()
    return throwing_notes_dates

def get_summary_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    peak_velo = cursor.execute('Select max(max_velo) from throwing_sessions').fetchall()
    avg_readiness = cursor.execute('Select Round(avg(arm_readiness),1) from throwing_sessions where date >= datetime("now","-8 days")').fetchall()
    total_throws = cursor.execute('select sum(total_throws) from throwing_sessions where date >= datetime("now","-7 days")').fetchall()

    conn.close()
    return (peak_velo, avg_readiness, total_throws)
    
if(__name__ == '__main__'):
        app.run()