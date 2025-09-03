from flask import Flask, render_template, request, jsonify, redirect, url_for, send_file, flash
import os
import uuid
from werkzeug.utils import secure_filename
from database import db, init_db, Participant, Attendance
from utils import process_excel_file, generate_qr_code, send_qr_email, create_attendance_excel
from datetime import datetime

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ .env file loaded successfully")
except ImportError:
    print("⚠️  python-dotenv not installed. Install with: pip install python-dotenv")
    print("   Environment variables must be set manually or through deployment platform.")

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize database
init_db(app)

# Ensure upload directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(os.path.join('static', 'qr_codes'), exist_ok=True)

@app.route('/')
def index():
    participant_count = Participant.query.count()
    attendance_count = Attendance.query.count()
    return render_template('index.html', 
                         participant_count=participant_count,
                         attendance_count=attendance_count)

@app.route('/upload')
def upload_page():
    return render_template('upload.html')

@app.route('/upload', methods=['POST'])
def upload_excel():
    try:
        if 'file' not in request.files:
            flash('No file selected', 'error')
            return redirect(request.url)
        
        file = request.files['file']
        if file.filename == '':
            flash('No file selected', 'error')
            return redirect(request.url)
        
        if file and file.filename.lower().endswith(('.xlsx', '.xls')):
            filename = secure_filename(file.filename)
            unique_filename = f"{uuid.uuid4().hex}_{filename}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(filepath)
            
            # Process Excel file
            participants_data = process_excel_file(filepath)
            
            # Save participants to database
            added_count = 0
            for p_data in participants_data:
                existing = Participant.query.filter_by(email=p_data['email']).first()
                if not existing:
                    participant = Participant(
                        name=p_data['name'],
                        email=p_data['email']
                    )
                    db.session.add(participant)
                    db.session.commit()
                    
                    # Generate QR code
                    qr_path = generate_qr_code(participant.id, participant.name)
                    participant.qr_code_path = qr_path
                    db.session.commit()
                    
                    added_count += 1
            
            # Clean up uploaded file
            os.remove(filepath)
            
            flash(f'Successfully added {added_count} participants', 'success')
            return redirect(url_for('participants'))
        else:
            flash('Please upload a valid Excel file (.xlsx or .xls)', 'error')
            return redirect(request.url)
    
    except Exception as e:
        flash(f'Error processing file: {str(e)}', 'error')
        return redirect(request.url)

@app.route('/participants')
def participants():
    participants = Participant.query.all()
    return render_template('participants.html', participants=participants)

@app.route('/send-emails', methods=['POST'])
def send_emails():
    try:
        data = request.get_json()
        message = data.get('message', 'Please find your QR code for event attendance.')
        
        # Email configuration from environment variables
        smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.environ.get('SMTP_PORT', '587'))
        email_user = os.environ.get('EMAIL_USER')
        email_password = os.environ.get('EMAIL_PASSWORD')
        
        if not email_user or not email_password:
            return jsonify({'success': False, 'message': 'Email credentials not configured'})
        
        participants = Participant.query.filter_by(qr_code_sent=False).all()
        sent_count = 0
        
        for participant in participants:
            if send_qr_email(participant, message, smtp_server, smtp_port, email_user, email_password):
                participant.qr_code_sent = True
                db.session.commit()
                sent_count += 1
        
        return jsonify({
            'success': True,
            'message': f'QR codes sent to {sent_count} participants'
        })
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/scan')
def scan_page():
    return render_template('scan.html')

@app.route('/scan-qr', methods=['POST'])
def scan_qr():
    try:
        data = request.get_json()
        qr_data = data.get('qr_data', '')
        
        # Extract participant ID from QR data
        if qr_data.startswith('PARTICIPANT_ID:'):
            participant_id = int(qr_data.replace('PARTICIPANT_ID:', ''))
            
            participant = Participant.query.get(participant_id)
            if not participant:
                return jsonify({'success': False, 'message': 'Invalid QR code'})
            
            # Check if already marked attendance
            existing_attendance = Attendance.query.filter_by(participant_id=participant_id).first()
            if existing_attendance:
                return jsonify({
                    'success': False,
                    'message': f'{participant.name} already marked attendance at {existing_attendance.entry_time.strftime("%Y-%m-%d %H:%M:%S")}'
                })
            
            # Mark attendance
            attendance = Attendance(participant_id=participant_id)
            db.session.add(attendance)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'Attendance marked for {participant.name}',
                'participant': {
                    'name': participant.name,
                    'email': participant.email,
                    'entry_time': attendance.entry_time.strftime('%Y-%m-%d %H:%M:%S')
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Invalid QR code format'})
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/attendance')
def attendance_list():
    attendances = Attendance.query.order_by(Attendance.entry_time.desc()).all()
    return jsonify([{
        'name': att.participant.name,
        'email': att.participant.email,
        'entry_time': att.entry_time.strftime('%Y-%m-%d %H:%M:%S')
    } for att in attendances])

@app.route('/download-attendance')
def download_attendance():
    try:
        attendances = Attendance.query.all()
        if not attendances:
            flash('No attendance records found', 'error')
            return redirect(url_for('index'))
        
        filepath = create_attendance_excel(attendances)
        return send_file(filepath, as_attachment=True, download_name='attendance_report.xlsx')
    
    except Exception as e:
        flash(f'Error creating attendance file: {str(e)}', 'error')
        return redirect(url_for('index'))

@app.route('/reset-system', methods=['POST'])
def reset_system():
    try:
        # Clear all data
        Attendance.query.delete()
        Participant.query.delete()
        db.session.commit()
        
        # Clean up QR codes
        qr_dir = os.path.join('static', 'qr_codes')
        if os.path.exists(qr_dir):
            for file in os.listdir(qr_dir):
                os.remove(os.path.join(qr_dir, file))
        
        return jsonify({'success': True, 'message': 'System reset successfully'})
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/config-check')
def config_check():
    """Check email configuration status"""
    try:
        email_user = os.environ.get('EMAIL_USER')
        email_password = os.environ.get('EMAIL_PASSWORD')
        smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = os.environ.get('SMTP_PORT', '587')
        
        config_status = {
            'email_user': '✅ Configured' if email_user else '❌ Not configured',
            'email_password': '✅ Configured' if email_password else '❌ Not configured',
            'smtp_server': f'✅ {smtp_server}',
            'smtp_port': f'✅ {smtp_port}',
            'overall_status': '✅ Ready' if (email_user and email_password) else '❌ Not ready'
        }
        
        return jsonify(config_status)
    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)