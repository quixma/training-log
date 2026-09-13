from app import app
from app.input_validation import UpdateThrowingPlanModel, PlayerGoalsModel, UpdateWorkoutModel, UpdateWarmupModel, UpdateThrowingDayModel
from app.models import get_db_connection, get_warmup_by_name, get_workout_by_name, get_workout_names, get_latest_workout, WORKOUT_TYPES
from app.models import get_throwing_day_by_name, get_bodyNotes, get_throwing_workouts_by_name, get_warmup_names
from app.models import get_workout_for_edit, get_warmup_for_edit, get_throwing_day_for_edit
from app.models import update_workout, update_warmup, update_throwing_day
from app.models import delete_workout, delete_warmup, delete_throwing_day, blank_to_none
from app.models import OUTING_REPORT_FOLDER, OUTING_SPLIT_COLUMNS, OUTING_MVMT_COLUMNS, OUTING_STRIKES_COLUMNS
from app.models import OUTING_MISS_COLUMNS, OUTING_DAMAGE_COLUMNS, OUTING_SUMMARY_COLUMNS, INSZN_CHART_METRICS
from app.models import read_outing_postgame_report, outing_table, outing_grouped_table, read_outing_pbp
from pydantic import ValidationError
from flask import jsonify, request, url_for, redirect, render_template
import os
import pandas as pd
import math
import numpy as np
import subprocess
from datetime import datetime
from config import Config

