from flask import Flask
from config import Config
import os

app = Flask(__name__)
app.config.from_object(Config)

#PythonAnywhere serves /static/ through its own mapping rather than Flask, with a long
#cache lifetime, so an edited file can keep loading from the browser's stored copy for
#days after a reload. stamping each static URL with the file's mtime means every edit
#produces a URL the browser has never seen
@app.url_defaults
def static_cache_bust(endpoint, values):
    if endpoint == 'static' and 'filename' in values:
        try:
            values['v'] = int(os.stat(os.path.join(app.static_folder, values['filename'])).st_mtime)
        except OSError:
            pass

from app import views, forms, input_validation, models, api_calls
