
# -*- coding: utf-8 -*-
from flask import Flask, render_template, request, jsonify
import sqlite3

#style w css, format home page tables better
#in season forms: throwing log, data upload/post outing report page, stuff+/other metric page
#can have link to a page with stuff+ metrics


app = Flask(__name__)

@app.route("/", methods=["GET"])
def index():
    throwing_notes = get_throwing_notes()  
    throwing_plan, drills = get_throwing_plan()
    return render_template('index.html', throwing_notes = throwing_notes, throwing_plan=throwing_plan, drills=drills)

@app.route('/offszn-throwing-form', methods=["GET","POST"])
def offszn_throwing_form():
    return render_template('offszn_throwing_form.html')

@app.route('/dashboard', methods=["GET", "POST"])
def dashboard():
    peak_velo, avg_readiness, total_throws = get_summary_data()
    return render_template('dashboard.html', peak_velo = peak_velo, avg_readiness = avg_readiness, total_throws = total_throws)


@app.route('/api/data', methods = ["POST"])
def get_chart_data():
    data = request.get_json()
    metric = data.get('metric')
    time = data.get('time')
    
    conn= get_db_connection()
    cursor = conn.cursor()
    results = cursor.execute(f'select {metric}, date from throwing_sessions Where date >= datetime("now", "-{time} days") IS NOT NULL').fetchall()
    conn.close()
    return jsonify([dict(row) for row in results])
       

@app.route('/throwing-plan', methods = ["GET", "POST"])
def throwing_plan():
    return render_template('throwing_plan.html')

@app.route('/submit_throwing_plan', methods = ["GET","POST"])
def submit_throwing_plan():
    #submit data to db, redirect to home
    if request.method == "POST":
        date = request.form.get("date")
        throwing_block = request.form.get("throwing_block")
        num_throwing_days = request.form.get("num_throwing_days")
        throwing_sessions = request.form.get("throwing_days")
        throwing_notes = request.form.get("throwing_notes")
        pitching_notes = request.form.get("pitching_notes")
        drill_notes = request.form.get('drill_notes')
        
        drill_names = request.form.getlist('drill_name[]')
        drill_types = request.form.getlist('drill_type[]')
        drill_weights = request.form.getlist('drill_ball_weight[]')
        
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("INSERT INTO throwing_plan (date, throwing_block, num_throwing_days, throwing_sessions, throwing_notes, pitching_notes, drill_notes) VALUES (?,?,?,?,?,?,?)",
                       (date, throwing_block, num_throwing_days, throwing_sessions, throwing_notes, pitching_notes, drill_notes))
        
        session_id = cursor.lastrowid
        for x in range(len(drill_names)):
            cursor.execute("INSERT INTO throwing_plan_drills (sessionId, drill_name, drill_type, ball_weight) VALUES (?,?,?,?)",
                           (session_id, drill_names[x], drill_types[x], drill_weights[x]))
    
        conn.commit()
        conn.close()
        return index()

@app.route("/submit_throw", methods=["POST"])
def submit_throw():
    if request.method == "POST":
        date = request.form.get("date")
        throwing_block = request.form.get('throwing_block')
        session_type = request.form.get('session_type')
        total_throws = request.form.get('total_throws')
        bodyweight = request.form.get('body_weight')
        max_velo = request.form.get('max_velocity')
        one_day_wkld = request.form.get('one_day_workload')
        rpe = request.form.get('rpe')
        arm_readiness = request.form.get('arm_readiness')
        
        drill_names = request.form.getlist("drill_name[]")
        ball_weights = request.form.getlist('drill_ball_weight[]')
        drill_velos = request.form.getlist('drill_velocity[]')
        throw_counts = request.form.getlist('throw_count[]')
        
        notes = request.form.get('notes')
        
        #connect to db 
        conn = get_db_connection()
        
        #insert data
        cursor = conn.cursor()
        cursor.execute("INSERT INTO throwing_sessions (date, throwing_block, session_type, total_throws, body_weight, one_day_workload, max_velo, rpe, arm_readiness, notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
                       (date,throwing_block, session_type, total_throws, bodyweight, one_day_wkld, max_velo, rpe, arm_readiness, notes))
        
        session_id = cursor.lastrowid
        for x in range(len(drill_names)):
            cursor.execute("INSERT INTO drills (session_id, drill_name, ball_weight, drill_max_velo, throw_count) VALUES (?,?,?,?,?)",
                           (session_id, drill_names[x], ball_weights[x], drill_velos[x], throw_counts[x]))   
    
        conn.commit()
        conn.close()
        updateEmptytoNull()
        return index()
    
def updateEmptytoNull():
    conn = get_db_connection();
    cursor = conn.cursor()
    cursor.execute("UPDATE throwing_sessions SET total_throws = NULL WHERE total_throws = ''")
    cursor.execute('UPDATE throwing_sessions SET body_weight = NULL WHERE body_weight = ''')
    cursor.execute('UPDATE throwing_sessions SET one_day_workload = NULL WHERE one_day_workload = '' ')
    cursor.execute('UPDATE throwing_sessions SET max_velo = NULL WHERE max_velo = ''')
    cursor.execute('UPDATE throwing_sessions SET rpe = NULL WHERE rpe = ''')
    cursor.execute('UPDATE throwing_sessions SET arm_readiness = NULL WHERE arm_readiness = ''')
    conn.commit()
    conn.close()
    
def get_db_connection():
    conn = sqlite3.connect('training_log.db')
    conn.row_factory = sqlite3.Row
    return conn

def get_throwing_notes():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select notes, date from throwing_sessions Where date >= datetime("now", "-8 days") ORDER BY  date DESC')
    notes = cursor.fetchall()
    conn.close()
    
    updated_notes = []
    for row in notes:
        notes = row["notes"] or ""
        updated_notes.append({
            "date": row["date"],
            "notes_html": notes.replace("-", "<br>-")
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
            "sessions_html": sessions.replace("-","<br>-"),
            "th_notes_html": th_notes.replace("-","<br>-"),
            "p_notes_html": p_notes.replace("-","<br>-"),
            "d_notes_html": d_notes.replace("-","<br>-"),
            })
        
    return (updatedThrowing_plan, drills)

def get_summary_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    peak_velo = cursor.execute('Select max(max_velo) from throwing_sessions where date >= datetime("now","-8 days")').fetchall()
    avg_readiness = cursor.execute('Select Round(avg(arm_readiness),1) from throwing_sessions where date >= datetime("now","-8 days")').fetchall()
    total_throws = cursor.execute('select sum(total_throws) from throwing_sessions where date >= datetime("now","-8 days")').fetchall()

    conn.close()
    return (peak_velo, avg_readiness, total_throws)
    
    
if(__name__ == '__main__'):
        app.run()