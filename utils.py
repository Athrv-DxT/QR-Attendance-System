import pandas as pd
import qrcode
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from database import Participant, db
import uuid

def process_excel_file(file_path):
    """Process uploaded Excel file and extract name and email"""
    try:
        df = pd.read_excel(file_path)
        
        # Clean column names
        df.columns = df.columns.str.strip().str.lower()
        
        # Look for name and email columns
        name_col = None
        email_col = None
        
        for col in df.columns:
            if 'name' in col:
                name_col = col
            elif 'email' in col or 'mail' in col:
                email_col = col
        
        if not name_col or not email_col:
            raise ValueError("Excel file must contain 'name' and 'email' columns")
        
        participants = []
        for _, row in df.iterrows():
            if pd.notna(row[name_col]) and pd.notna(row[email_col]):
                participants.append({
                    'name': str(row[name_col]).strip(),
                    'email': str(row[email_col]).strip().lower()
                })
        
        return participants
    except Exception as e:
        raise Exception(f"Error processing Excel file: {str(e)}")

def generate_qr_code(participant_id, name):
    """Generate QR code for participant"""
    try:
        # Create QR data with participant ID
        qr_data = f"PARTICIPANT_ID:{participant_id}"
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        # Create QR code image
        qr_img = qr.make_image(fill_color="black", back_color="white")
        
        # Ensure directory exists
        qr_dir = os.path.join('static', 'qr_codes')
        os.makedirs(qr_dir, exist_ok=True)
        
        # Save QR code
        filename = f"qr_{participant_id}_{uuid.uuid4().hex[:8]}.png"
        qr_path = os.path.join(qr_dir, filename)
        qr_img.save(qr_path)
        
        # Return path with forward slashes for web compatibility
        return qr_path.replace('\\', '/')
    except Exception as e:
        raise Exception(f"Error generating QR code: {str(e)}")

def send_qr_email(participant, message, smtp_server, smtp_port, email_user, email_password):
    """Send QR code to participant via email"""
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = email_user
        msg['To'] = participant.email
        msg['Subject'] = "Your QR Code for Event Attendance"
        
        # Email body
        body = f"""
        Dear {participant.name},
        
        {message}
        
        Please find your QR code attached. Show this QR code at the event for attendance marking.
        
        Best regards,
        Event Team
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Attach QR code
        if os.path.exists(participant.qr_code_path):
            with open(participant.qr_code_path, 'rb') as f:
                qr_image = MIMEImage(f.read())
                qr_image.add_header('Content-Disposition', 'attachment', filename='qr_code.png')
                msg.attach(qr_image)
        
        # Send email
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(email_user, email_password)
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending email to {participant.email}: {str(e)}")
        return False

def create_attendance_excel(attendances):
    """Create Excel file with attendance data"""
    try:
        data = []
        for attendance in attendances:
            data.append({
                'Name': attendance.participant.name,
                'Email': attendance.participant.email,
                'Entry Time': attendance.entry_time.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        df = pd.DataFrame(data)
        
        # Ensure uploads directory exists
        uploads_dir = 'uploads'
        os.makedirs(uploads_dir, exist_ok=True)
        
        filename = f"attendance_{uuid.uuid4().hex[:8]}.xlsx"
        filepath = os.path.join(uploads_dir, filename)
        df.to_excel(filepath, index=False)
        
        return filepath
    except Exception as e:
        raise Exception(f"Error creating attendance Excel: {str(e)}")