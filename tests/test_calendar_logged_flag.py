from app.models import getCalendarWorkouts, save_weight_log


def test_workouts_report_whether_they_have_a_log(db, scheduled_workout):
    unlogged = scheduled_workout(date="2026-09-16", name="Lower A")
    logged = scheduled_workout(date="2026-09-17", name="Upper A")
    save_weight_log(logged,
                    {"date_completed": "2026-09-17", "workout_name": "Upper A", "workout_type": "Lift"},
                    [{"ex_name": "Bench", "weight_value": 185.0}])

    by_id = {w["id"]: w for w in getCalendarWorkouts()}

    assert by_id[logged]["logged"] == 1
    assert by_id[unlogged]["logged"] == 0
