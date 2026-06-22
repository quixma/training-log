# -*- coding: utf-8 -*-
from app import app
from app.models import inszn_dash_data, get_inszn_throwing_plan_dates, get_game_notes, get_throwing_notes, get_throwing_plan, get_throwing_plan_prethrow, get_throwing_plan_dates, get_totalthrows4wk, get_totalworkingthrows4wk, get_throwing_notes_dates, get_summary_data, get_bullpen_report_files, get_throwing_day_types
from app.models import get_RatingsAvgs, get_WorkoutsCompleted, get_bodyNotes_dates, get_bodyNotes
from app.api_calls import shutdown
from flask import render_template, request, redirect, url_for


@app.route("/", methods=["GET"])
def index():
    return redirect(url_for('inszn_home'))

@app.route("/offszn_home", methods=["GET"])
def offszn_home(): 
    throwing_notes = get_throwing_notes() 
    throwing_plan, drills = get_throwing_plan()
    plan_dates = get_throwing_plan_dates()
    notes_dates = get_throwing_notes_dates()
    throwing_days = get_throwing_day_types()
    message = request.args.get('message')
    
    for x in throwing_plan: #get id of throwing plan
        tableID = x['id']
    
    return render_template('offszn_home.html',throwing_notes = throwing_notes, throwing_plan=throwing_plan, drills=drills, tableID = tableID, plan_dates = plan_dates, notes_dates = notes_dates, throwing_days = throwing_days)

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

@app.route('/bullpen-report', methods = ["GET", "POST"])
def bullpen_report():
    filenames = get_bullpen_report_files()
    return render_template('bullpen_report.html', filenames=filenames)

@app.route('/inszn-home', methods = ["GET", "POST"])
def inszn_home():
    throwing_notes = get_throwing_notes()  
    throwing_plan, drills = get_throwing_plan()
    tp_prethrow = get_throwing_plan_prethrow()
    plan_dates = get_inszn_throwing_plan_dates()
    notes_dates = get_throwing_notes_dates()
    throwing_days = get_throwing_day_types()
    peak_velo, avg_readiness, acr, total_throws7d, working_throws7d, prev_throw_day, days_last_game, avg_velos = inszn_dash_data()
    throws4wk = get_totalthrows4wk()
    workingthrows4wk = get_totalworkingthrows4wk()
    game_notes, game_dates = get_game_notes()
    
    for x in throwing_plan: #get id of throwing plan
        tableID = x['id']
    
    return render_template('inszn_home.html',throwing_notes = throwing_notes, throwing_plan=throwing_plan, drills=drills, tp_prethrow = tp_prethrow, 
                           tableID = tableID, plan_dates = plan_dates, notes_dates = notes_dates, throwing_days = throwing_days,
                           peak_velo = peak_velo, avg_readiness = avg_readiness, acr = acr, total_throws7d = total_throws7d, working_throws7d = working_throws7d,
                           prev_throw_day = prev_throw_day, days_last_game = days_last_game, throws4wk = throws4wk, workingthrows4wk = workingthrows4wk, avg_velos = avg_velos,
                           game_notes = game_notes, game_dates = game_dates)

@app.route('/inszn_throwing_form', methods=["GET", "POST"])
def inszn_throwing_form():
    return render_template('inszn_throwing_form.html')

@app.route('/game_form', methods=["GET", "POST"])
def game_form():
    return render_template('game_form.html')

@app.route('/outing_report', methods=["GET", "POST"])
def outing_report():
    return render_template('outing_report.html')

@app.route('/inszn_throwing_plan', methods=["GET", "POST"])
def inszn_throwing_plan():
    return render_template('inszn_throwing_plan.html')

@app.route('/game_data_dashboard', methods=["GET", "POST"])
def game_data_dashboard():
    return render_template('game_data_dashboard.html')

@app.route('/workout_dashboard', methods=["GET", "POST"])
def workout_dashboard():
    energy, fatigue, motivation, focus = get_RatingsAvgs()
    rows = get_WorkoutsCompleted()
    dates = get_bodyNotes_dates()
    body_notes = get_bodyNotes()
    
    return render_template('workout_dashboard.html', energy = energy, fatigue = fatigue, motivation = motivation, focus = focus,
                           rows = rows, dates = dates, body_notes = body_notes)

@app.route('/workout_form', methods=["GET", "POST"])
def workout_form():
    return render_template('workout_form.html')

@app.route('/lifting_forms', methods=["GET", "POST"])
def lifting_forms():
    return render_template('lifting_forms.html')
