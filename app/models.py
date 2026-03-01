import sqlite3
import os

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
    #getting dates to populate view prior throwing plans drop down, same with notes below.
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

def get_bullpen_report_files():
    folder_path = "/home/quixma/Desktop/CS/training-log/bullpen_report_uploads"
    filenames = os.listdir(folder_path)
    
    return filenames

def get_throwing_day_types():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select DISTINCT session_type from throwing_sessions')
    throwing_days = cursor.fetchall()
    conn.close()
    return throwing_days


def get_summary_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    peak_velo = cursor.execute('Select max(max_velo) from throwing_sessions').fetchall()
    avg_readiness = cursor.execute('Select Round(avg(arm_readiness),1) from throwing_sessions where date >= datetime("now","-7 days")').fetchall()
    total_throws = cursor.execute('select sum(total_throws) from throwing_sessions where date >= datetime("now","-7 days")').fetchall()

    conn.close()
    return (peak_velo, avg_readiness, total_throws)