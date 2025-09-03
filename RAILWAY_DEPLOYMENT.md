# 🚀 Railway Deployment Guide

## 📋 **Prerequisites**
- [Railway Account](https://railway.app/)
- [GitHub Repository](https://github.com/) (your code)
- Gmail App Password (for email functionality)

## 🚀 **Step 1: Connect to Railway**

1. **Go to [Railway.app](https://railway.app/)**
2. **Sign in with GitHub**
3. **Click "New Project"**
4. **Select "Deploy from GitHub repo"**
5. **Choose your QR-Attendance-System repository**

## 🗄️ **Step 2: Add PostgreSQL Database**

1. **In your Railway project, click "New"**
2. **Select "Database" → "PostgreSQL"**
3. **Wait for it to provision**
4. **Copy the `DATABASE_URL` from the "Connect" tab**

## ⚙️ **Step 3: Configure Environment Variables**
Y
1. **Go to your project's "Variables" tab**
2. **Add these variables:**

```bash
# Database (Railway provides this automatically)
DATABASE_URL=postgresql://username:password@host:port/database

# Flask Secret Key (generate a strong one)
SECRET_KEY=your-super-secret-key-here

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
```

## 🔑 **Step 4: Generate Secret Key**

```python
import secrets
print(secrets.token_hex(32))
```

## 📧 **Step 5: Gmail App Password**

1. **Go to [Google Account Settings](https://myaccount.google.com/)**
2. **Security → 2-Step Verification → App passwords**
3. **Generate password for "Mail"**
4. **Use this password in `EMAIL_PASSWORD`**

## 🚀 **Step 6: Deploy**

1. **Railway will automatically detect your Flask app**
2. **It will use the `Procfile` and `requirements.txt`**
3. **Wait for build to complete**
4. **Your app will be available at the provided URL**

## ✅ **What Happens Automatically:**

- **Database**: Railway creates PostgreSQL database
- **Build**: Uses `requirements.txt` to install dependencies
- **Start**: Uses `Procfile` to run `gunicorn app:app`
- **Port**: Uses `PORT` environment variable (usually 5000)
- **Health Check**: Monitors `/` endpoint

## 🔍 **Troubleshooting**

### **Build Fails:**
- Check `requirements.txt` has all dependencies
- Ensure `gunicorn` is in requirements
- Check for syntax errors in Python files

### **App Won't Start:**
- Check environment variables are set
- Verify `DATABASE_URL` is correct
- Check logs in Railway dashboard

### **Database Connection Error:**
- Ensure `DATABASE_URL` is set
- Check if PostgreSQL is running
- Verify database credentials

### **Email Not Working:**
- Check `EMAIL_USER` and `EMAIL_PASSWORD`
- Verify Gmail App Password is correct
- Check SMTP settings

## 🌐 **Access Your App**

- **URL**: Provided by Railway after deployment
- **Health Check**: `https://your-app.railway.app/`
- **Config Check**: `https://your-app.railway.app/config-check`

## 📱 **Mobile Testing**

- **QR Scanner**: Works on HTTPS (Railway provides this)
- **Camera Access**: Requires HTTPS (✅ Railway provides this)
- **Responsive Design**: Already implemented

## 🔄 **Updates**

- **Push to GitHub** → Railway auto-deploys
- **Environment Variables**: Update in Railway dashboard
- **Database**: Managed by Railway

## 💰 **Costs**

- **Free Tier**: Limited but sufficient for testing
- **Paid Plans**: Start at $5/month for production use
- **Database**: Included in project cost

---

## 🎯 **Quick Checklist**

- [ ] Repository connected to Railway
- [ ] PostgreSQL database added
- [ ] Environment variables configured
- [ ] Secret key generated
- [ ] Gmail app password created
- [ ] App deployed successfully
- [ ] Database connection working
- [ ] Email functionality tested
- [ ] QR scanner working on mobile

## 🆘 **Need Help?**

- **Railway Docs**: [docs.railway.app](https://docs.railway.app/)
- **Railway Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Check Logs**: Railway dashboard → your project → Deployments → View logs
