import sqlite3
import os
from itertools import zip_longest

def get_db_connection():
    conn = sqlite3.connect('training_log.db')
    conn.row_factory = sqlite3.Row
    return conn

def get_throwing_notes():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select notes, date, id from throwing_sessions Where date >= datetime("now", "-7 days") ORDER BY  date DESC')
    notes = cursor.fetchall()
    conn.close()
    
    updated_notes = [] #adds linebreak after every .
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
    
    updatedThrowing_plan = [] #adds line break after every .
    for row in throwing_plan:
        sessions = row['throwing_sessions'] or ""
        th_notes = row['throwing_notes'] or ""
        p_notes = row['pitching_notes'] or ""
        d_notes = row['drill_notes'] or ""
        pt_notes = row['prethrow_notes'] or ""
        
        updatedThrowing_plan.append({
            "date": row["date"],
            "throwing_block": row["throwing_block"],
            "num_throwing_days": row["num_throwing_days"],
            "sessions_html": sessions.replace(".", ".<br>"),
            "th_notes_html": th_notes.replace(".", ".<br>"),
            "p_notes_html": p_notes.replace(".", ".<br>"),
            "d_notes_html": d_notes.replace(".", ".<br>"),
            "pt_notes_html": pt_notes.replace(".", ".<br>"),
            "id": row['id'],
            })
       
    return (updatedThrowing_plan, drills)

def get_throwing_plan_prethrow():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select * from throwing_plan_prethrow where sessionId = (SELECT max(sessionId) from throwing_plan_prethrow)')
    prethrow_drills = cursor.fetchall()
    conn.close()
    return prethrow_drills

def get_throwing_plan_dates():
    #getting dates to populate view prior throwing plans drop down, same with notes below.
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select date from throwing_plan order by Id desc')
    throwing_plan_dates = cursor.fetchall()
    conn.close()
    return throwing_plan_dates

def get_inszn_throwing_plan_dates():
    #getting dates to populate view prior throwing plans drop down, same with notes below.
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select date from throwing_plan where date >= "2026-03-31" order by Id desc')
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

def get_bullpen_report_files():
    folder_path = "/home/quixma/Desktop/CS/training-log/bullpen_report_uploads" #this has to change for pi as well.
    filenames = os.listdir(folder_path)
    
    return filenames

def get_throwing_day_types():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select DISTINCT session_type from throwing_sessions')
    throwing_days = cursor.fetchall()
    conn.close()
    return throwing_days

def get_game_notes():
    conn = get_db_connection()
    cursor = conn.cursor()
    game_dates = cursor.execute('select date from game_journal where in_game = "yes" order by date DESC').fetchall()
    game_notes = cursor.execute('select id, date, opponent, subjective_notes, feel_notes, mental_notes, good_bad_notes, post_outing_notes from game_journal where in_game = "yes" order by date DESC LIMIT 1').fetchall()
    conn.close()
    
    updated_game_notes = [] #adds line break after every .
    for row in game_notes:
        s_notes = row['subjective_notes'] or ""
        f_notes = row['feel_notes'] or ""
        m_notes = row['mental_notes'] or ""
        gb_notes = row['good_bad_notes'] or ""
        po_notes = row['post_outing_notes'] or ""
        
        updated_game_notes.append({
            "date": row["date"],
            "opponent": row["opponent"],
            "subjective_notes": s_notes.replace(".", ".<br>"),
            "feel_notes": f_notes.replace(".", ".<br>"),
            "mental_notes": m_notes.replace(".", ".<br>"),
            "good_bad_notes": gb_notes.replace(".", ".<br>"),
            "post_outing_notes": po_notes.replace(".", ".<br>"),
            "id": row['id'],
            })
        
    return (updated_game_notes, game_dates)

def get_summary_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    #get last date for last 7 days throwing
    date = cursor.execute('select date from throwing_sessions order by date desc limit 1').fetchone()
    peak_velo = cursor.execute('Select max(max_velo) from throwing_sessions').fetchall()
    avg_readiness = cursor.execute('SELECT Round(avg(arm_readiness),1) FROM (Select arm_readiness from throwing_sessions order by date desc limit 7)').fetchall()
    total_throws = cursor.execute("SELECT sum(total_throws) FROM (Select total_throws from throwing_sessions WHERE date >= datetime(?, '-7 days') order by date desc)", (date[0],)).fetchone()
    
    conn.close()
    return (peak_velo, avg_readiness, total_throws)

