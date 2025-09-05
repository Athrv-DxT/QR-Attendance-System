// QR Scanner functionality
let scanner = null;
let isScanning = false;
let preferredDeviceId = null;
let currentTrack = null;

// Initialize QR Scanner
function initQRScanner() {
    console.log('Initializing QR Scanner...');
    const video = document.getElementById('qr-video');
    const resultDiv = document.getElementById('scan-result');
    
    if (!video) {
        console.error('Video element not found');
        return;
    }
    
    // Check if browser supports getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        console.log('getUserMedia supported, requesting camera access...');
        
        const constraints = {
            video: {
                facingMode: preferredDeviceId ? undefined : { ideal: 'environment' },
                deviceId: preferredDeviceId ? { exact: preferredDeviceId } : undefined,
                width: { ideal: 1920, min: 640 },
                height: { ideal: 1080, min: 480 },
                frameRate: { ideal: 30, min: 15 },
                focusMode: 'continuous',
                whiteBalanceMode: 'continuous',
                exposureMode: 'continuous'
            },
            audio: false
        };
        
        navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            console.log('Camera access granted, starting video stream...');
            video.srcObject = stream;
            video.play();
            
            // Wait for video to be ready
            video.addEventListener('loadedmetadata', () => {
                console.log('Video metadata loaded, starting QR scanning...');
                startScanning();
                // Try to lock to rear camera for devices with multiple cameras
                ensureRearCameraPreferred().catch(() => {});
            });
            
            video.addEventListener('error', (err) => {
                console.error('Video error:', err);
                showScanResult('Video stream error. Please refresh the page.', false);
            });
        })
        .catch(err => {
            console.error('Error accessing camera:', err);
            showScanResult(`Camera error: ${err.name} - ${err.message}`, false);
            
            // Show manual input option
            const scannerContainer = document.getElementById('scanner-container');
            if (scannerContainer) {
                const fallbackDiv = document.createElement('div');
                fallbackDiv.innerHTML = `
                    <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; margin-top: 15px;">
                        <p>Camera not available. Use manual input instead:</p>
                        <button onclick="manualQRInput()" class="btn">Manual QR Input</button>
                    </div>
                `;
                scannerContainer.appendChild(fallbackDiv);
            }
        });
    } else {
        console.error('getUserMedia not supported');
        showScanResult('Camera not supported on this device/browser.', false);
    }
}

async function toggleTorch() {
    try {
        const video = document.getElementById('qr-video');
        const stream = video && video.srcObject;
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        currentTrack = track;
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (!('torch' in capabilities)) {
            showScanResult('Torch not supported on this device.', false);
            return;
        }
        const settings = track.getSettings ? track.getSettings() : {};
        const desired = !settings.torch;
        await track.applyConstraints({ advanced: [{ torch: desired }] });
        showScanResult(`Torch ${desired ? 'enabled' : 'disabled'}.`, true);
    } catch (e) {
        showScanResult('Unable to toggle torch.', false);
    }
}

async function scanFromFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = async () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = await detectQRFromImageData(imageData);
        if (code) {
            handleQRScan(code);
            return;
        }
        const z = await detectQRWithZXing(canvas);
        if (z) {
            handleQRScan(z);
        } else {
            showScanResult('No QR detected in image. Try a clearer picture.', false);
        }
    };
    img.onerror = () => showScanResult('Could not load image.', false);
    img.src = URL.createObjectURL(file);
}

async function ensureRearCameraPreferred() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        // Prefer a device that mentions back/environment
        const rear = videoInputs.find(d => /back|rear|environment/i.test(d.label));
        if (rear && rear.deviceId !== preferredDeviceId) {
            preferredDeviceId = rear.deviceId;
            console.log('Switching to rear camera');
            restartCamera();
        }
    } catch (e) {
        // ignore
    }
}

function startScanning() {
    const video = document.getElementById('qr-video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    isScanning = true;
    let scanCount = 0;
    let lastScanTime = 0;
    
    async function scan() {
        if (!isScanning) return;
        
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth && video.videoHeight) {
            // Throttle scanning to avoid overwhelming the system
            const now = Date.now();
            if (now - lastScanTime < 100) { // Scan every 100ms max
                requestAnimationFrame(scan);
                return;
            }
            lastScanTime = now;
            
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Try jsQR first
            try {
                const qrResult = await detectQRFromImageData(imageData);
                if (qrResult) {
                    console.log('QR detected on scan attempt:', scanCount);
                    handleQRScan(qrResult);
                    return;
                }
            } catch (error) {
                console.log('jsQR scan error:', error);
            }
            
            // Fallback to ZXing if jsQR fails to detect repeatedly
            try {
                const zxingResult = await detectQRWithZXing(canvas);
                if (zxingResult) {
                    console.log('QR detected with ZXing on scan attempt:', scanCount);
                    handleQRScan(zxingResult);
                    return;
                }
            } catch (error) {
                console.log('ZXing scan error:', error);
            }
            
            scanCount++;
            
            // Show periodic status updates
            if (scanCount % 50 === 0) {
                console.log('Scanning... attempt', scanCount, 'Video size:', video.videoWidth, 'x', video.videoHeight);
            }
        }
        
        requestAnimationFrame(scan);
    }
    
    scan();
}