#-----------BULLPEN REPORT------------
@app.route('/api/report_data', methods = ["POST"])
def report_data():
    data = request.get_json()
    file = data.get('file')
    folder_path = Config.BULLPEN_UPLOAD_FOLDER
    file_path = os.path.join(folder_path, file)
    file_data = pd.read_csv(file_path)
    
    #clean up data file
    df = file_data.drop(columns=['PitcherId',"Time", "PitcherThrows", "PitcherSet", 'PitcherTeam', 'PitcherSet', 'PitchSession', 'Flag', 'ZoneSpeed', 'ZoneTime', 'pfxx','pfxz',
                                'x0','y0','z0',	'vx0','vy0','vz0','ax0','ay0','az0','PlayID','CalibrationId','EffVelocity','PracticeType','Device','Direction','BatterId','Batter',	
                                'HitSpinRate','HitType','ExitSpeed','BatterSide','Angle','PositionAt110X','PositionAt110Y',	'PositionAt110Z','Distance','LastTrackedDistance','HangTime','Bearing','ContactPositionX','ContactPositionY','ContactPositionZ','SpinAxis3dTransverseAngle','SpinAxis3dLongitudinalAngle','SpinAxis3dActiveSpinRate','SpinAxis3dTilt'])
    #avgs for table data
    pitchtype_values = []
    pitchTypesList = df.TaggedPitchType.unique() #gets each pitch type thrown in bullpen
    for pitchType in pitchTypesList:
        AvgVelo = round(df.loc[df['TaggedPitchType'] == pitchType, "RelSpeed"].mean(skipna = True),1)
        AvgIVB = round(df.loc[df['TaggedPitchType'] == pitchType, "InducedVertBreak"].mean(skipna = True),1)
        AvgHB = round(df.loc[df['TaggedPitchType'] == pitchType, "HorzBreak"].mean(skipna = True),1)
        AvgRH = round(df.loc[df['TaggedPitchType'] == pitchType, "RelHeight"].mean(skipna = True),1)
        AvgRelSide = round(df.loc[df['TaggedPitchType'] == pitchType, "RelSide"].mean(skipna = True),1)
        AvgExt = round(df.loc[df['TaggedPitchType'] == pitchType, "Extension"].mean(skipna=True),1)
        AvgSR = round(df.loc[df['TaggedPitchType'] == pitchType, "SpinRate"].mean(skipna = True),0)
        AvgSE = round(df.loc[df['TaggedPitchType'] == pitchType, "SpinAxis3dSpinEfficiency"].mean(skipna = True) * 100,1)
        AvgSpinAxis = round(df.loc[df['TaggedPitchType'] == pitchType, "SpinAxis"].mean(skipna = True),0)
        
        MaxVelo= round(df.loc[df['TaggedPitchType'] == pitchType, "RelSpeed"].max(skipna = True),1)
        MinVelo= round(df.loc[df['TaggedPitchType'] == pitchType, "RelSpeed"].min(skipna = True),1)
        MaxIVB= round(df.loc[df['TaggedPitchType'] == pitchType, "InducedVertBreak"].max(skipna = True),1)
        MinIVB= round(df.loc[df['TaggedPitchType'] == pitchType, "InducedVertBreak"].min(skipna = True),1)
        MaxHB= round(df.loc[df['TaggedPitchType'] == pitchType, "HorzBreak"].max(skipna = True),1)
        MinHB= round(df.loc[df['TaggedPitchType'] == pitchType, "HorzBreak"].min(skipna = True),1)
        
        Usage = round(((df['TaggedPitchType'] == pitchType).sum() / len(df.index)) * 100,1)
        
        #calculate spin direction from spin axis in degrees
        if(AvgHB > 0):
            Hour = math.floor((AvgSpinAxis / 30) - 6)
            Minutes = int((((AvgSpinAxis / 30) - 6) - Hour) * 60)
            AvgSpinDir_str = str(Hour) + ":" + str(Minutes)
            
        else:
            Hour = math.floor((AvgSpinAxis / 30) + 6)
            Minutes = int((((AvgSpinAxis / 30) + 6) - Hour) * 60)
            AvgSpinDir_str = str(Hour) + ":" + str(Minutes)
            
        #Creates list of all the data then adds to new list to keep organized by pitch type when adding to df
        pitch_values = [AvgVelo, AvgSR, AvgSpinDir_str, AvgIVB, AvgHB, AvgRH, AvgRelSide, AvgExt, f'{AvgSE}%', f'{Usage}%', MaxVelo, MinVelo, MaxIVB, MinIVB, MaxHB, MinHB]
        pitchtype_values.append(pitch_values)
    
    session_avgs = pd.DataFrame(pitchtype_values, index = pitchTypesList, 
                                columns = ["Velocity", "Spin Rate", "Spin Direction", "Induced Vert Break", "Horz Break", "Rel Height", "Rel Side", "Extension", "Spin Eff", "Usage", "Max Velo", "Min Velo", "Max IVB", "MinIVB", "MaxHB", "MinHB"])
    table_avgs = session_avgs.to_dict(orient="index") #dict with bullpen avgs data
    
    #get pitch by pitch data for movement, release, and strikezone plot
    loc_avgs = pd.DataFrame(index=df['PitchNo'], columns = ['Pitch Type', 'Induced Vert Break', 'Horz Break', 'Rel Height', 'Rel Side','Pitch Loc Height', "Pitch Loc Side"])
    loc_avgs['Pitch Type'] = df['TaggedPitchType'].values
    loc_avgs['Induced Vert Break'] = df['InducedVertBreak'].values
    loc_avgs['Horz Break'] = df['HorzBreak'].values
    loc_avgs['Rel Height'] = df['RelHeight'].values
    loc_avgs['Rel Side'] = df['RelSide'].values
    loc_avgs['Pitch Loc Height'] = df['PlateLocHeight'].values
    loc_avgs['Pitch Loc Side'] = df['PlateLocSide'].values
    
    loc_avgs = loc_avgs.replace({np.nan: None}) #replace naan with none, json doesnt accept naan
    pitch_by_pitch_data_dict = loc_avgs.to_dict(orient='index') #data for each pitch for charts
    
    allData = { #combine into one dict for jsonify
        'pitch_avgs': table_avgs,
        'pitch_by_pitch': pitch_by_pitch_data_dict
        }
    
    return jsonify(allData)

