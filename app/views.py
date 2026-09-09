# -*- coding: utf-8 -*-
from app import app
from app.models import inszn_dash_data, get_inszn_throwing_plan_dates, get_game_notes, get_throwing_notes, get_throwing_plan, get_throwing_plan_prethrow, get_last7d_throw_breakdown
from app.models import get_totalthrows4wk, get_totalworkingthrows4wk, get_throwing_notes_dates, get_bullpen_report_files, get_outing_report_files, get_throwing_day_types
from app.models import get_RatingsAvgs, get_WorkoutsCompleted, get_bodyNotes_dates, get_bodyNotes, get_warmup_names, get_warmups
from app.models import get_workout_names, get_latest_workout, WORKOUT_TYPES, THROWING_SESSION_TYPES, THROWING_BALL_WEIGHTS
from app.models import get_player_goals, get_player_goals_dates
from app.models import get_throwing_day_names, get_latest_throwing_day
from app.api_calls import shutdown
from flask import render_template, redirect, url_for


@app.route("/", methods=["GET"])
def index():
    return redirect(url_for('inszn_home'))

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
    peak_velo, avg_readiness, acr, prev_throw_day, days_last_game, avg_velos = inszn_dash_data()
    throws4wk = get_totalthrows4wk()
    workingthrows4wk = get_totalworkingthrows4wk()
    game_notes, game_dates = get_game_notes()
    player_goals = get_player_goals('pitching')
    player_goals_dates = get_player_goals_dates('pitching')
    throws_breakdown = get_last7d_throw_breakdown()
    #the throwing days tab opens on the most recently logged day and swaps the rest in via /api/getThrowingDay
    throwing_day_names = get_throwing_day_names()
    throwing_day = get_latest_throwing_day()

    for x in throwing_plan: #get id of throwing plan
        tableID = x['id']

    return render_template('inszn_home.html',throwing_notes = throwing_notes, throwing_plan=throwing_plan, drills=drills, tp_prethrow = tp_prethrow,
                           tableID = tableID, plan_dates = plan_dates, notes_dates = notes_dates, throwing_days = throwing_days,
                           peak_velo = peak_velo, avg_readiness = avg_readiness, acr = acr, throws_breakdown = throws_breakdown,
                           prev_throw_day = prev_throw_day, days_last_game = days_last_game, throws4wk = throws4wk, workingthrows4wk = workingthrows4wk, avg_velos = avg_velos,
                           game_notes = game_notes, game_dates = game_dates, player_goals = player_goals, player_goals_dates = player_goals_dates,
                           throwing_day_names = throwing_day_names, throwing_day = throwing_day)

@app.route('/inszn_throwing_form', methods=["GET", "POST"])
def inszn_throwing_form():
    return render_template('inszn_throwing_form.html', session_types = THROWING_SESSION_TYPES,
                           ball_weights = THROWING_BALL_WEIGHTS)

@app.route('/game_form', methods=["GET", "POST"])
def game_form():
    return render_template('game_form.html')

@app.route('/outing_report', methods=["GET", "POST"])
def outing_report():
    filenames = get_outing_report_files()
    return render_template('outing_report.html', filenames=filenames)

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
    warmup_names = get_warmup_names()
    warmups = get_warmups()
    #the workouts tab opens on the first type and swaps the rest in via /api/getWorkoutsByType
    workout_names = get_workout_names(WORKOUT_TYPES[0])
    workout = get_latest_workout(WORKOUT_TYPES[0])
    player_goals = get_player_goals('workout')
    player_goals_dates = get_player_goals_dates('workout')

    return render_template('workout_dashboard.html', energy = energy, fatigue = fatigue, motivation = motivation, focus = focus,
                           rows = rows, dates = dates, body_notes = body_notes, warmup_names = warmup_names, warmups = warmups,
                          workout_types = WORKOUT_TYPES, workout_names = workout_names, workout = workout,
                          player_goals = player_goals, player_goals_dates = player_goals_dates)

@app.route('/workout_form', methods=["GET", "POST"])
def workout_form():
    return render_template('workout_form.html')

@app.route('/lifting_forms', methods=["GET", "POST"])
def lifting_forms():
    return render_template('lifting_forms.html', workout_types = WORKOUT_TYPES,
                           session_types = THROWING_SESSION_TYPES, ball_weights = THROWING_BALL_WEIGHTS)

@app.route('/training_calendar', methods=["GET", "POST"])
def training_calendar():
    return render_template('training_calendar.html')
