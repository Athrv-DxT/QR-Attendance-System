# QR Attendance System

A Flask-based web application for managing attendance using QR codes. The system allows participants to scan QR codes to mark their attendance and administrators to manage participants and view attendance reports.

## Features

- QR code generation for events/sessions
- QR code scanning for attendance marking
- Participant management (add, edit, delete)
- Attendance tracking and reporting
- Email notifications
- Excel export functionality
- Responsive web interface

## Prerequisites

- Python 3.7+
- pip
- Git

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Athrv-DxT/QR-Attendance-System.git
   cd QR-Attendance-System
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   
   Create a `.env` file in the project root with the following variables:
   ```env
   SECRET_KEY=your-secret-key-here
   DATABASE_URL=sqlite:///instance/attendance.db
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   PORT=5000
   ```
   
   **Important**: Never commit your `.env` file to version control!

5. **Initialize the database**
   ```bash
   python database.py
   ```

6. **Run the application**
   ```bash
   python app.py
   ```

   The application will be available at `http://localhost:5000`

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SECRET_KEY` | Flask secret key for sessions | `dev-secret-key-change-in-production` | Yes |
| `DATABASE_URL` | Database connection string | `sqlite:///instance/attendance.db` | No |
| `EMAIL_USER` | Email address for sending notifications | - | Yes |
| `EMAIL_PASSWORD` | Email app password | - | Yes |
| `SMTP_SERVER` | SMTP server address | `smtp.gmail.com` | No |
| `SMTP_PORT` | SMTP server port | `587` | No |
| `PORT` | Application port | `5000` | No |

## Email Setup

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. **Use the app password** in your `.env` file (not your regular password)

## Deployment on Render

This project is configured for Render deployment. Follow these steps:

### 1. Push to GitHub
Make sure your code is pushed to GitHub:
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Deploy on Render
1. Go to [render.com](https://render.com)
2. Sign up/Login with your GitHub account
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Select your repository: `Athrv-DxT/QR-Attendance-System`
6. Configure the service:
   - **Name**: `qr-attendance-system`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
7. Set environment variables:
   - `SECRET_KEY`: Your secret key
   - `EMAIL_USER`: Your Gmail address
   - `EMAIL_PASSWORD`: Your Gmail app password
   - `SMTP_SERVER`: `smtp.gmail.com`
   - `SMTP_PORT`: `587`
   - 
   
8. Click "Create Web Service"

### 3. Your app will be available at:
`https://your-app-name.onrender.com`

## Usage

### For Administrators

1. **Add Participants**: Upload an Excel file with participant information
2. **Generate QR Codes**: Create QR codes for events/sessions
3. **View Reports**: Export attendance data to Excel

### For Participants

1. **Scan QR Code**: Use the web interface to scan QR codes
2. **Mark Attendance**: Automatically mark attendance when QR code is scanned

## Project Structure

```
QR-Attendance-System/
├── app.py                 # Main Flask application
├── database.py            # Database initialization
├── utils.py               # Utility functions
├── requirements.txt       # Python dependencies
├── render.yaml           # Render deployment config
├── procfile              # Process file for deployment
├── .env                  # Environment variables (not in git)
├── .gitignore            # Git ignore rules
├── static/               # Static files (CSS, JS, QR codes)
├── templates/            # HTML templates
├── instance/             # Database files (not in git)
├── uploads/              # Uploaded files (not in git)
└── README.md             # This file
```

## Security Notes

- **Never commit** your `.env` file
- **Never commit** database files
- **Never commit** uploaded files or generated QR codes
- Use strong, unique secret keys in production
- Enable HTTPS in production (Render provides this automatically)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.