def inszn_dash_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    #get last date for last 7 days throwing
    date = cursor.execute('select date from throwing_sessions order by date desc limit 1').fetchone()
    
    peak_velos = cursor.execute("SELECT max(CASE WHEN date >= datetime(?, '-7 days') THEN max_velo ELSE 0 END) AS pv_last_7_days, max(CASE WHEN date >= datetime(?, '-14 days') THEN max_velo ELSE 0 END) AS pv_last_14_days, max(CASE WHEN date >= datetime(?, '-30 days') THEN max_velo ELSE 0 END) AS pv_last_30_days, max(max_velo) as pv_all_time FROM game_journal", (date[0],date[0],date[0])).fetchall()
    avg_readiness = cursor.execute("SELECT round(avg(CASE WHEN date >= datetime(?, '-3 days') THEN arm_readiness END),1) AS ar_last_3_days, round(avg(CASE WHEN date >= datetime(?, '-7 days') THEN arm_readiness END),1) AS ar_last_7_days, round(avg(CASE WHEN date >= datetime(?, '-14 days') THEN arm_readiness END),1) AS ar_last_14_days FROM throwing_sessions", (date[0],date[0],date[0])).fetchall()
    total_throws7d = cursor.execute("SELECT sum(total_throws) FROM (Select total_throws from throwing_sessions WHERE date >= datetime(?, '-7 days') order by date desc)", (date[0],)).fetchone()
    working_throws7d = cursor.execute("SELECT sum(working_set_throws) FROM (Select working_set_throws from throwing_sessions WHERE date >= datetime(?, '-7 days') order by date desc)", (date[0],)).fetchone()
    acr = cursor.execute("select acr from throwing_sessions order by date desc limit 1").fetchone()
    prev_throw_day = cursor.execute("select date, session_type, total_throws, working_set_throws, max_velo from throwing_sessions order by rowid desc LIMIT 1").fetchall()
    days_last_game = cursor.execute("select days_since_last_game from throwing_sessions order by ROWID desc limit 1").fetchone()
    avg_velos = cursor.execute("SELECT round(avg(CASE WHEN date >= datetime(?, '-7 days') THEN avg_velo END),1) AS avg_last_7_days, round(avg(CASE WHEN date >= datetime(?, '-14 days') THEN avg_velo END),1) AS avg_last_14_days, round(avg(CASE WHEN date >= datetime(?, '-30 days') THEN avg_velo END),1) AS avg_last_30_days, round(avg(avg_velo),1) as pv_all_time FROM game_journal", (date[0],date[0],date[0])).fetchall()
    
    return (peak_velos, avg_readiness, acr, total_throws7d, working_throws7d, prev_throw_day, days_last_game, avg_velos)


def updateThrowCount(session_id): #updating daily throw count in db after a game is logged: adds game throws to daily throws and updates
    conn = get_db_connection()
    cursor = conn.cursor()
    
    bullpen_throws = cursor.execute('Select bullpen_throws from game_journal where session_id = ?', (session_id[0],)).fetchone()
    game_throws = cursor.execute('Select game_throws from game_journal where session_id = ?', (session_id[0],)).fetchone()
    session_throws = cursor.execute('Select total_throws from throwing_sessions where id = ?', (session_id[0],)).fetchone()
    working_throws = cursor.execute('Select working_set_throws from throwing_sessions where id = ?', (session_id[0],)).fetchone()
    
    total_throws = bullpen_throws[0] + game_throws[0] + session_throws[0]
    working_throws = working_throws[0] + bullpen_throws[0] + game_throws[0]
    cursor.execute('Update throwing_sessions SET total_throws = ?, session_type = session_type || " + game", working_set_throws = ? Where id = ?', (total_throws, session_id[0], working_throws))
    
    conn.commit()
    conn.close()
    return

def get_totalthrows4wk():
    weeks = 4
    conn= get_db_connection()
    cursor = conn.cursor()
    #groups dates as a whole week, listing in dict as the week starting on monday date, calc sum of total throws for that week
    total_throws = cursor.execute("select DATE(date, 'weekday 0', '-7 days') AS week_start, sum(total_throws) from throwing_sessions GROUP By week_start ORDER By week_start DESC LIMIT ?",(weeks,)).fetchall()
    conn.close()
     
    return total_throws 

