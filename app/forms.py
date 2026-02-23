from app import app
from app.input_validation import ThrowingLogModel, ThrowingPlanModel
from app.models import get_db_connection
from flask import request, flash, redirect, url_for
from pydantic import ValidationError
from werkzeug.utils import secure_filename
import os

@app.route('/upload_bullpen_csv', methods = ["POST"])
def file_upload():
    ALLOWED_EXTENSIONS = '.csv'
    file = request.files['file']
    
    if request.method == "POST":
        if file.filename != '':
            file_ext = os.path.splitext(file.filename)[1]
            if file_ext != ALLOWED_EXTENSIONS:
                flash("Invalid file: Upload a .csv file.")
                redirect(url_for('bullpen_report'))
            else:  #add try catch for file save      
                file.save(f"/home/quixma/Desktop/CS/training-log/bullpen_report_uploads/{secure_filename(file.filename)}")
                flash(f"Success: {file.filename} uploaded.")
        else: 
            flash("No file uploaded: Try again.")
            redirect(url_for('bullpen_report'))
    
    return redirect(url_for('bullpen_report'))

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
            return redirect(url_for('validation_error.html', error_details = e))

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
        return redirect(url_for('index'))
    
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
            return redirect(url_for('validation_error.html', error_details = e))
            
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
        return redirect(url_for('index'))
    