// QR detection function - will be replaced by the real implementation below

function handleQRScan(qrData) {
    if (!qrData) return;
    
    isScanning = false;
    
    fetch('/scan-qr', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qr_data: qrData })
    })
    .then(response => response.json())
    .then(data => {
        showScanResult(data.message, data.success);
        if (data.success && data.participant) {
            updateAttendanceList(data.participant);
        }
        
        // Resume scanning after 2 seconds
        setTimeout(() => {
            isScanning = true;
            startScanning();
        }, 2000);
    })
    .catch(err => {
        console.error('Error scanning QR:', err);
        showScanResult('Error processing QR code.', false);
        
        // Resume scanning after 2 seconds
        setTimeout(() => {
            isScanning = true;
            startScanning();
        }, 2000);
    });
}

// Load jsQR
function loadJsQR() {
    return new Promise((resolve, reject) => {
        if (window.jsQR) {
            resolve(window.jsQR);
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js';
        script.onload = () => resolve(window.jsQR);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Load ZXing
function loadZXing() {
    return new Promise((resolve, reject) => {
        if (window.ZXing && window.ZXing.BrowserMultiFormatReader) {
            resolve(window.ZXing);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js';
        script.onload = () => resolve(window.ZXing);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Improved QR detection with jsQR
async function detectQRFromImageData(imageData) {
    try {
        const jsQR = await loadJsQR();
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
        });
        if (code && code.data) {
            console.log('jsQR detected:', code.data);
            return code.data;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// ZXing fallback detection using canvas image
async function detectQRWithZXing(canvas) {
    try {
        console.log('Loading ZXing library...');
        const ZXing = await loadZXing();
        if (!ZXing || !ZXing.BrowserMultiFormatReader) {
            console.error('ZXing library not available');
            return null;
        }
        
        const reader = new ZXing.BrowserMultiFormatReader();
        
        // Try multiple detection attempts
        const attempts = [
            () => reader.decodeFromCanvas(canvas),
            () => reader.decodeFromImageData(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height))
        ];
        
        for (const attempt of attempts) {
            try {
                const result = await attempt();
                if (result && result.text) {
                    console.log('ZXing detected:', result.text);
                    return result.text;
                }
            } catch (e) {
                console.log('ZXing attempt failed:', e.message);
            }
        }
        
        console.log('No QR code detected with ZXing');
        return null;
    } catch (e) {
        console.error('ZXing detection error:', e);
        return null;
    }
}

function updateAttendanceList(participant) {
    const tbody = document.getElementById('attendance-tbody');
    if (!tbody) return;
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${participant.name}</td>
        <td>${participant.email}</td>
        <td>${participant.entry_time}</td>
    `;
    tbody.insertBefore(row, tbody.firstChild);
}

// System reset functionality
function resetSystem() {
    if (!confirm('Are you sure you want to reset the entire system? This will delete all participants and attendance records.')) {
        return;
    }
    
    showLoading(true);
    
    fetch('/reset-system', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        showLoading(false);
        alert(data.message);
        if (data.success) {
            location.reload();
        }
    })
    .catch(err => {
        showLoading(false);
        console.error('Error resetting system:', err);
        alert('Error resetting system. Please try again.');
    });
}

// Utility functions
function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = show ? 'block' : 'none';
    }
}

// Manual QR input for testing
function manualQRInput() {
    const qrData = prompt('Enter QR code data for testing:\n\nExamples:\n• PARTICIPANT_ID:1\n• PARTICIPANT_ID:2\n• Or any valid participant ID');
    if (qrData && qrData.trim()) {
        console.log('Manual QR input:', qrData.trim());
        showScanResult('Processing manual QR input...', true);
        handleQRScan(qrData.trim());
    } else if (qrData !== null) {
        showScanResult('Please enter valid QR code data.', false);
    }
}

// Test with sample QR code
function testQRCode() {
    // Test with a sample participant ID
    const testQRData = 'PARTICIPANT_ID:1';
    console.log('Testing with sample QR data:', testQRData);
    showScanResult('Testing with sample QR code...', true);
    handleQRScan(testQRData);
}

// Generate a test QR code for debugging
function generateTestQR() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 200;
    
    // Simple QR code pattern for testing
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = '#fff';
    ctx.fillRect(20, 20, 160, 160);
    ctx.fillStyle = '#000';
    ctx.fillRect(40, 40, 120, 120);
    ctx.fillStyle = '#fff';
    ctx.fillRect(60, 60, 80, 80);
    ctx.fillStyle = '#000';
    ctx.fillRect(80, 80, 40, 40);
    
    // Add text
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.fillText('TEST QR', 70, 190);
    
    return canvas;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize QR scanner if on scan page
    if (document.getElementById('qr-video')) {
        initQRScanner();
    }
    
    // Load attendance list if on a page with attendance table
    if (document.getElementById('attendance-tbody')) {
        loadAttendanceList();
        
        // Refresh attendance list every 30 seconds
        setInterval(loadAttendanceList, 30000);
    }
    
    // Handle form submissions
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            const fileInput = document.getElementById('excel-file');
            if (!fileInput.files.length) {
                e.preventDefault();
                alert('Please select a file to upload.');
                return;
            }
            
            const file = fileInput.files[0];
            if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
                e.preventDefault();
                alert('Please select a valid Excel file (.xlsx or .xls).');
                return;
            }
        });
    }
});

// File upload preview
function previewFile() {
    const fileInput = document.getElementById('excel-file');
    const fileInfo = document.getElementById('file-info');
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileSize = (file.size / 1024 / 1024).toFixed(2);
        fileInfo.innerHTML = `
            <p><strong>Selected file:</strong> ${file.name}</p>
            <p><strong>Size:</strong> ${fileSize} MB</p>
            <p><strong>Type:</strong> ${file.type}</p>
        `;
        fileInfo.style.display = 'block';
    } else {
        fileInfo.style.display = 'none';
    }
}

// Enhanced QR Scanner with jsQR library fallback
function loadJsQR() {
    return new Promise((resolve, reject) => {
        if (window.jsQR) {
            resolve(window.jsQR);
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js';
        script.onload = () => resolve(window.jsQR);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Improved QR detection function
async function detectQRFromImageData(imageData) {
    try {
        console.log('Loading jsQR library...');
        const jsQR = await loadJsQR();
        console.log('jsQR library loaded, detecting QR code...');
        
        // Try multiple detection attempts with different parameters
        const detectionOptions = [
            { inversionAttempts: "dontInvert" },
            { inversionAttempts: "attemptBoth" },
            { inversionAttempts: "invertFirst" },
            { inversionAttempts: "dontInvert", greyScaleWeights: { red: 0.299, green: 0.587, blue: 0.114 } }
        ];
        
        for (const options of detectionOptions) {
            const code = jsQR(imageData.data, imageData.width, imageData.height, options);
            if (code && code.data) {
                console.log('QR code detected with options:', options, 'Data:', code.data);
                return code.data;
            }
        }
        
        console.log('No QR code detected with jsQR');
        return null;
    } catch (error) {
        console.error('jsQR detection error:', error);
        return null;
    }
}

// Camera control functions
function stopCamera() {
    const video = document.getElementById('qr-video');
    if (video && video.srcObject) {
        const stream = video.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    isScanning = false;
}

function restartCamera() {
    stopCamera();
    setTimeout(() => {
        initQRScanner();
    }, 500);
}

// Enhanced error handling
function handleCameraError(error) {
    let message = 'Camera access error: ';
    
    switch(error.name) {
        case 'NotAllowedError':
            message += 'Camera permission denied. Please allow camera access and refresh the page.';
            break;
        case 'NotFoundError':
            message += 'No camera found on this device.';
            break;
        case 'NotReadableError':
            message += 'Camera is being used by another application.';
            break;
        case 'OverconstrainedError':
            message += 'Camera constraints could not be satisfied.';
            break;
        case 'SecurityError':
            message += 'Camera access blocked due to security settings.';
            break;
        default:
            message += error.message || 'Unknown camera error occurred.';
    }
    
    showScanResult(message, false);
    
    // Show manual input option
    const scannerContainer = document.getElementById('scanner-container');
    if (scannerContainer) {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.innerHTML = `
            <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; margin-top: 15px;">
                <p>Camera not available. Use manual input instead:</p>
                <button onclick="manualQRInput()" class="btn">Manual QR Input</button>
            </div>
        `;
        scannerContainer.appendChild(fallbackDiv);
    }
}

// Batch email sending with progress
function sendEmailsWithProgress() {
    const messageInput = document.getElementById('email-message');
    const message = messageInput ? messageInput.value.trim() : '';
    
    if (!message) {
        alert('Please enter an email message.');
        return;
    }
    
    // Show progress
    const progressDiv = document.createElement('div');
    progressDiv.id = 'email-progress';
    progressDiv.innerHTML = `
        <div style="margin-top: 15px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
            <p>Sending emails...</p>
            <div style="background: #ddd; border-radius: 4px; height: 20px;">
                <div id="progress-bar" style="background: #007bff; height: 100%; width: 0%; border-radius: 4px; transition: width 0.3s;"></div>
            </div>
            <p id="progress-text">Preparing to send...</p>
        </div>
    `;
    
    const emailSection = document.querySelector('.email-section');
    if (emailSection) {
        emailSection.appendChild(progressDiv);
    }
    
    showLoading(true);
    
    fetch('/send-emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message })
    })
    .then(response => response.json())
    .then(data => {
        showLoading(false);
        
        const progressDiv = document.getElementById('email-progress');
        if (progressDiv) {
            progressDiv.remove();
        }
        
        if (data.success) {
            showNotification(data.message, 'success');
            setTimeout(() => {
                location.reload();
            }, 2000);
        } else {
            showNotification(data.message, 'error');
        }
    })
    .catch(err => {
        showLoading(false);
        console.error('Error sending emails:', err);
        
        const progressDiv = document.getElementById('email-progress');
        if (progressDiv) {
            progressDiv.remove();
        }
        
        showNotification('Error sending emails. Please try again.', 'error');
    });
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification alert alert-${type === 'success' ? 'success' : 'error'}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        max-width: 400px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
    
    // Click to remove
    notification.addEventListener('click', () => {
        notification.remove();
    });
}

// Download functionality with error handling
function downloadAttendance() {
    showLoading(true);
    
    fetch('/download-attendance')
    .then(response => {
        showLoading(false);
        
        if (!response.ok) {
            throw new Error('Failed to generate attendance report');
        }
        
        // Create download link
        return response.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Attendance report downloaded successfully', 'success');
    })
    .catch(err => {
        showLoading(false);
        console.error('Error downloading attendance:', err);
        showNotification('Error downloading attendance report. Please try again.', 'error');
    });
}

// Real-time attendance updates
function startAttendanceUpdates() {
    if (document.getElementById('attendance-tbody')) {
        // Refresh every 10 seconds instead of 30
        setInterval(() => {
            loadAttendanceList();
        }, 10000);
    }
}

// Export participant data
function exportParticipants() {
    const participants = Array.from(document.querySelectorAll('#participants-table tbody tr')).map(row => {
        const cells = row.querySelectorAll('td');
        return {
            name: cells[0]?.textContent || '',
            email: cells[1]?.textContent || '',
            qr_sent: cells[3]?.textContent?.includes('Sent') || false,
            attendance: cells[4]?.textContent?.includes('Present') || false
        };
    });
    
    if (participants.length === 0) {
        showNotification('No participants to export', 'error');
        return;
    }
    
    const csvContent = "data:text/csv;charset=utf-8," + 
        "Name,Email,QR Code Sent,Attendance Marked\n" +
        participants.map(p => `"${p.name}","${p.email}","${p.qr_sent}","${p.attendance}"`).join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `participants_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Participants exported successfully', 'success');
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + R for refresh attendance (only on scan page)
    if ((e.ctrlKey || e.metaKey) && e.key === 'r' && document.getElementById('qr-video')) {
        e.preventDefault();
        loadAttendanceList();
        showNotification('Attendance list refreshed', 'success');
    }
    
    // Escape to stop camera
    if (e.key === 'Escape' && isScanning) {
        stopCamera();
        showNotification('Camera stopped', 'info');
    }
    
    // Space for manual QR input (only on scan page)
    if (e.key === ' ' && document.getElementById('qr-video')) {
        e.preventDefault();
        manualQRInput();
    }
});

// Touch/mobile optimizations
function optimizeForMobile() {
    // Prevent zoom on input focus for mobile
    if (window.innerWidth <= 768) {
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                if (this.type !== 'file') {
                    this.style.fontSize = '16px';
                }
            });
        });
    }
    
    // Add touch events for better mobile experience
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.95)';
        });
        
        btn.addEventListener('touchend', function() {
            this.style.transform = 'scale(1)';
        });
    });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Mobile optimizations
    optimizeForMobile();
    
    // Initialize QR scanner if on scan page
    if (document.getElementById('qr-video')) {
        initQRScanner();
        
        // Add keyboard shortcut hints
        const hintsDiv = document.createElement('div');
        hintsDiv.innerHTML = `
            <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 12px; color: #666;">
                <strong>Keyboard shortcuts:</strong> 
                Space = Manual input | Escape = Stop camera | Ctrl+R = Refresh attendance
            </div>
        `;
        document.querySelector('.card').appendChild(hintsDiv);
    }
    
    // Load attendance list and start real-time updates
    if (document.getElementById('attendance-tbody')) {
        loadAttendanceList();
        startAttendanceUpdates();
    }
    
    // Enhanced form validation
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            const fileInput = document.getElementById('excel-file');
            
            if (!fileInput.files.length) {
                e.preventDefault();
                showNotification('Please select a file to upload.', 'error');
                return;
            }
            
            const file = fileInput.files[0];
            const maxSize = 16 * 1024 * 1024; // 16MB
            
            if (file.size > maxSize) {
                e.preventDefault();
                showNotification('File size must be less than 16MB.', 'error');
                return;
            }
            
            if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
                e.preventDefault();
                showNotification('Please select a valid Excel file (.xlsx or .xls).', 'error');
                return;
            }
            
            // Show upload progress
            showLoading(true);
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Uploading...';
            }
        });
    }
    
    // Auto-hide flash messages after 5 seconds
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.remove();
                }
            }, 300);
        }, 5000);
    });
    
    // Add version info to footer
    const versionInfo = document.createElement('div');
    versionInfo.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; margin-top: 40px;">
            QR Attendance System v1.0 | Built with Flask & JavaScript
        </div>
    `;
    document.body.appendChild(versionInfo);
});

// Service Worker registration for offline capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        // Only register service worker in production
        if (location.protocol === 'https:') {
            navigator.serviceWorker.register('/static/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful');
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed');
                });
        }
    });
}

function showScanResult(message, isSuccess) {
    const resultDiv = document.getElementById('scan-result');
    if (!resultDiv) return;
    
    resultDiv.className = `scan-result ${isSuccess ? 'scan-success' : 'scan-error'}`;
    resultDiv.innerHTML = message.replace(/\n/g, '<br>'); // Support line breaks
    resultDiv.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        resultDiv.style.display = 'none';
    }, 5000);
}

// Email functionality
function sendEmails() {
    const messageInput = document.getElementById('email-message');
    const message = messageInput ? messageInput.value.trim() : '';
    
    if (!message) {
        alert('Please enter an email message.');
        return;
    }
    
    showLoading(true);
    
    fetch('/send-emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message })
    })
    .then(response => response.json())
    .then(data => {
        showLoading(false);
        alert(data.message);
        if (data.success) {
            location.reload();
        }
    })
    .catch(err => {
        showLoading(false);
        console.error('Error sending emails:', err);
        alert('Error sending emails. Please try again.');
    });
}

// Attendance list functionality
function loadAttendanceList() {
    fetch('/attendance')
    .then(response => response.json())
    .then(data => {
        const tbody = document.getElementById('attendance-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        data.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${record.name}</td>
                <td>${record.email}</td>
                <td>${record.entry_time}</td>
            `;
            tbody.appendChild(row);
        });
    })
    .catch(err => {
                console.error('Error loading attendance list.');
            });
        }

function captureAndScan() {
    const video = document.getElementById('qr-video');
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        showScanResult('Camera not ready. Try again in a moment.', false);
        return;
    }

    showScanResult('Capturing and analyzing frame...', true);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    console.log('Captured frame size:', canvas.width, 'x', canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Try jsQR first
    detectQRFromImageData(imageData)
        .then(code => {
            if (code) {
                console.log('QR detected in captured frame with jsQR');
                handleQRScan(code);
                return;
            }
            // Fallback to ZXing from canvas
            return detectQRWithZXing(canvas).then(z => {
                if (z) {
                    console.log('QR detected in captured frame with ZXing');
                    handleQRScan(z);
                } else {
                    showScanResult('No QR code detected in captured frame. Try:\n• Holding the QR code closer to the camera\n• Ensuring good lighting\n• Keeping the QR code steady\n• Making sure the QR code fills most of the frame', false);
                }
            });
        })
        .catch((error) => {
            console.error('Capture and scan error:', error);
            showScanResult('Scan failed. Please try again or use manual input.', false);
        });
}
