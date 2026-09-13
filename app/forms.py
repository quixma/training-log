from app import app
from app.input_validation import ThrowingLogModel, ThrowingPlanModel
from app.models import get_db_connection, updateThrowCount, calcACR, WORKOUT_TYPES, THROWING_SESSION_TYPES
from flask import request, flash, redirect, url_for, jsonify
from pydantic import ValidationError
from werkzeug.utils import secure_filename
import os
from config import Config

@app.route('/submit_insznthrow', methods = ["POST"])
def submit_insznthrow():
    if request.method ==  "POST":
        drill_names = request.form.getlist("drill_name[]")
        ball_weights = request.form.getlist('drill_ball_weight[]')
        drill_velos = request.form.getlist("drill_velocity[]")
        throw_counts = request.form.getlist('throw_count[]')
        drill_list = []

        if(len(drill_names) == len(ball_weights) == len(drill_velos) == len(throw_counts)): #making sure entry lengths match, add each indvidual drill entry for db.
            for x in range(len(drill_names)):
                drill_entry = {
                    "drill_name": drill_names[x],
                    "ball_weight": ball_weights[x],
                    "drill_velo": drill_velos[x],
                    "throw_count": throw_counts[x]
                    }
                drill_entry = {key: None if value == "" else value for key, value in drill_entry.items()} # if empty value replace with null
                drill_list.append(drill_entry)

        form_data = {
            "date": request.form.get("date"),
            "throwing_block": request.form.get("throwing_block"),
            "session_type": request.form.get("session_type"),
            "body_weight": request.form.get("body_weight"),
            "total_throws": request.form.get("total_throws"),
            "non_baseball_throws": request.form.get('non-baseball-throws'),
            "working_set_throws": request.form.get("working_set_throws"),
            "max_velo": request.form.get("max_velocity"),
            "acr": 0,
            "rpe": request.form.get('rpe'),
            "arm_readiness": request.form.get('arm_readiness'),
            "notes": request.form.get('notes'),
            "drills": drill_list
            }
        #converts unentered field values to None
        form_data = {key: None if value == "" else value for key, value in form_data.items()}

        try:
            ThrowingLogModel(**form_data)
        except ValidationError as e:
            return jsonify(e.errors()), 400

        #insert data
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO throwing_sessions (date, throwing_block, session_type, body_weight, total_throws, non_baseball_throws, working_set_throws, max_velo, acr, rpe, arm_readiness, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                       (form_data["date"], form_data["throwing_block"], form_data["session_type"], form_data["body_weight"], form_data["total_throws"], form_data["non_baseball_throws"], form_data["working_set_throws"], form_data["max_velo"], form_data["acr"], form_data["rpe"], form_data["arm_readiness"], form_data["notes"]))
        
        session_id = cursor.lastrowid
        for x in range(len(drill_names)):
            cursor.execute("INSERT INTO drills (session_id, drill_name, ball_weight, drill_max_velo, throw_count) VALUES (?,?,?,?,?)",
                           (session_id, drill_list[x]['drill_name'], drill_list[x]['ball_weight'], drill_list[x]['drill_velo'], drill_list[x]['throw_count']))
        conn.commit()
        conn.close()
        calcACR(form_data["date"], session_id)
        return redirect(url_for('inszn_home'))
    

