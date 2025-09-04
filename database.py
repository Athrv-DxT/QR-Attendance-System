from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
import tempfile

db = SQLAlchemy()

class Participant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False, unique=True)
    qr_code_path = db.Column(db.String(200))
    qr_code_sent = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Attendance(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    participant_id = db.Column(db.Integer, db.ForeignKey('participant.id'), nullable=False)
    entry_time = db.Column(db.DateTime, default=datetime.utcnow)
    participant = db.relationship('Participant', backref=db.backref('attendances', lazy=True))

def _writable_instance_dir() -> str:
    custom = os.environ.get('INSTANCE_DIR')
    if custom:
        base = custom
    else:
        # Prefer Render persistent disk if present
        base = '/var/data' if os.path.isdir('/var/data') else tempfile.gettempdir()
    instance_dir = os.path.join(base, 'instance')
    os.makedirs(instance_dir, exist_ok=True)
    return instance_dir

def init_db(app):
    database_url = os.environ.get('DATABASE_URL')

    if database_url:
        # Normalize postgres scheme
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)

        if database_url.startswith("sqlite"):
            # If sqlite URL is relative or not clearly absolute, rewrite to writable absolute path
            # sqlite:///path -> relative; sqlite:////path -> absolute
            is_absolute = database_url.startswith("sqlite:////")
            if not is_absolute:
                instance_dir = _writable_instance_dir()
                db_path = os.path.join(instance_dir, 'attendance.db')
                db_uri_path = db_path.replace('\\', '/')
                database_url = f"sqlite:///{db_uri_path}"
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    else:
        # Fallback to SQLite under a writable directory
        instance_dir = _writable_instance_dir()
        db_path = os.path.join(instance_dir, 'attendance.db')
        db_uri_path = db_path.replace('\\', '/')
        app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_uri_path}'
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    
    with app.app_context():
        db.create_all()