#----------OUTING REPORT--------------
@app.route('/api/outing_report_data', methods = ["POST"])
def outing_report_data():
    data = request.get_json()

    #the three exports are told apart by their header columns rather than by which slot they came from,
    #so the dropdowns can be filled in any order
    files = {}
    for filename in (data.get('file1'), data.get('file2'), data.get('file3')):
        if not filename:
            continue
        path = os.path.join(OUTING_REPORT_FOLDER, filename)
        header_cols = pd.read_csv(path, nrows=0).columns
        if 'playGuid' in header_cols:
            files['pbp'] = path
        elif OUTING_SPLIT_COLUMNS['pitch'] in header_cols:
            files['pitch'] = path
        elif OUTING_SPLIT_COLUMNS['hand'] in header_cols:
            files['hand'] = path

    if 'pbp' not in files or not ('pitch' in files or 'hand' in files):
        return jsonify({"error": "Select the pBp file and at least one postgame report file."}), 400

    #whichever postgame exports were selected; tables for a missing one come back empty
    postgame_dfs = {split: read_outing_postgame_report(files[split]) for split in ('pitch', 'hand') if split in files}

    movement, release, velo, locations_rhh, locations_lhh = read_outing_pbp(files['pbp'])

    return jsonify({
        "summary": outing_table(postgame_dfs['hand'], 'hand', OUTING_SUMMARY_COLUMNS) if 'hand' in postgame_dfs else [],
        "pitch_mvmt": outing_table(postgame_dfs['pitch'], 'pitch', OUTING_MVMT_COLUMNS, include_total = False) if 'pitch' in postgame_dfs else [],
        "strikes": outing_grouped_table(postgame_dfs, OUTING_STRIKES_COLUMNS),
        "miss": outing_grouped_table(postgame_dfs, OUTING_MISS_COLUMNS),
        "damage": outing_grouped_table(postgame_dfs, OUTING_DAMAGE_COLUMNS),
        "movement": movement,
        "release": release,
        "velo": velo,
        "locations_rhh": locations_rhh,
        "locations_lhh": locations_lhh,
    })

#------------THROWING DASHBOARD------------
@app.route('/api/inszn_chart_data', methods = ["POST"])
def inszn_chart_data():
    data = request.get_json()
    metric = data.get('metric')

    try:
        days = int(data.get('time'))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid time range"}), 400

    conn= get_db_connection()
    cursor = conn.cursor()
    #get last date for queries
    date = cursor.execute('select date from throwing_sessions order by date desc limit 1').fetchone()
    if date is None: #nothing logged yet
        conn.close()
        return jsonify([])

    if(metric == 'totalThrows7d'):
        weeks = int(days / 7)
        #groups dates as a whole week, listing in dict as the week starting on monday date, calc sum of total throws for that week
        total_throws = cursor.execute("select DATE(date, 'weekday 0', '-7 days') AS week_start, sum(total_throws) from throwing_sessions GROUP By week_start ORDER By week_start DESC LIMIT ?",(weeks,)).fetchall()
        conn.close()
        throws_dict = {
            "totalThrows7d": [],
            "date": []
            }
        for row in total_throws:
            throws_dict["totalThrows7d"].append(row[1])
            throws_dict["date"].append(row[0])

        return jsonify(throws_dict)

    table = INSZN_CHART_METRICS.get(metric)
    if table is None:
        conn.close()
        return jsonify({"error": "unknown metric"}), 400

    #metric/table come from the allowlist above; date and the day offset are bound.
    #an N-day window ending on the anchor date spans anchor-(N-1) .. anchor
    results = cursor.execute(f'select {metric}, date from {table} Where date >= date(?, ?) and {metric} IS NOT NULL',
                             (date[0], f'-{days - 1} days')).fetchall()
    conn.close()
    return jsonify([dict(row) for row in results])

@app.route('/api/updateThrowingPlan', methods = ["POST"])
def updateThrowingPlan():
    #have to get drills and upadte that as well
    data = request.get_json()
    throwing_planID = data.get('throwing_planID')
    
    throwing_plan = {
        "throwing_sessions": data.get('throwing_sessions'),
        "throwing_notes": data.get('throwing_notes'),
        "pitching_notes": data.get('pitching_notes'),
        "mental_notes": data.get('mental_notes'),
        "drill_notes": data.get('drill_notes')
        }
    try:
        UpdateThrowingPlanModel(**throwing_plan)
        #proceed to insertion
    except ValidationError as e:
        return jsonify(e)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE throwing_plan SET throwing_sessions = ?, throwing_notes = ?, pitching_notes = ?, mental_notes = ?, drill_notes = ? WHERE id = ?",
                   ( throwing_plan['throwing_sessions'], throwing_plan['throwing_notes'], throwing_plan['pitching_notes'], throwing_plan['mental_notes'], throwing_plan['drill_notes'], throwing_planID))
    conn.commit()
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "No row updated"}), 404

    conn.close()
    return jsonify({"status": "update complete"}), 200

@app.route("/api/updateNotes", methods = ["POST"])
def updateNotes():
    data = request.get_json()
    updatedDate = data.get("date")
    notesID = data.get('notesID')
    throwing_notes= data.get("throwing_notes")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("UPDATE throwing_sessions SET date = ?, notes = ? WHERE id = ?",
                   (updatedDate, throwing_notes, notesID))
    conn.commit()
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "No row updated"}), 404

    conn.close()
    
    return jsonify({"status": "update complete"}), 200

