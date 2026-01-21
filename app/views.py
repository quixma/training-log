# -*- coding: utf-8 -*-
from app import app
from app.models import get_throwing_notes, get_throwing_plan, get_throwing_plan_dates, get_throwing_notes_dates, get_summary_data
from flask import render_template


@app.route("/", methods=["GET"])
def index():
    throwing_notes = get_throwing_notes()  
    throwing_plan, drills = get_throwing_plan()
    plan_dates = get_throwing_plan_dates()
    notes_dates = get_throwing_notes_dates()
    
    for x in throwing_plan: #get id of throwing plan
        tableID = x['id']
    
    return render_template('index.html', throwing_notes = throwing_notes, throwing_plan=throwing_plan, drills=drills, tableID = tableID, plan_dates = plan_dates, notes_dates = notes_dates)

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
    return render_template('bullpen_report.html')

@app.route('/inszn-home', methods = ["GET", "POST"])
def inszn_home():
    return render_template('inszn_home.html')