@app.route('/submit_game_journal', methods = ["POST"])
def submit_game_journal():
    if request.method == "POST":
        form_data = {
            "id": request.form.get('id'),
            "date": request.form.get('date'),
            "opponent": request.form.get('opponent'),
            "get_hot": request.form.get('get_hot'),
            "bullpen_throws": request.form.get('bullpen_throws'),
            "in_game": request.form.get('in_game'),
            "game_throws": request.form.get('game_throws'),
            "ip": request.form.get('ip'),
            "hits": request.form.get('hits'),
            "er": request.form.get('er'),
            "walks": request.form.get('bb'),
            "strikeouts": request.form.get('so'),
            "hr": request.form.get('hr'),
            "stuff_grade": request.form.get('stuff_grade'),
            "execution_grade": request.form.get('execution_grade'),
            "recovery_grade": request.form.get('recovery_grade'),
            "mentality_grade": request.form.get('mentality_grade'),
            "avg_velo": request.form.get('avg_velo'),
            "max_velo": request.form.get('max_velo'),
            "subjective_notes": request.form.get('subjective_notes'),
            "feel_notes": request.form.get('feel_notes'),
            "delivery_notes": request.form.get('delivery_notes'),
            "mental_notes": request.form.get('mental_notes'),
            "post_outing_notes": request.form.get('post_outing_notes')
            }
        form_data = {key: None if value == "" else value for key, value in form_data.items()} #empty values to null
        
        #if get hot/in game not checked converted to no for db
        if(form_data["get_hot"] == None):
            form_data["get_hot"] = "no"
        if(form_data["in_game"] == None):
            form_data["in_game"] = "no"
        if(form_data["game_throws"] == None):
            form_data["game_throws"] = 0  
        
        #input validation here
        
        conn = get_db_connection()
        cursor = conn.cursor()
        #get session id based on throwing session with same date
        session_id = cursor.execute("select id from throwing_sessions where date = ?", (form_data["date"],)).fetchone()
        #game_journal hangs off a throwing session, so there's nothing to attach to without one logged that day
        if session_id is None:
            conn.close()
            flash(f"No throwing session logged for {form_data['date']}: log the throwing day first, then the game.")
            return redirect(url_for('game_form'))

        #one game per throwing session. updateThrowCount below is not idempotent, so a resubmit would
        #re-add the bullpen/game throws and append another " + game" to session_type.
        existing = cursor.execute("select id from game_journal where session_id = ?", (session_id[0],)).fetchone()
        if existing is not None:
            conn.close()
            flash(f"A game is already logged for {form_data['date']}: delete the existing entry before logging another.")
            return redirect(url_for('game_form'))

        cursor.execute("INSERT INTO game_journal (id, session_id, date, opponent, get_hot, bullpen_throws, in_game, game_throws, avg_velo, max_velo, ip, hits, er, walks, strikeouts, hr, stuff_grade, execution_grade, recovery_grade, mentality_grade, subjective_notes, feel_notes, delivery_notes, mental_notes, post_outing_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                       (form_data["id"], session_id[0], form_data["date"], form_data["opponent"], form_data["get_hot"], form_data["bullpen_throws"], form_data["in_game"],form_data["game_throws"], form_data["avg_velo"], form_data["max_velo"], form_data["ip"], form_data["hits"], form_data["er"],form_data["walks"],form_data["strikeouts"],form_data["hr"], form_data["stuff_grade"], form_data["execution_grade"], form_data["recovery_grade"], form_data["mentality_grade"], form_data["subjective_notes"],form_data["feel_notes"],form_data["delivery_notes"], form_data["mental_notes"], form_data["post_outing_notes"]))
        
        conn.commit()
        conn.close()
        updateThrowCount(session_id)
        calcACR(form_data["date"], session_id[0])
        return redirect(url_for('inszn_home'))

@app.route('/submit_workout_form', methods = ["POST"])
def submit_workout_form():
    if request.method == "POST":
        form_data = {
            "date": request.form.get("date"),
            "energy_value": request.form.get("energy_rating"),
            "fatigue_value": request.form.get("fatigue_rating"),
            "motivation_value": request.form.get('motivation_rating'),
            "focus_value": request.form.get('focus_rating'),
            "explosiveness_value": request.form.get('explosiveness_survey'),
            "body_notes": request.form.get('body_notes'),
            "workout_completed": request.form.get('workout_completed'),
            "spine_completed": request.form.get('spine_completed'),
            "armcare_completed": request.form.get('armcare_completed'),
            "conditioning_completed": request.form.get('conditioning_completed'),
            "workout_notes": request.form.get("workout_notes")
            }
        form_data = {key: None if value == "" else value for key, value in form_data.items()}
        #input validation here
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('INSERT INTO workout_log (date, energy_value, fatigue_value, motivation_value, focus_value, explosiveness_value, body_notes, workout_completed, spine_completed, armcare_completed, conditioning_completed, workout_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
                       (form_data["date"], form_data["energy_value"], form_data["fatigue_value"], form_data["motivation_value"], form_data["focus_value"], form_data["explosiveness_value"], form_data["body_notes"], form_data["workout_completed"], form_data["spine_completed"], form_data["armcare_completed"], form_data["conditioning_completed"], form_data["workout_notes"]))
        conn.commit()
        conn.close()
    
    return redirect(url_for('workout_dashboard'))
    
@app.route('/submit_inszn_throwing_plan', methods = ["POST"])
def submit_inszn_throwing_plan():
    if request.method == "POST":
        prethrow_drill = request.form.getlist("prethrow_name[]")
        prethrow_drilltype = request.form.getlist("prethrow_drill_type[]")
        prethrow_drill_list = []
        
        if(len(prethrow_drill) == len(prethrow_drilltype)):
            for x in range(len(prethrow_drill)):
                prethrow_drill_entry = {
                    "drill_name": prethrow_drill[x],
                    "drill_type": prethrow_drilltype[x]
                    }
                prethrow_drill_entry = {key: None if value == "" else value for key, value in prethrow_drill_entry.items()} # if empty value replace with null
                prethrow_drill_list.append(prethrow_drill_entry) #list of each drill as a name and type pair as one entry
        
        drill_names = request.form.getlist("drill_name[]")
        drill_types = request.form.getlist("drill_type[]")
        drill_throw_counts = request.form.getlist("drill_throw_count[]")
        drill_list = []
        
        if(len(drill_names) == len(drill_types) == len(drill_throw_counts)): #making sure entry values match, add each indvidual drill velo pair to drill list for db.
            for x in range(len(drill_names)):
                drill_entry = {
                    "drill_name": drill_names[x],
                    "drill_type": drill_types[x],
                    "throw_count": drill_throw_counts[x]
                    }
                drill_entry = {key: None if value == "" else value for key, value in drill_entry.items()} # if empty value replace with null
                drill_list.append(drill_entry) 
                
        tp_data = {
            "date": request.form.get("date"),
            "throwing_block": request.form.get("throwing_block"),
            "throwing_sessions": request.form.get("throwing_days"),
            "throwing_notes": request.form.get("throwing_notes"),
            "pitching_notes": request.form.get("pitching_notes"),
            "mental_notes": request.form.get("mental_notes"),
            "prethrow_notes": request.form.get("prethrow_notes"),
            "drill_notes": request.form.get('drill_notes'),
            "prethrow_drills": prethrow_drill_list,
            "drills": drill_list
            }
        tp_data = {key: None if value == "" else value for key, value in tp_data.items()}

        try:
            ThrowingPlanModel(**tp_data)
        except ValidationError as e:
            return jsonify(e.errors()), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO throwing_plan (date, throwing_block, throwing_sessions, throwing_notes, pitching_notes, mental_notes, prethrow_notes, drill_notes) VALUES (?,?,?,?,?,?,?,?)",
                       (tp_data["date"], tp_data["throwing_block"], tp_data["throwing_sessions"], tp_data["throwing_notes"], tp_data["pitching_notes"], tp_data["mental_notes"], tp_data["prethrow_notes"], tp_data["drill_notes"]))
        
        session_id = cursor.lastrowid
        for x in range(len(drill_names)):
            cursor.execute("INSERT INTO throwing_plan_drills (sessionId, drill_name, drill_type, throw_count) VALUES (?,?,?,?)",
                           (session_id,drill_list[x]['drill_name'], drill_list[x]['drill_type'], drill_list[x]['throw_count']))
        
        for x in range(len(prethrow_drill)):
            cursor.execute("INSERT INTO throwing_plan_prethrow (sessionID, drill_name, drill_type) VALUES (?,?,?)",
                           (session_id, prethrow_drill_list[x]['drill_name'], prethrow_drill_list[x]['drill_type']))
            
        conn.commit()
        conn.close()
    
    return redirect(url_for('inszn_home'))

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
                file.save(os.path.join(Config.BULLPEN_UPLOAD_FOLDER, secure_filename(file.filename)))
                flash(f"Success: {file.filename} uploaded.")
        else:
            flash("No file uploaded: Try again.")
            redirect(url_for('bullpen_report'))

    return redirect(url_for('bullpen_report'))

