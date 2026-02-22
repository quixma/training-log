from app import app
from app.input_validation import DashboardMetrics, UpdateThrowingPlanModel
from app.models import get_db_connection
from pydantic import ValidationError
from flask import jsonify, request
import os
import pandas as pd
import math
import numpy as np

@app.route('/api/report_data', methods = ["POST"])
def report_data():
    data = request.get_json()
    file = data.get('file')
    folder_path = "/home/quixma/Desktop/CS/training-log/bullpen_report_uploads"
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