def get_totalworkingthrows4wk():
    weeks = 4
    conn= get_db_connection()
    cursor = conn.cursor()
    #groups dates as a whole week, listing in dict as the week starting on monday date, calc sum of total throws for that week
    total_working_throws = cursor.execute("select DATE(date, 'weekday 0', '-7 days') AS week_start, sum(working_set_throws) from throwing_sessions GROUP By week_start ORDER By week_start DESC LIMIT ?",(weeks,)).fetchall()
    conn.close()
     
    return total_working_throws 

def calcACR(date, session_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    #sends date of form submission, use that for date time function and -7 days instead of date now for pi
    throws7d = cursor.execute("SELECT sum(total_throws) FROM (Select total_throws from throwing_sessions WHERE date >= datetime(?, '-7 days') order by date desc)", (date,)).fetchone()
    throws28d = cursor.execute("SELECT sum(total_throws) FROM (Select total_throws from throwing_sessions WHERE date >= datetime(?, '-28 days') order by date desc)", (date,)).fetchone()
       
    aw = throws7d[0]
    cw = round(throws28d[0] / 4, 0)
    acr = round(aw / cw,2)
    
    cursor.execute("UPDATE throwing_sessions set acr = ? Where id = ?", (acr, session_id,))
    conn.commit()
    conn.close()
    return 

def get_RatingsAvgs():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    date = cursor.execute('select date from workout_log order by date desc limit 1').fetchone()
    avg_energy = cursor.execute("SELECT avg(energy_value) FROM (Select energy_value from workout_log WHERE date >= datetime(?, '-7 days') order by date desc)", (date[0],)).fetchone()
    avg_fatigue = cursor.execute("SELECT avg(fatigue_value) FROM (Select fatigue_value from workout_log WHERE date >= datetime(?, '-7 days') order by date desc)", (date[0],)).fetchone()
    avg_motivation = cursor.execute("SELECT avg(motivation_value) FROM (Select motivation_value from workout_log WHERE date >= datetime(?, '-7 days') order by date desc)", (date[0],)).fetchone()
    avg_focus = cursor.execute("SELECT avg(focus_value) FROM (Select focus_value from workout_log WHERE date >= datetime(?, '-7 days') order by date desc)", (date[0],)).fetchone()
    
    conn.close()
    return (avg_energy[0], avg_fatigue[0], avg_motivation[0], avg_focus[0])

def get_WorkoutsCompleted():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    date = cursor.execute('select date from workout_log order by date desc limit 1').fetchone()
    lifts_completed = cursor.execute("Select date, workout_completed from workout_log WHERE date >= datetime(?, '-7 days') AND workout_completed IS NOT NULL order by date desc", (date[0],)).fetchall()
    armcare_completed = cursor.execute("Select date, armcare_completed from workout_log WHERE date >= datetime(?, '-7 days') AND armcare_completed IS NOT NULL order by date desc", (date[0],)).fetchall()
    conditioning_completed = cursor.execute("Select date, conditioning_completed from workout_log WHERE date >= datetime(?, '-7 days') AND conditioning_completed IS NOT NULL order by date desc", (date[0],)).fetchall()
    conn.close()
    
    lifts = []
    for x in lifts_completed:
        lifts.append({
            "Date": x[0],
            "Lift": x[1]
            })
    armcare = []
    for x in armcare_completed:
        armcare.append({
            "Date": x[0],
            "Armcare": x[1]
            })
    conditioning = []
    for x in conditioning_completed:
        conditioning.append({
            "Date": x[0],
            "Conditioning": x[1]
            })
    #pads the shortest one with empty dicts to make all match same length for displaying.
    rows = list(zip_longest(lifts, armcare, conditioning, fillvalue={'Date': '', 'Lift': '', 'Armcare': '', 'Conditioning': ''}))
    
    return rows

def get_bodyNotes_dates():
    conn = get_db_connection()
    cursor = conn.cursor()

    dates = cursor.execute("select date from workout_log where body_notes IS NOT NULL").fetchall()    
    conn.close()
    return dates

def get_bodyNotes():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    notes = cursor.execute("select date, body_notes from workout_log where body_notes IS NOT NULL order by date DESC LIMIT 3").fetchall()    
    conn.close()
    body_notes = []
    for x in notes:
        b_notes = x['body_notes'] or ""
        
        body_notes.append({
            "Date": x['date'],
            "body_notes": b_notes.replace(".", ".<br>"),
            })
    return body_notes
    