@app.route("/api/getThrowingNotes", methods = ["POST"])
def getThrowingNotes():
    data = request.get_json()
    date = data.get("date")
    time = data.get("time")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    results = cursor.execute('Select date, notes from throwing_sessions Where date <= ? Order by date desc LIMIT ?', (date,time,)).fetchall()
    conn.close()
    
    updated_notes = [] #adds linebreak after every .
    for row in results:
        notes = row["notes"] or ""
        updated_notes.append({
            "date": row["date"],
            "notes_html": notes.replace(".", ".<br>"),
    })
    return jsonify([dict(row) for row in updated_notes])

@app.route("/api/getThrowingNotesByDay", methods = ["POST"])
def getThrowingNotesByDay():
    data = request.get_json()
    throwing_day = data.get("day")
    time = data.get("time")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    results = cursor.execute('Select date, notes from throwing_sessions Where session_type = ? Order by date desc LIMIT ?', (throwing_day,time,)).fetchall()
    conn.close()
    
    updated_notes = [] #adds linebreak after every .
    for row in results:
        notes = row["notes"] or ""
        updated_notes.append({
            "date": row["date"],
            "notes_html": notes.replace(".", ".<br>"),
    })
    return jsonify([dict(row) for row in updated_notes])

@app.route("/api/getGameNotes", methods = ["POST"])
def getGameNotes():
    date = request.get_json()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    results = cursor.execute('select id, date, opponent, subjective_notes, feel_notes, mental_notes, delivery_notes, post_outing_notes from game_journal Where date = ?', (date,)).fetchall()
    conn.close()
    
    updated_game_notes = [] #adds line break after every .
    for row in results:
        s_notes = row['subjective_notes'] or ""
        f_notes = row['feel_notes'] or ""
        m_notes = row['mental_notes'] or ""
        d_notes = row['delivery_notes'] or ""
        po_notes = row['post_outing_notes'] or ""
        
        updated_game_notes.append({
            "date": row["date"],
            "opponent": row["opponent"],
            "subjective_notes": s_notes.replace(".", ".<br>"),
            "feel_notes": f_notes.replace(".", ".<br>"),
            "mental_notes": m_notes.replace(".", ".<br>"),
            "delivery_notes": d_notes.replace(".", ".<br>"),
            "post_outing_notes": po_notes.replace(".", ".<br>"),
            "id": row['id'],
            })
    return jsonify([dict(row) for row in updated_game_notes])

@app.route("/api/getInsznThrowingPlan", methods = ["POST"])
def getInsznThrowingPlan():
    date = request.get_json()
    conn = get_db_connection()
    cursor = conn.cursor()
    results = cursor.execute("Select * from throwing_plan Where date = ?", (date,)).fetchall()
    if not results: #no plan on that date, bail before rdict is referenced below
        conn.close()
        return jsonify({"error": "No throwing plan found for that date"}), 404

    for x in results: #converts sqlite objects into dictionary, since its only one "row" returned dont need to do it like drills where there is multiple
        rdict = dict(x) #just have to add the one row to dict

    drills = cursor.execute("Select * from throwing_plan_drills Where sessionId = ?", (rdict["id"],)).fetchall() #gets drills based on id from first query
    pre = cursor.execute("Select * from throwing_plan_prethrow Where sessionID = ?", (rdict["id"],)).fetchall()
    
    drdict = {}
    drdict["drills"] = [dict(row) for row in drills] #gets each individual drill and appends to dict.
    predict = {}
    predict["drills"] = [dict(row) for row in pre]
    
    allData = { #combines into one dict to pass back to javascript
        "tp": rdict,
        "drills": drdict,
        "prethrow": predict
        }
    conn.close()
    
    return jsonify(allData)

@app.route("/api/getThrowingDay", methods = ["POST"])
def getThrowingDay():
    #the home dashboard's throwing days tab swaps days without a page load
    data = request.get_json()
    name = data.get("value")

    result = get_throwing_day_by_name(name)
    if result is None:
        return jsonify({"error": "throwing day not found"}), 404
    return jsonify(result)

#-------WORKOUT DASHBOARD-------------

