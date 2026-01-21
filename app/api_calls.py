from app import app
from app.input_validation import DashboardMetrics, UpdateThrowingPlanModel
from app.models import get_db_connection
from pydantic import ValidationError
from flask import jsonify, request

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