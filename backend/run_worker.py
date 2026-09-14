from app import create_app
from app.jobs import ScheduleImportWorker

app = create_app()

with app.app_context():
    ScheduleImportWorker().run_forever()