@app.route("/api/getBodyNotes", methods = ["POST"])
def getBodyNotes():
    #same shape as the throwing notes lookup: the newest N notes on or before the chosen date
    data = request.get_json()
    date = data.get("date")
    time = data.get("time")

    if not date or not time:
        return jsonify({"error": "date and range are both required"}), 400

    return jsonify(get_bodyNotes(date, time))

@app.route("/api/getSelectedWorkout", methods = ["POST"])
def getSelectedWorkout():
    data = request.get_json()
    table = data.get("type")
    workout = data.get("value")
    
    #warmups keep their own table and shape; every other type is a workout_type value
    if table == "warmup":
        result = get_warmup_by_name(workout)
    elif table in WORKOUT_TYPES:
        result = get_workout_by_name(table, workout)
    else:
        return jsonify({"error": "unknown workout type"}), 400

    if result is None:
        return jsonify({"error": "workout not found"}), 404
    return jsonify(result)

@app.route("/api/getWorkoutsByType", methods = ["POST"])
def getWorkoutsByType():
    #the dashboard's one workout tab switches type without a page load, so it needs that type's
    #name list and its most recent workout together
    data = request.get_json()
    workout_type = data.get("type")

    if workout_type not in WORKOUT_TYPES:
        return jsonify({"error": "unknown workout type"}), 400

    return jsonify({
        "names": [row["workout_name"] for row in get_workout_names(workout_type)],
        "workout": get_latest_workout(workout_type),
    })

#----------PLAYER GOALS------------
@app.route("/api/addPlayerGoals", methods = ["POST"])
def addPlayerGoals():
    data = request.get_json()
    goals = {
        "date": data.get('date'),
        "plan_type": data.get('plan_type'),
        "pitching": data.get('pitching'),
        "arsenal": data.get('arsenal'),
        "delivery": data.get('delivery'),
        "execution": data.get('execution'),
        "gym": data.get('gym'),
        "back": data.get('back'),
        "nutrition": data.get('nutrition'),
        }
    goals = {key: None if value == "" else value for key, value in goals.items()}

    try:
        PlayerGoalsModel(**goals)
    except ValidationError as e:
        return jsonify(e.errors()), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO player_goals (date, plan_type, pitching, arsenal, delivery, execution, gym, back, nutrition) VALUES (?,?,?,?,?,?,?,?,?)",
                   (goals["date"], goals["plan_type"], goals["pitching"], goals["arsenal"], goals["delivery"], goals["execution"], goals["gym"], goals["back"], goals["nutrition"]))
    conn.commit()
    conn.close()

    return jsonify({"status": "goals saved"}), 200

@app.route("/api/getPlayerGoals", methods = ["POST"])
def getPlayerGoals():
    data = request.get_json()
    plan_type = data.get('plan_type')
    date = data.get('date')

    conn = get_db_connection()
    cursor = conn.cursor()
    #each dashboard asks for its own kind of goals
    result = cursor.execute("Select * from player_goals Where plan_type = ? and date = ? order by id desc limit 1", (plan_type, date)).fetchone()
    conn.close()

    if result is None:
        return jsonify({"error": "No goals found"}), 404

    return jsonify(dict(result))



#── editing saved workouts, warmups and throwing days ────────────────────

@app.route("/api/getRecordForEdit", methods = ["POST"])
def getRecordForEdit():
    data = request.get_json()
    record_type = data.get("record_type")
    record_id = data.get("id")

    if not record_id:
        return jsonify({"error": "record id is required"}), 400

    if record_type == "workout":
        result = get_workout_for_edit(record_id)
    elif record_type == "warmup":
        result = get_warmup_for_edit(record_id)
    elif record_type == "throwing_day":
        result = get_throwing_day_for_edit(record_id)
    else:
        return jsonify({"error": "unknown record type"}), 400

    if result is None:
        return jsonify({"error": "record not found"}), 404
    return jsonify(result)

@app.route("/api/updateWorkout", methods = ["POST"])
def updateWorkout():
    data = request.get_json()
    workout = {
        "id": data.get("id"),
        "date": data.get("date"),
        "workout_type": data.get("workout_type"),
        "workout_name": data.get("workout_name"),
        "notes": data.get("notes"),
        "exercises": data.get("exercises") or [],
        }
    try:
        UpdateWorkoutModel(**workout)
    except ValidationError as e:
        return jsonify(e.errors()), 400

    #skip rows the user emptied out rather than removed
    exercises = [blank_to_none(x) for x in workout["exercises"] if any(x.values())]
    if not update_workout(workout["id"], blank_to_none({key: workout[key] for key in ("date", "workout_type", "workout_name", "notes")}), exercises):
        return jsonify({"error": "No row updated"}), 404

    return jsonify({"status": "update complete"}), 200

