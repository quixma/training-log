import sqlite3
import os
import io
import pandas as pd
from config import Config

def get_db_connection():
    conn = sqlite3.connect(Config.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_throwing_notes():
    conn = get_db_connection()
    cursor = conn.cursor()
    #anchor on the most recent logged session rather than today, matching the rest of the dashboard,
    #so the panel still shows the last 7 days of throwing after a break in logging
    cursor.execute("Select notes, date, id from throwing_sessions Where date >= date((select max(date) from throwing_sessions), '-6 days') ORDER BY  date DESC")
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
    #tie drills to the plan actually being shown: keying off max(sessionId) in the drills table
    #surfaces the previous plan's drills whenever the newest plan was saved without any
    plan_id = throwing_plan[0]['id'] if throwing_plan else None
    cursor.execute('Select * from throwing_plan_drills where sessionId = ?', (plan_id,))
    drills = cursor.fetchall()
    conn.close()
    
    updatedThrowing_plan = [] #adds line break after every .
    for row in throwing_plan:
        sessions = row['throwing_sessions'] or ""
        th_notes = row['throwing_notes'] or ""
        p_notes = row['pitching_notes'] or ""
        m_notes = row['mental_notes'] or ""
        d_notes = row['drill_notes'] or ""
        pt_notes = row['prethrow_notes'] or ""
        
        updatedThrowing_plan.append({
            "date": row["date"],
            "throwing_block": row["throwing_block"],
            "sessions_html": sessions.replace(".", ".<br>"),
            "th_notes_html": th_notes.replace(".", ".<br>"),
            "p_notes_html": p_notes.replace(".", ".<br>"),
            "m_notes_html": m_notes.replace(".", ".<br>"),
            "d_notes_html": d_notes.replace(".", ".<br>"),
            "pt_notes_html": pt_notes.replace(".", ".<br>"),
            "id": row['id'],
            })
       
    return (updatedThrowing_plan, drills)

def get_throwing_plan_prethrow():
    conn = get_db_connection()
    cursor = conn.cursor()
    #anchor on the latest plan, matching get_throwing_plan, so prethrow drills can't drift to an older plan
    cursor.execute('Select * from throwing_plan_prethrow where sessionID = (SELECT max(id) from throwing_plan)')
    prethrow_drills = cursor.fetchall()
    conn.close()
    return prethrow_drills

def get_inszn_throwing_plan_dates():
    #getting dates to populate view prior throwing plans drop down, same with notes below.
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select date from throwing_plan order by Id desc')
    throwing_plan_dates = cursor.fetchall()
    conn.close()
    return throwing_plan_dates

#goals come in two kinds and each dashboard owns one: pitching goals on the throwing dashboard,
#workout goals on the workout dashboard. every caller names the kind it wants.
PLAN_TYPES = ('pitching', 'workout')

def get_player_goals(plan_type):
    conn = get_db_connection()
    cursor = conn.cursor()
    goals = cursor.execute('Select * from player_goals Where plan_type = ? order by id desc limit 1', (plan_type,)).fetchone()
    conn.close()
    return goals

def get_player_goals_dates(plan_type):
    conn = get_db_connection()
    cursor = conn.cursor()
    #group by date so saving twice in one day leaves one dropdown option, not two
    dates = cursor.execute('Select date from player_goals Where plan_type = ? group by date order by max(id) desc', (plan_type,)).fetchall()
    conn.close()
    return dates

def get_workout_notes(date=None):
    #the newest note, or the one saved on a given date. saving twice in a day leaves the later one.
    conn = get_db_connection()
    cursor = conn.cursor()

    if date:
        note = cursor.execute("Select date, notes from workout_notes Where date = ? order by id desc limit 1", (date,)).fetchone()
    else:
        note = cursor.execute("Select date, notes from workout_notes order by id desc limit 1").fetchone()
    conn.close()

    if note is None:
        return None

    notes = note["notes"] or ""
    #same linebreak-after-every-. treatment the other notes panels use
    #the raw text rides along: the edit modal prefills from it, so re-saving cannot
    #feed the <br>-formatted copy back into the table and compound the breaks
    return {
        "date": note["date"],
        "notes": notes,
        "notes_html": notes.replace(".", ".<br>"),
        }

def get_workout_notes_dates():
    conn = get_db_connection()
    cursor = conn.cursor()
    #group by date so saving twice in one day leaves one dropdown option, not two
    dates = cursor.execute("Select date from workout_notes group by date order by max(id) desc").fetchall()
    conn.close()
    return dates

def get_throwing_notes_dates():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select date from throwing_sessions order by Id desc')
    throwing_notes_dates = cursor.fetchall()
    conn.close()
    return throwing_notes_dates

def get_bullpen_report_files():
    filenames = os.listdir(Config.BULLPEN_UPLOAD_FOLDER)

    return filenames

def get_outing_report_files():
    filenames = [f for f in os.listdir(Config.OUTING_UPLOAD_FOLDER) if f.endswith('.csv')]

    return filenames

#session types offered by the throwing forms. get_throwing_day_types() below returns only the types
#already logged, so the input dropdowns render from this list instead to keep every option available.
THROWING_SESSION_TYPES = (
    ("recovery", "Recovery"),
    ("recovery+", "Recovery+"),
    ("game_prep", "Game Prep"),
    ("hybrid_a", "Hybrid A"),
    ("hybrid_b_pitching", "Hybrid B Pitching"),
    ("hybrid_b_delivery", "Hybrid B Delivery"),
    ("extension_day", "Extension LT"),
    ("mound_blend", "Mound Blend"),
    ("plyo_velo", "Plyo Velo"),
    ("pitch_design", "Pitch Design"),
    ("command_training", "Command Training"),
    ("bullpen", "Bullpen"),
    ("live_abs", "Live ABs"),
)

#ball weights the drill rows offer, shared by the throwing journal and the throwing day form
THROWING_BALL_WEIGHTS = ("3", "3.5", "4", "5", "6", "7", "9", "11", "16", "21", "32", "48", "64",
                         "jav", "football", "club", "volleyball", "tennis")

def get_throwing_day_types():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('Select DISTINCT session_type from throwing_sessions')
    throwing_days = cursor.fetchall()
    conn.close()
    return throwing_days

#logged throwing days (the /submit_throwing_day form), read back for the home dashboard tab.
#session_type is stored as the form value, so display it with its THROWING_SESSION_TYPES label
_SESSION_TYPE_LABELS = dict(THROWING_SESSION_TYPES)

def _format_throwing_day(cursor, day):
    #shared card shape: the day row plus its drills, plyo block first, with notes
    #line-broken the way the templates render them
    drills = cursor.execute("select drill_type, drill_name, ball_weight, throw_count, drill_notes from throwing_day_drills where session_id = ? order by case drill_type when 'plyo' then 0 else 1 end, ID", (day['id'],)).fetchall()

    drills_formatted = []
    for x in drills:
        drill_notes = x['drill_notes'] or ""
        drills_formatted.append({ #blank out the NULLs so the table renders empty cells, not "None"
            "set": "Plyo" if x['drill_type'] == 'plyo' else "Throwing",
            "drill_name": x['drill_name'] or "",
            "ball_weight": x['ball_weight'] or "",
            "throw_count": x['throw_count'] or "",
            "drill_notes": drill_notes.replace(".", ".<br>"),
            })

    notes = day['notes'] or ""

    return {
        "id": day['id'],
        "day_name": day['day_name'],
        "date": day['date'],
        "session_type": _SESSION_TYPE_LABELS.get(day['session_type'], day['session_type']),
        "notes": notes.replace(".", ".<br>"),
        "drills": drills_formatted,
        }

def get_throwing_day_names():
    conn = get_db_connection()
    cursor = conn.cursor()

    names = cursor.execute("select day_name from throwing_days where day_name IS NOT NULL order by date DESC").fetchall()
    conn.close()
    return names

def get_latest_throwing_day():
    conn = get_db_connection()
    cursor = conn.cursor()

    day = cursor.execute("select id, date, day_name, session_type, notes from throwing_days order by ID desc limit 1").fetchone()
    if day is None: #nothing logged yet, hand the template an empty card instead of crashing
        conn.close()
        return {"id": None, "day_name": None, "date": None, "session_type": None, "notes": "", "drills": []}

    day_formatted = _format_throwing_day(cursor, day)
    conn.close()
    return day_formatted

def get_throwing_day_by_name(name):
    #names repeat across dates, so this returns the most recently logged one
    conn = get_db_connection()
    cursor = conn.cursor()

    day = cursor.execute("select id, date, day_name, session_type, notes from throwing_days where day_name = ? order by ID desc limit 1", (name,)).fetchone()
    if day is None:
        conn.close()
        return None

    day_formatted = _format_throwing_day(cursor, day)
    conn.close()
    return day_formatted

def get_game_notes():
    conn = get_db_connection()
    cursor = conn.cursor()
    game_dates = cursor.execute("select date from game_journal where in_game = 'yes' order by date DESC").fetchall()
    game_notes = cursor.execute("select id, date, opponent, subjective_notes, feel_notes, mental_notes, delivery_notes, post_outing_notes from game_journal where in_game = 'yes' order by date DESC LIMIT 1").fetchall()
    conn.close()
    
    updated_game_notes = [] #adds line break after every .
    for row in game_notes:
        s_notes = row['subjective_notes'] or ""
        f_notes = row['feel_notes'] or ""
        m_notes = row['mental_notes'] or ""
        gb_notes = row['delivery_notes'] or ""
        po_notes = row['post_outing_notes'] or ""
        
        updated_game_notes.append({
            "date": row["date"],
            "opponent": row["opponent"],
            "subjective_notes": s_notes.replace(".", ".<br>"),
            "feel_notes": f_notes.replace(".", ".<br>"),
            "mental_notes": m_notes.replace(".", ".<br>"),
            "delivery_notes": gb_notes.replace(".", ".<br>"),
            "post_outing_notes": po_notes.replace(".", ".<br>"),
            "id": row['id'],
            })
        
    return (updated_game_notes, game_dates)

def inszn_dash_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    #get last date for last 7 days throwing
    date = cursor.execute('select date from throwing_sessions order by date desc limit 1').fetchone()
    
    peak_velos = cursor.execute("SELECT max(CASE WHEN date >= date(?, '-6 days') THEN max_velo ELSE 0 END) AS pv_last_7_days, max(CASE WHEN date >= date(?, '-29 days') THEN max_velo ELSE 0 END) AS pv_last_30_days, max(max_velo) as pv_all_time FROM game_journal", (date[0],date[0])).fetchall()
    avg_readiness = cursor.execute("SELECT round(avg(CASE WHEN date >= date(?, '-2 days') THEN arm_readiness END),1) AS ar_last_3_days, round(avg(CASE WHEN date >= date(?, '-6 days') THEN arm_readiness END),1) AS ar_last_7_days FROM throwing_sessions", (date[0],date[0])).fetchall()
    acr = cursor.execute("select acr from throwing_sessions order by date desc limit 1").fetchone()
    prev_throw_day = cursor.execute("select date, session_type, total_throws, working_set_throws, max_velo from throwing_sessions order by date desc LIMIT 1").fetchall()
    days_last_game = cursor.execute("select CAST(julianday('now') - julianday(max(date)) AS INTEGER) as days_since_last_game from game_journal").fetchone()
    avg_velos = cursor.execute("SELECT round(avg(CASE WHEN date >= date(?, '-6 days') THEN avg_velo END),1) AS avg_last_7_days, round(avg(CASE WHEN date >= date(?, '-29 days') THEN avg_velo END),1) AS avg_last_30_days, round(avg(avg_velo),1) as pv_all_time FROM game_journal", (date[0],date[0])).fetchall()

    return (peak_velos, avg_readiness, acr, prev_throw_day, days_last_game, avg_velos)

def get_last7d_throw_breakdown():
    #breaks each of the last 7 calendar days (including rest days) into game throws, working set throws (outside the game), and the rest of the throws
    conn = get_db_connection()
    cursor = conn.cursor()
    #anchor "today" on the most recent logged date, matching the -7/-14/-30 day windows used elsewhere in this app
    date = cursor.execute('select date from throwing_sessions order by date desc limit 1').fetchone()
    #takes most recent throwing day date, recusrively runs this query for previous 6 days before that, getting each type of throw count for each day
    rows = cursor.execute("""
        WITH RECURSIVE date_series(day) AS (
            SELECT date(?, '-6 days')
            UNION ALL
            SELECT date(day, '+1 day') FROM date_series WHERE day < ?
        )
        SELECT ds.day as date,
               COALESCE(ts.total_throws, 0) as total_throws,
               COALESCE(ts.working_set_throws, 0) as working_set_throws,
               COALESCE(ts.non_baseball_throws, 0) as non_baseball_throws,
               COALESCE(gj.game_throws, 0) as game_throws
        FROM date_series ds
        LEFT JOIN throwing_sessions ts ON ts.date = ds.day
        LEFT JOIN game_journal gj ON gj.session_id = ts.id
        ORDER BY ds.day ASC
    """, (date[0], date[0])).fetchall()
    conn.close()

    breakdown = []
    for row in rows:
        total_throws = row["total_throws"] or 0
        working_set_throws = row["working_set_throws"] or 0
        game_throws = row["game_throws"] or 0
        non_baseball_throws = row["non_baseball_throws"] or 0

        #working_set_throws already has bullpen_throws folded in by updateThrowCount() when a game is logged,
        #so subtracting only game_throws here keeps bullpen throws in this bucket rather than "other_throws"
        #non_baseball_throws is tracked separately on throwing_sessions and never folded into total_throws,
        #so it's kept out of the game/working-set/other split entirely
        breakdown.append({
            "date": row["date"],
            "game_throws": game_throws,
            "working_set_throws": max(working_set_throws - game_throws, 0),
            "other_throws": max(total_throws - working_set_throws, 0),
            "non_baseball_throws": non_baseball_throws,
        })

    return breakdown


def updateThrowCount(session_id): #updating daily throw count in db after a game is logged: adds game throws to daily throws and updates
    conn = get_db_connection()
    cursor = conn.cursor()
    
    bullpen_throws = cursor.execute('Select bullpen_throws from game_journal where session_id = ?', (session_id[0],)).fetchone()
    game_throws = cursor.execute('Select game_throws from game_journal where session_id = ?', (session_id[0],)).fetchone()
    session_throws = cursor.execute('Select total_throws from throwing_sessions where id = ?', (session_id[0],)).fetchone()
    working_throws = cursor.execute('Select working_set_throws from throwing_sessions where id = ?', (session_id[0],)).fetchone()
    
    #these columns are all nullable, and working_set_throws in particular is unset on a lot of sessions,
    #so coalesce to 0 rather than blowing up on None + int
    bullpen = bullpen_throws[0] or 0
    game = game_throws[0] or 0
    total_throws = bullpen + game + (session_throws[0] or 0)
    working_throws = (working_throws[0] or 0) + bullpen + game
    cursor.execute("Update throwing_sessions SET total_throws = ?, session_type = session_type || ' + game', working_set_throws = ? Where id = ?", (total_throws, working_throws, session_id[0]))
    
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
    #sends date of form submission, use that for date time function and -7 days instead of date now for pi.
    #windows are the 7/28 days ENDING on that date, so a back-dated session can't pull in later throws
    throws7d = cursor.execute("SELECT sum(total_throws) FROM throwing_sessions WHERE date >= date(?, '-6 days') AND date <= ?", (date, date)).fetchone()
    throws28d = cursor.execute("SELECT sum(total_throws) FROM throwing_sessions WHERE date >= date(?, '-27 days') AND date <= ?", (date, date)).fetchone()


    #sum() is NULL when no session in the window has a total_throws logged
    aw = throws7d[0] or 0
    cw = round((throws28d[0] or 0) / 4, 0)
    #no chronic workload to compare against yet (first sessions logged), so leave acr unset rather than dividing by zero
    acr = round(aw / cw, 2) if cw else None

    cursor.execute("UPDATE throwing_sessions set acr = ? Where id = ?", (acr, session_id,))
    conn.commit()
    conn.close()
    return 

#---------WORKOUT DASH--------

def get_RatingsAvgs():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    date = cursor.execute('select date from workout_log order by date desc limit 1').fetchone()
    avg_energy = cursor.execute("SELECT avg(energy_value) FROM (Select energy_value from workout_log WHERE date >= date(?, '-6 days') order by date desc)", (date[0],)).fetchone()
    avg_fatigue = cursor.execute("SELECT avg(fatigue_value) FROM (Select fatigue_value from workout_log WHERE date >= date(?, '-6 days') order by date desc)", (date[0],)).fetchone()
    avg_motivation = cursor.execute("SELECT avg(motivation_value) FROM (Select motivation_value from workout_log WHERE date >= date(?, '-6 days') order by date desc)", (date[0],)).fetchone()
    avg_focus = cursor.execute("SELECT avg(focus_value) FROM (Select focus_value from workout_log WHERE date >= date(?, '-6 days') order by date desc)", (date[0],)).fetchone()
    
    conn.close()
    #round for display; the averages come back as long floats
    avgs = tuple(round(x[0], 1) if x[0] is not None else None
                 for x in (avg_energy, avg_fatigue, avg_motivation, avg_focus))
    return avgs

def get_WorkoutsCompleted():
    conn = get_db_connection()
    cursor = conn.cursor()

    #the dashboard table has a column per type; anything else completed is skipped for now
    DASHBOARD_TYPES = ('Lift', 'Back/Core', 'Armcare', 'Conditioning', 'Individual Workout')
   
    completed = cursor.execute("""select c.workout_date as date, w.workout_type, w.workout_name
                                  from training_calendar_daily_wkouts w
                                  JOIN training_calendar c ON c.ID = w.session_id
                                  where w.completed = 1
                                    and w.workout_type IN ({})
                                    and c.workout_date >= date('now', '-6 days', 'localtime')
                                  order by c.workout_date desc""".format(','.join('?' * len(DASHBOARD_TYPES))),
                               DASHBOARD_TYPES).fetchall()
    conn.close()

    rows = []
    dates = []
    seen = set()
    for x in completed:
        rows.append({
            "Date": x[0],
            "Type": x[1] or "",
            "Name": x[2] or "",
            })
        #the table renders one row per date, so the date list drops the repeats
        if x[0] not in seen:
            seen.add(x[0])
            dates.append({
                "Date": x[0],
                })

    return rows, dates

def get_bodyNotes_dates():
    conn = get_db_connection()
    cursor = conn.cursor()

    dates = cursor.execute("select date from workout_log where body_notes IS NOT NULL order by date DESC").fetchall()    
    conn.close()
    return dates

def get_bodyNotes(date=None, limit=3):
    #date anchors the lookup: the newest notes on or before it. the dashboard loads without one.
    conn = get_db_connection()
    cursor = conn.cursor()

    if date:
        notes = cursor.execute("select date, body_notes from workout_log where body_notes IS NOT NULL and date <= ? order by date DESC LIMIT ?", (date, limit)).fetchall()
    else:
        notes = cursor.execute("select date, body_notes from workout_log where body_notes IS NOT NULL order by date DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    body_notes = []
    for x in notes:
        b_notes = x['body_notes'] or ""
        
        body_notes.append({
            "Date": x['date'],
            "body_notes": b_notes.replace(".", ".<br>"),
            })
    return body_notes

def get_warmup_names():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    names = cursor.execute("select name from warmups where name IS NOT NULL order by date DESC").fetchall()
    conn.close()
    return names

def get_warmups():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    warmups = cursor.execute("select Id, name, rollout_ex, spine_ex, hip_ex, shoulder_ex, arm_ex, dynamic_ex, notes from warmups where name IS NOT NULL order by date DESC LIMIT 1").fetchall()
    conn.close()
    
    warmups_formatted = []
    for x in warmups:
        r_ex = x['rollout_ex'] or ""
        sp_ex = x['spine_ex'] or ""
        h_ex = x['hip_ex'] or ""
        sh_ex = x['shoulder_ex'] or ""
        a_ex = x['arm_ex'] or ""
        dy_ex = x['dynamic_ex'] or ""
        notes = x['notes'] or ""
        
        warmups_formatted.append({
            "id": x["Id"],
            "name": x["name"],
            "rollout_ex": r_ex.replace(".", ".<br>"),
            "spine_ex": sp_ex.replace(".", ".<br>"),
            "hip_ex": h_ex.replace(".", ".<br>"),
            "shoulder_ex": sh_ex.replace(".", ".<br>"),
            "arm_ex": a_ex.replace(".", ".<br>"),
            "dynamic_ex": dy_ex.replace(".", ".<br>"),
            "notes": notes.replace(".", ".<br>"),
            })
    
    return warmups_formatted

#every workout type lives in one table now; these labels are the form dropdown, the dashboard filter,
#and the workouts.workout_type CHECK constraint, so they have to stay in step with the schema
WORKOUT_TYPES = ('Lift', 'Armcare', 'Back/Core', 'Individual Workout', 'Mobility', 'Conditioning', "Throwing", "Warmup")

def _format_workout(cursor, workout):
    #shared card shape for every workout type: the session row plus its exercises, with notes
    #line-broken the way the templates render them
    exercises = cursor.execute("select ex_block, ex_name, sets_reps, ex_notes from workout_ex where session_id = ? order by ID", (workout['ID'],)).fetchall()

    exercises_formatted = []
    for x in exercises:
        ex_notes = x['ex_notes'] or ""
        exercises_formatted.append({ #blank out the NULLs so the table renders empty cells, not "None"
            "ex_block": x['ex_block'] or "",
            "ex_name": x['ex_name'] or "",
            "sets_reps": x['sets_reps'] or "",
            "ex_notes": ex_notes.replace(".", ".<br>"),
            })

    notes = workout['notes'] or ""

    return {
        "id": workout['ID'],
        "workout_name": workout['workout_name'],
        "notes": notes.replace(".", ".<br>"),
        "exercises": exercises_formatted,
        }

def get_workout_names(workout_type):
    conn = get_db_connection()
    cursor = conn.cursor()

    names = cursor.execute("select workout_name from workouts where workout_type = ? and workout_name IS NOT NULL order by date DESC", (workout_type,)).fetchall()
    conn.close()
    return names

def get_latest_workout(workout_type):
    conn = get_db_connection()
    cursor = conn.cursor()

    workout = cursor.execute("select ID, date, workout_name, notes from workouts where workout_type = ? order by ID desc limit 1", (workout_type,)).fetchone()
    if workout is None: #none of this type logged yet, hand the template an empty card instead of crashing
        conn.close()
        return {"id": None, "workout_name": None, "notes": "", "exercises": []}

    workout_formatted = _format_workout(cursor, workout)
    conn.close()
    return workout_formatted

def get_workout_by_name(workout_type, name):
    #names repeat across dates, so this returns the most recently logged one
    conn = get_db_connection()
    cursor = conn.cursor()

    workout = cursor.execute("select ID, date, workout_name, notes from workouts where workout_type = ? and workout_name = ? order by ID desc limit 1", (workout_type, name)).fetchone()
    if workout is None:
        conn.close()
        return None

    workout_formatted = _format_workout(cursor, workout) #gets workout details, exercises, etc formats and returns them here to pass to frontend.
    conn.close()
    return workout_formatted

def get_warmup_by_name(workout):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    warmups = cursor.execute("select Id, name, rollout_ex, spine_ex, hip_ex, shoulder_ex, arm_ex, dynamic_ex, notes from warmups where name = ? order by Id desc limit 1", (workout,)).fetchone()
    if warmups is None:
        conn.close()
        return None
    conn.close()
    
    r_ex = warmups['rollout_ex'] or ""
    sp_ex = warmups['spine_ex'] or ""
    h_ex = warmups['hip_ex'] or ""
    sh_ex = warmups['shoulder_ex'] or ""
    a_ex = warmups['arm_ex'] or ""
    dy_ex = warmups['dynamic_ex'] or ""
    notes = warmups['notes'] or ""

    warmup_formatted = {
        "id": warmups["Id"],
        "name": warmups["name"],
        "rollout_ex": r_ex.replace(".", ".<br>"),
        "spine_ex": sp_ex.replace(".", ".<br>"),
        "hip_ex": h_ex.replace(".", ".<br>"),
        "shoulder_ex": sh_ex.replace(".", ".<br>"),
        "arm_ex": a_ex.replace(".", ".<br>"),
        "dynamic_ex": dy_ex.replace(".", ".<br>"),
        "notes": notes.replace(".", ".<br>"),
        }

    return warmup_formatted


#── editing saved records ────────────────────────────────────────────────
#the getters above line-break notes for display; these hand back the stored text
#untouched so the edit modals round-trip what is actually in the database

def _blank_nulls(row, columns):
    return {column: row[column] or "" for column in columns}

#the other direction, for values coming back from a form or modal: a field left empty
#is stored as NULL rather than as an empty string
def blank_to_none(values):
    return {key: None if value == "" else value for key, value in values.items()}

def get_workout_for_edit(workout_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    workout = cursor.execute("select ID, date, workout_type, workout_name, notes from workouts where ID = ?", (workout_id,)).fetchone()
    if workout is None:
        conn.close()
        return None

    exercises = cursor.execute("select ex_block, ex_name, sets_reps, ex_notes from workout_ex where session_id = ? order by ID", (workout_id,)).fetchall()
    conn.close()

    return {
        "id": workout["ID"],
        "date": workout["date"],
        "workout_type": workout["workout_type"],
        "workout_name": workout["workout_name"] or "",
        "notes": workout["notes"] or "",
        "exercises": [_blank_nulls(x, ("ex_block", "ex_name", "sets_reps", "ex_notes")) for x in exercises],
        }

def get_warmup_for_edit(warmup_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    warmup = cursor.execute("select Id, date, name, rollout_ex, spine_ex, hip_ex, shoulder_ex, arm_ex, dynamic_ex, notes from warmups where Id = ?", (warmup_id,)).fetchone()
    conn.close()
    if warmup is None:
        return None

    formatted = _blank_nulls(warmup, ("name", "rollout_ex", "spine_ex", "hip_ex", "shoulder_ex", "arm_ex", "dynamic_ex", "notes"))
    formatted["id"] = warmup["Id"]
    formatted["date"] = warmup["date"]
    return formatted

def get_throwing_day_for_edit(day_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    day = cursor.execute("select id, date, day_name, session_type, notes from throwing_days where id = ?", (day_id,)).fetchone()
    if day is None:
        conn.close()
        return None

    drills = cursor.execute("select drill_type, drill_name, ball_weight, throw_count, drill_notes from throwing_day_drills where session_id = ? order by ID", (day_id,)).fetchall()
    conn.close()

    #the modal edits the two blocks separately, the way the input form posts them
    drills_by_type = {"plyo": [], "throwing": []}
    for x in drills:
        drills_by_type[x["drill_type"]].append(_blank_nulls(x, ("drill_name", "ball_weight", "throw_count", "drill_notes")))

    return {
        "id": day["id"],
        "date": day["date"],
        "day_name": day["day_name"] or "",
        "session_type": day["session_type"] or "",
        "notes": day["notes"] or "",
        "plyo_drills": drills_by_type["plyo"],
        "throwing_drills": drills_by_type["throwing"],
        }
def update_throwing_day(day_id, day, drills_by_type):
    #same wholesale replacement as the workout exercises, one pass per drill block
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("UPDATE throwing_days SET date = ?, day_name = ?, session_type = ?, notes = ? WHERE id = ?",
                   (day["date"], day["day_name"], day["session_type"], day["notes"], day_id))
    if cursor.rowcount == 0:
        conn.close()
        return False

    cursor.execute("DELETE FROM throwing_day_drills WHERE session_id = ?", (day_id,))
    for drill_type in ('plyo', 'throwing'):
        for x in drills_by_type[drill_type]:
            cursor.execute("INSERT INTO throwing_day_drills (session_id, drill_type, drill_name, ball_weight, throw_count, drill_notes) VALUES (?,?,?,?,?,?)",
                           (day_id, drill_type, x["drill_name"], x["ball_weight"], x["throw_count"], x["drill_notes"]))
    conn.commit()
    conn.close()
    return True

def update_workout(workout_id, workout, exercises):
    #the exercise rows are replaced wholesale so their stored order matches the modal's order
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("UPDATE workouts SET date = ?, workout_type = ?, workout_name = ?, notes = ? WHERE ID = ?",
                   (workout["date"], workout["workout_type"], workout["workout_name"], workout["notes"], workout_id))
    if cursor.rowcount == 0:
        conn.close()
        return False

    cursor.execute("DELETE FROM workout_ex WHERE session_id = ?", (workout_id,))
    for x in exercises:
        cursor.execute("INSERT INTO workout_ex (session_id, ex_block, ex_name, sets_reps, ex_notes) VALUES (?,?,?,?,?)",
                       (workout_id, x["ex_block"], x["ex_name"], x["sets_reps"], x["ex_notes"]))
    conn.commit()
    conn.close()
    return True

def update_warmup(warmup_id, warmup):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("UPDATE warmups SET date = ?, name = ?, rollout_ex = ?, spine_ex = ?, hip_ex = ?, shoulder_ex = ?, arm_ex = ?, dynamic_ex = ?, notes = ? WHERE Id = ?",
                   (warmup["date"], warmup["name"], warmup["rollout_ex"], warmup["spine_ex"], warmup["hip_ex"],
                    warmup["shoulder_ex"], warmup["arm_ex"], warmup["dynamic_ex"], warmup["notes"], warmup_id))
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated

def _delete_record(table, id_column, record_id):
    #foreign keys are off by default in sqlite, so turn them on for the child-row cascades
    conn = get_db_connection()
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    cursor.execute(f"DELETE FROM {table} WHERE {id_column} = ?", (record_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def delete_workout(workout_id):
    return _delete_record("workouts", "ID", workout_id)

def delete_warmup(warmup_id):
    return _delete_record("warmups", "Id", warmup_id)

def delete_throwing_day(day_id):
    return _delete_record("throwing_days", "id", day_id)

def get_throwing_workouts_by_name():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    names = cursor.execute("select day_name from throwing_days where ID IS NOT NULL order by ID desc").fetchall()
    conn.close()
    return names

#--------TRAINING CALENDAR----------
def getCalendarWorkouts():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    rows = cursor.execute("""SELECT w.ID AS id, c.workout_date AS date,
                                    w.workout_type AS type, w.workout_name AS name,
                                    w.completed AS done,
                                    (l.id IS NOT NULL) AS logged
                             FROM training_calendar_daily_wkouts w
                             JOIN training_calendar c ON c.ID = w.session_id
                             LEFT JOIN workout_weight_log l ON l.daily_workout_id = w.ID
                             ORDER BY w.ID""").fetchall()
    workouts = [dict(row) for row in rows]
    return workouts

#--------WORKOUT WEIGHT LOG----------
#a log is keyed to the scheduled workout it belongs to, not to the day: one calendar
#day holds several workouts, so training_calendar.ID would not identify which

def _format_weight_log(cursor, log):
    rows = cursor.execute(
        """select ex_block, ex_name, sets_reps_rx, sets_reps_done, weight_value, weight_note
           from workout_weight_log_ex where log_id = ? order by ex_order""", (log["id"],)).fetchall()
    return {
        "id": log["id"],
        "daily_workout_id": log["daily_workout_id"],
        "date_completed": log["date_completed"],
        "workout_name": log["workout_name"],
        "workout_type": log["workout_type"],
        "exercises": [dict(row) for row in rows],
        }

def get_weight_log(daily_workout_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    log = cursor.execute("select * from workout_weight_log where daily_workout_id = ?",
                         (daily_workout_id,)).fetchone()
    if log is None:
        conn.close()
        return None

    formatted = _format_weight_log(cursor, log)
    conn.close()
    return formatted

def get_previous_weight_log(workout_name, before_date):
    #the source for the modal's placeholders: what this same workout was last logged at.
    #strictly before, so reopening a log does not offer that log back to itself
    conn = get_db_connection()
    cursor = conn.cursor()

    log = cursor.execute(
        """select * from workout_weight_log
           where workout_name = ? and date_completed < ?
           order by date_completed desc, id desc limit 1""",
        (workout_name, before_date)).fetchone()
    if log is None:
        conn.close()
        return None

    formatted = _format_weight_log(cursor, log)
    conn.close()
    return formatted

def save_weight_log(daily_workout_id, log, exercises):
    #one log per scheduled workout, so this upserts rather than appending: clicking a
    #workout opens its log, and "log" and "edit log" are the same operation
    conn = get_db_connection()
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    existing = cursor.execute("select id from workout_weight_log where daily_workout_id = ?",
                              (daily_workout_id,)).fetchone()
    if existing:
        log_id = existing["id"]
        cursor.execute("""UPDATE workout_weight_log
                          SET date_completed = ?, workout_name = ?, workout_type = ?
                          WHERE id = ?""",
                       (log["date_completed"], log["workout_name"], log["workout_type"], log_id))
        #replaced wholesale so stored order matches the modal's order, as update_workout does
        cursor.execute("DELETE FROM workout_weight_log_ex WHERE log_id = ?", (log_id,))
    else:
        cursor.execute("""INSERT INTO workout_weight_log
                          (daily_workout_id, date_completed, workout_name, workout_type)
                          VALUES (?,?,?,?)""",
                       (daily_workout_id, log["date_completed"], log["workout_name"], log["workout_type"]))
        log_id = cursor.lastrowid

    for order, ex in enumerate(exercises):
        cursor.execute("""INSERT INTO workout_weight_log_ex
                          (log_id, ex_order, ex_block, ex_name, sets_reps_rx, sets_reps_done, weight_value, weight_note)
                          VALUES (?,?,?,?,?,?,?,?)""",
                       (log_id, order, ex.get("ex_block"), ex.get("ex_name"), ex.get("sets_reps_rx"),
                        ex.get("sets_reps_done"), ex.get("weight_value"), ex.get("weight_note")))

    #logging what was lifted is itself the record that the workout was done
    cursor.execute("UPDATE training_calendar_daily_wkouts SET completed = 1 WHERE ID = ?",
                   (daily_workout_id,))

    conn.commit()
    conn.close()
    return log_id

def get_journal_entry_dates():
    #the calendar inlines these so day clicks need no round trip, same as the workout rows
    conn = get_db_connection()
    cursor = conn.cursor()

    throwing = cursor.execute("select distinct date from throwing_sessions").fetchall()
    workout = cursor.execute("select distinct date from workout_log").fetchall()
    conn.close()

    return {
        "throwing": [row[0] for row in throwing],
        "workout": [row[0] for row in workout],
        }

#── outing report data ───────────────────────────────────────────────────
#the postgame CSV exports and the pitch-by-pitch file are read and shaped here;
#/api/outing_report_data assembles its response out of these pieces

OUTING_REPORT_FOLDER = Config.OUTING_UPLOAD_FOLDER

#pBp pitch type names -> chart color, shared across the movement/release/velo/zone charts
OUTING_PITCH_TYPE_COLORS = {
    "Four Seamer": "rgb(255, 0, 0)",
    "Fastball": "rgb(255, 0, 0)",
    "Two Seamer": "rgba(255, 140, 0, 1)",
    "Sinker": "rgba(255, 165, 0, 1)",
    "Cutter": "rgba(0, 0, 0, 1)",
    "Changeup": "rgba(0, 255, 0, 1)",
    "Splitter": "rgba(255, 192, 203, 1)",
    "Slider": "rgba(255, 255, 0, 1)",
    "Sweeper": "rgba(0, 0, 255, 1)",
    "Curveball": "rgba(128, 0, 128, 1)",
    "Knuckle Curve": "rgba(153, 50, 204, 1)",
    "Knuckleball": "rgba(211, 211, 211, 1)",
}

#the two postgame report exports split the same outing different ways: one row per pitch type, or one
#row per batter hand. Both carry a TOTAL row, so any table below can be shown under either grouping.
OUTING_SPLIT_COLUMNS = {"pitch": "Pitch Type - Ungrouped", "hand": "Batter Hand"}

#split values the export writes vs. what the report shows
OUTING_SPLIT_LABELS = {"Lefty": "LHH", "Righty": "RHH"}

#table key -> postgame report column, one map per table on the Table Results tab
OUTING_MVMT_COLUMNS = {
    "pitch_count": "P",
    "velo": "Vel",
    "max_velo": "MxVel",
    "ivb": "IndVertBrk",
    "hb": "HorzBrk",
    "rel_z": "RelHeight",
    "rel_x": "RelSide",
    "ext": "Extension",
}

OUTING_STRIKES_COLUMNS = {
    "zone_pct": "IZ%",
    "two_k_zone_pct": "2K IZ%",
    "heart_pct": "Heart%",
}

OUTING_MISS_COLUMNS = {
    "csw_pct": "CSW%",
    "whiff_pct": "Miss%",
    "two_k_swstr_pct": "SwingingStrike% w/ 2K",
    "z_whiff_pct": "IZ Ms%",
    "o_whiff_pct": "OZMiss% - P",
    "chase_pct": "Chase%",
}

OUTING_DAMAGE_COLUMNS = {
    "woba": "wOBA",
    "xwoba": "xWOBA",
    "xwobacon": "xWOBAcon",
    "babip": "BABIP",
    "hard_hit_pct": "HardHit%",
    "gb_pct": "Ground%",
    "fb_pct": "Fly%",
}

#rate stats the export prints as .XXX. pandas only reads them as floats when the export happens to have
#no dashes in the column, so reformat those back to match how the rest of the report shows them.
OUTING_RATE_COLUMNS = {"wOBA", "xWOBA", "xWOBAcon", "BABIP"}

#the summary table above the tabs; these columns only exist on the batter hand export
OUTING_SUMMARY_COLUMNS = {
    "fps_pct": "FPStk%",
    "ahead_pct": "Ahead%",
    "early_ahead_pct": "Early+Ahead%",
    "two_k_so_pct": "2K K%",
    "k_pct": "K%",
    "bb_pct": "BB%",
    "k_minus_bb_pct": "K%-BB% (Pit)",
    "csw_pct": "CSW%",
}

def read_outing_postgame_report(path):
    #the export repeats its header line before each mini-table (TOTAL, then the split rows) and
    #separates them with a blank line, so strip anything that isn't the first header or a data row
    with open(path) as f:
        lines = f.read().splitlines()

    header = lines[0]
    data_lines = [line for line in lines[1:] if line.strip() != '' and line != header]
    return pd.read_csv(io.StringIO(header + '\n' + '\n'.join(data_lines)))

def _outing_table_row(row, label, columns):
    #the export writes '-' for a metric it can't compute; keep those as-is so the table shows the dash,
    #and unbox numpy scalars on the way out since jsonify can't serialize them
    values = {"group": label}
    for key, column in columns.items():
        value = row[column]
        if pd.isna(value):
            value = '-'
        elif column in OUTING_RATE_COLUMNS and pd.api.types.is_number(value):
            value = f"{value:.3f}".lstrip('0')
        values[key] = value.item() if hasattr(value, 'item') else value
    return values

def outing_table(df, split, columns, include_total = True):
    #one row per split value, led by an Overall row off the export's TOTAL row.
    #splits with zero pitches thrown are dropped - the export lists every pitch type in the arsenal.
    rows = []

    total = df.loc[df['SplitBy'] == 'TOTAL']
    if include_total and not total.empty:
        rows.append(_outing_table_row(total.iloc[0], 'Overall', columns))

    pitches = pd.to_numeric(df['P'], errors = 'coerce').fillna(0)
    split_rows = df.loc[(df['SplitBy'] != 'TOTAL') & (pitches > 0)]
    for _, row in split_rows.iterrows():
        split_value = row[OUTING_SPLIT_COLUMNS[split]]
        rows.append(_outing_table_row(row, OUTING_SPLIT_LABELS.get(split_value, split_value), columns))

    return rows

def outing_grouped_table(postgame_dfs, columns):
    #same table under both groupings, so the page can toggle between them without another request.
    #both keys are always present; a grouping whose export wasn't selected comes back empty.
    return {split: outing_table(postgame_dfs[split], split, columns) if split in postgame_dfs else []
            for split in OUTING_SPLIT_COLUMNS}

def read_outing_pbp(path):
    df = pd.read_csv(path)

    numeric_cols = ['Vel', 'IndVertBrk', 'HorzBrk', 'RelX', 'RelZ', 'PX', 'PZ']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df['pitch_type'] = df['pitchTypeFull'].fillna('Unknown')

    movement_df = df.dropna(subset=['HorzBrk', 'IndVertBrk'])
    movement = [{"pitch_type": r.pitch_type, "hb": r.HorzBrk, "ivb": r.IndVertBrk, "velo": r.Vel} for r in movement_df.itertuples()]

    #RelX/RelZ come from this file in inches; convert to feet to line up with the postgame report's release units
    release_df = df.dropna(subset=['RelX', 'RelZ'])
    release = [{"pitch_type": r.pitch_type, "rel_x": r.RelX / 12, "rel_z": r.RelZ / 12} for r in release_df.itertuples()]

    velo_df = df.dropna(subset=['Vel']).reset_index(drop=True)
    velo = [{"pitch_type": row.pitch_type, "pitch_num": i + 1, "velo": row.Vel} for i, row in enumerate(velo_df.itertuples())]

    zone_df = df.dropna(subset=['PX', 'PZ'])
    locations_rhh = []
    locations_lhh = []
    for r in zone_df.itertuples():
        point = {"x": r.PX, "y": r.PZ, "pitch_type": r.pitch_type, "velo": r.Vel, "ivb": r.IndVertBrk, "hb": r.HorzBrk, "result": r.pitchResult}
        if r.batterHand == 'L':
            locations_lhh.append(point)
        else:
            locations_rhh.append(point)

    return movement, release, velo, locations_rhh, locations_lhh
