# Email Configuration Setup

## Step 1: Create .env file
Create a file named `.env` in your project root directory with the following content:

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
```

## Step 2: Gmail App Password Setup
1. **Enable 2-Factor Authentication** on your Google account
2. **Generate App Password**: Go to Google Account → Security → App Passwords
3. **Select "Mail"** from the dropdown
4. **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)

## Step 3: Update .env file
Replace the values in your `.env` file:
```env
EMAIL_USER=athrv.24bai10037@vitbhopal.ac.in
EMAIL_PASSWORD=your-16-char-app-password
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
```

## Step 4: Test Configuration
1. **Restart your Flask app** after creating the .env file
2. **Upload participants** through the web interface
3. **Go to Participants page**
4. **Use "Send QR Codes via Email"** section

## Deployment Notes
- **Railway/Heroku**: Set these same environment variables in your deployment platform
- **Local Development**: The .env file will be automatically loaded
- **Security**: Never commit your .env file to version control

## Troubleshooting
- Make sure `.env` file is in the same directory as `app.py`
- Verify App Password is correct (16 characters, no spaces)
- Check that 2FA is enabled on your Google account