@app.route("/api/updateWarmup", methods = ["POST"])
def updateWarmup():
    data = request.get_json()
    warmup = {
        "id": data.get("id"),
        "date": data.get("date"),
        "name": data.get("name"),
        "rollout_ex": data.get("rollout_ex"),
        "spine_ex": data.get("spine_ex"),
        "hip_ex": data.get("hip_ex"),
        "shoulder_ex": data.get("shoulder_ex"),
        "arm_ex": data.get("arm_ex"),
        "dynamic_ex": data.get("dynamic_ex"),
        "notes": data.get("notes"),
        }
    try:
        UpdateWarmupModel(**warmup)
    except ValidationError as e:
        return jsonify(e.errors()), 400

    fields = blank_to_none({key: value for key, value in warmup.items() if key != "id"})
    if not update_warmup(warmup["id"], fields):
        return jsonify({"error": "No row updated"}), 404

    return jsonify({"status": "update complete"}), 200

@app.route("/api/updateThrowingDay", methods = ["POST"])
def updateThrowingDay():
    data = request.get_json()
    day = {
        "id": data.get("id"),
        "date": data.get("date"),
        "day_name": data.get("day_name"),
        "session_type": data.get("session_type"),
        "notes": data.get("notes"),
        "plyo_drills": data.get("plyo_drills") or [],
        "throwing_drills": data.get("throwing_drills") or [],
        }
    try:
        UpdateThrowingDayModel(**day)
    except ValidationError as e:
        return jsonify(e.errors()), 400

    drills_by_type = { #skip rows the user emptied out rather than removed
        "plyo": [blank_to_none(x) for x in day["plyo_drills"] if any(x.values())],
        "throwing": [blank_to_none(x) for x in day["throwing_drills"] if any(x.values())],
        }
    if not update_throwing_day(day["id"], blank_to_none({key: day[key] for key in ("date", "day_name", "session_type", "notes")}), drills_by_type):
        return jsonify({"error": "No row updated"}), 404

    return jsonify({"status": "update complete"}), 200

@app.route("/api/deleteRecord", methods = ["POST"])
def deleteRecord():
    data = request.get_json()
    record_type = data.get("record_type")
    record_id = data.get("id")

    if not record_id:
        return jsonify({"error": "record id is required"}), 400

    if record_type == "workout":
        deleted = delete_workout(record_id)
    elif record_type == "warmup":
        deleted = delete_warmup(record_id)
    elif record_type == "throwing_day":
        deleted = delete_throwing_day(record_id)
    else:
        return jsonify({"error": "unknown record type"}), 400

    if not deleted:
        return jsonify({"error": "No row deleted"}), 404
    return jsonify({"status": "delete complete"}), 200


#TRAINING CALENDAR ROUTES

#both calendar write routes answer with the full day rather than the rows they touched,
#so the client can replace that date outright instead of merging. aliased to the keys
#the calendar renders from; completed is 0/1 and reads as a boolean on the JS side.
#bools are ints in python, so isinstance alone lets True through as 1 — every id,
#month and year off the wire goes through this instead
def is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)

def calendar_day(cursor, session_id):
    rows = cursor.execute("""SELECT w.ID AS id, c.workout_date AS date,
                                    w.workout_type AS type, w.workout_name AS name,
                                    w.completed AS done
                             FROM training_calendar_daily_wkouts w
                             JOIN training_calendar c ON c.ID = w.session_id
                             WHERE w.session_id = ?
                             ORDER BY w.ID""", (session_id,)).fetchall()
    return [dict(row) for row in rows]

@app.route("/api/getWorkoutNamesByType", methods = ["POST"])
def get_workout_names_by_type():
    data = request.get_json()
    workout_type = data.get("type")
    
    if workout_type not in WORKOUT_TYPES:
        return jsonify({"error": "unknown workout type"}), 400
    
    if workout_type == "Throwing":
        names = get_throwing_workouts_by_name()
    elif workout_type == "Warmup":
        names = get_warmup_names()
    else:
        names = get_workout_names(workout_type)
    
    if names is None:
        return jsonify({"error": "workout names not found"}), 404
    
    return jsonify([dict(row) for row in names])

