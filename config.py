import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-will-never-guess'
    DEBUG = False
    DB_PATH = os.path.join(BASE_DIR, 'training_log.db')
    BULLPEN_UPLOAD_FOLDER = os.path.join(BASE_DIR, 'bullpen_report_uploads')
    OUTING_UPLOAD_FOLDER = os.path.join(BASE_DIR, 'outing_report_uploads')