@app.route('/upload_outing_csv', methods = ["POST"])
def upload_outing_csv():
    ALLOWED_EXTENSIONS = '.csv'
    #three slots: the pitch type and batter hand postgame reports plus the pBp file, any subset at a time
    files = [request.files.get(key) for key in ('file1', 'file2', 'file3')]
    files = [file for file in files if file is not None and file.filename != '']

    if not files:
        flash("No file uploaded: Try again.")

    for file in files:
        file_ext = os.path.splitext(file.filename)[1]
        if file_ext != ALLOWED_EXTENSIONS:
            flash("Invalid file: Upload a .csv file.")
            continue

        file.save(os.path.join(Config.OUTING_UPLOAD_FOLDER, secure_filename(file.filename)))
        flash(f"Success: {file.filename} uploaded.")

    return redirect(url_for('outing_report'))


@app.route('/submit_warmup', methods = ["POST"])
def submit_warmup():
    if request.method == "POST":
        form_data = {
            "date": request.form.get("date"),
            "name": request.form.get("warmup_name"),
            "rollout_ex": request.form.get("rollout_ex"),
            "spine_ex": request.form.get("spine_ex"),
            "hip_ex": request.form.get("hip_ex"),
            "shoulder_ex": request.form.get("shoulder_ex"),
            "arm_ex": request.form.get("arm_ex"),
            "dynamic_ex": request.form.get("dynamic_ex"),
            "notes": request.form.get("notes"),
            }
        form_data = {key: None if value == "" else value for key, value in form_data.items()}
        #input validation here
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO warmups (date, name, rollout_ex, spine_ex, hip_ex, shoulder_ex, arm_ex, dynamic_ex, notes) VALUES (?,?,?,?,?,?,?,?,?)",
                       (form_data["date"], form_data["name"], form_data["rollout_ex"], form_data["spine_ex"], form_data["hip_ex"], form_data["shoulder_ex"], form_data["arm_ex"], form_data["dynamic_ex"], form_data["notes"]))
        
        conn.commit()
        conn.close()
        return redirect(url_for('workout_dashboard'))