@app.route("/api/addWorkouttoCalendar", methods = ["POST"])
def addWorkouttoCalendar():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "no json body"}), 400
    
    date = data.get("date")
    workouts = data.get("workouts")
    
    #workout_date is UNIQUE and compares as a string, so an unpadded or differently
    #formatted date would open a second session row for a day that already has one
    #strptime accepts unpadded numbers, so re-emit the parsed date rather than trusting
    #the string that came in: '2026-9-11' and '2026-09-11' must not become two rows
    try:
        date = datetime.strptime(date, "%Y-%m-%d").strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return jsonify({"error": "date must be YYYY-MM-DD"}), 400
    
    #an empty list would commit a session header with nothing under it
    if not isinstance(workouts, list) or not workouts:
        return jsonify({"error": "at least one workout is required"}), 400
    
    #nothing on training_calendar_daily_wkouts constrains these, and the calendar
    #builds its chip colours off workout_type, so the check has to happen here
    for row in workouts:
        if not isinstance(row, dict):
            return jsonify({"error": "each workout must be an object"}), 400
        if row.get("type") not in WORKOUT_TYPES:
            return jsonify({"error": "unknown workout type"}), 400
        if not str(row.get("name") or "").strip():
            return jsonify({"error": "workout name is required"}), 400
    
    conn = get_db_connection()
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()
    
    try:
        #if date already exists, dont insert, return id of date already in there, returns id of inserted one if its new.
        session_id = cursor.execute("INSERT INTO training_calendar (workout_date) VALUES (?) ON CONFLICT(workout_date) DO UPDATE SET workout_date = excluded.workout_date RETURNING ID", (date,)).fetchone()
        for row in workouts:
            cursor.execute("INSERT into training_calendar_daily_wkouts (session_id, workout_type, workout_name) VALUES (?,?,?)", 
                       (session_id["ID"], row["type"], row["name"]))
        
        saved = calendar_day(cursor, session_id["ID"])
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 404
    
    conn.commit()
    conn.close()
    
    return jsonify({"status": "update complete", "workouts": saved}), 200

@app.route("/api/updateCalendarWorkouts", methods = ["POST"])
def updateCalendarWorkouts():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "no json body"}), 400
    
    date = data.get("date")
    workouts = data.get("workouts")
    deleted = data.get("deleted")
    
    try:
        date = datetime.strptime(date, "%Y-%m-%d").strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return jsonify({"error": "date must be YYYY-MM-DD"}), 400
    
    if workouts is None:
        workouts = []
    if deleted is None:
        deleted = []
    if not isinstance(workouts, list) or not isinstance(deleted, list):
        return jsonify({"error": "workouts and deleted must be lists"}), 400
    
    #ids arrive from the browser, so nothing guarantees they are integers or that they
    #belong to this date. every statement below is scoped by session_id for that reason.
    completed_ids = []
    cleared_ids = []
    for row in workouts:
        if not isinstance(row, dict) or not is_int(row.get("id")):
            return jsonify({"error": "each workout needs an integer id"}), 400
        if row.get("done"):
            completed_ids.append(row["id"])
        else:
            cleared_ids.append(row["id"])
    
    for workout_id in deleted:
        if not is_int(workout_id):
            return jsonify({"error": "deleted must be a list of integer ids"}), 400
    
    conn = get_db_connection()
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()
    
    try:
        session = cursor.execute("Select ID from training_calendar WHERE workout_date = ?", (date,)).fetchone()
        if session is None:
            conn.close()
            return jsonify({"error": "no workouts logged for that date"}), 404
        session_id = session["ID"]
        
        #delete first: a row marked for deletion should not also have its flag written
        for workout_id in deleted:
            cursor.execute("DELETE from training_calendar_daily_wkouts WHERE ID = ? AND session_id = ?",
                           (workout_id, session_id))
        
        for flag, ids in ((1, completed_ids), (0, cleared_ids)):
            for workout_id in ids:
                if workout_id in deleted:
                    continue
                cursor.execute("UPDATE training_calendar_daily_wkouts SET completed = ? WHERE ID = ? AND session_id = ?",
                               (flag, workout_id, session_id))
        
        saved = calendar_day(cursor, session_id)
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400
    
    conn.commit()
    conn.close()
    
    return jsonify({"status": "update complete", "workouts": saved}), 200