@app.route('/submit_workout', methods = ["POST"])
def submit_workout():
    if request.method == "POST":
        workout_type = request.form.get("workout_type")
        if workout_type not in WORKOUT_TYPES: #the column has a CHECK constraint; fail with a message rather than a 500
            flash("Invalid workout type: Try again.")
            return redirect(url_for('lifting_forms'))

        ex_block = request.form.getlist('ex_block[]')
        ex_names = request.form.getlist('ex_name[]')
        sets_reps = request.form.getlist('sets_reps[]')
        ex_notes = request.form.getlist('ex_notes[]')
        ex_list = []

        if(len(ex_names) == len(sets_reps)):
            for x in range(len(ex_names)):
                ex_dict = {
                    "ex_block": ex_block[x],
                    "ex_name": ex_names[x],
                    "set_rep": sets_reps[x],
                    "ex_notes": ex_notes[x]
                    }
                ex_dict = {key: None if value == "" else value for key, value in ex_dict.items()}
                ex_list.append(ex_dict)

        form_data = {
            "date": request.form.get("date"),
            "workout_name": request.form.get("workout_name"),
            "notes": request.form.get("notes")
            }
        form_data = {key: None if value == "" else value for key, value in form_data.items()}

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO workouts (date, workout_type, workout_name, notes) VALUES (?,?,?,?)",
                       (form_data["date"], workout_type, form_data["workout_name"], form_data["notes"]))

        session_id = cursor.lastrowid
        for x in range(len(ex_list)):
            cursor.execute("INSERT INTO workout_ex (session_id, ex_block, ex_name, sets_reps, ex_notes) VALUES (?,?,?,?,?)",
                           (session_id, ex_list[x]["ex_block"], ex_list[x]["ex_name"], ex_list[x]["set_rep"], ex_list[x]["ex_notes"]))
        conn.commit()
        conn.close()
        return redirect(url_for('workout_dashboard'))


@app.route('/submit_throwing_day', methods = ["POST"])
def submit_throwing_day():
    if request.method == "POST":
        session_type = request.form.get("session_type")
        if session_type not in [value for value, label in THROWING_SESSION_TYPES]:
            flash("Invalid session type: Try again.")
            return redirect(url_for('lifting_forms'))

        form_data = {
            "date": request.form.get("date"),
            "day_name": request.form.get("day_name"),
            "notes": request.form.get("notes")
            }
        form_data = {key: None if value == "" else value for key, value in form_data.items()}

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO throwing_days (date, day_name, session_type, notes) VALUES (?,?,?,?)",
                       (form_data["date"], form_data["day_name"], session_type, form_data["notes"]))

        #both drill blocks land in one table, tagged by which block they came from
        session_id = cursor.lastrowid
        for drill_type in ('plyo', 'throwing'):
            drill_names = request.form.getlist(f'{drill_type}_drill_name[]')
            ball_weights = request.form.getlist(f'{drill_type}_ball_weight[]')
            throw_counts = request.form.getlist(f'{drill_type}_throw_count[]')
            drill_notes = request.form.getlist(f'{drill_type}_drill_notes[]')

            for x in range(len(drill_names)):
                drill = {
                    "drill_name": drill_names[x],
                    "ball_weight": ball_weights[x],
                    "throw_count": throw_counts[x],
                    "drill_notes": drill_notes[x]
                    }
                if not any(drill.values()): #skip rows the user left completely blank
                    continue
                drill = {key: None if value == "" else value for key, value in drill.items()}
                cursor.execute("INSERT INTO throwing_day_drills (session_id, drill_type, drill_name, ball_weight, throw_count, drill_notes) VALUES (?,?,?,?,?,?)",
                               (session_id, drill_type, drill["drill_name"], drill["ball_weight"], drill["throw_count"], drill["drill_notes"]))
        conn.commit()
        conn.close()
        return redirect(url_for('lifting_forms'))
