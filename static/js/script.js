// QR Scanner functionality using Html5Qrcode
let scanner = null;
let isScanning = false;
let preferredDeviceId = null;
let currentTrack = null;

// Initialize QR Scanner using Html5Qrcode
function initQRScanner() {
    console.log('Initializing Html5Qrcode Scanner...');
    
    // Load Html5Qrcode library first
    loadHtml5Qrcode().then(() => {
        startHtml5QrcodeScanner();
    }).catch(error => {
        console.error('Failed to load Html5Qrcode:', error);
        showScanResult('Failed to load QR scanner. Please refresh the page.', false);
    });
}

// Load Html5Qrcode library
function loadHtml5Qrcode() {
    return new Promise((resolve, reject) => {
        if (window.Html5Qrcode) {
            resolve(window.Html5Qrcode);
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
        script.onload = () => resolve(window.Html5Qrcode);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Start Html5Qrcode scanner
function startHtml5QrcodeScanner() {
    const scannerContainer = document.getElementById('scanner-container');
    if (!scannerContainer) {
        console.error('Scanner container not found');
        return;
    }
    
    // Create scanner element
    const scannerElement = document.createElement('div');
    scannerElement.id = 'html5-qrcode-scanner';
    scannerContainer.insertBefore(scannerElement, scannerContainer.firstChild);
    
    // Initialize scanner
    scanner = new Html5Qrcode("html5-qrcode-scanner");
    
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };
    
    scanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
            console.log('QR Code detected instantly:', decodedText);
            handleQRScan(decodedText);
        },
        (error) => {
            // Silent error handling - don't spam console
        }
    ).then(() => {
        console.log('Html5Qrcode scanner started successfully');
        isScanning = true;
        showScanResult('⚡ Instant QR Scanner Ready!', true);
    }).catch(err => {
        console.error('Failed to start scanner:', err);
        showScanResult('Failed to start camera. Please check permissions.', false);
        
        // Show manual input option
        const fallbackDiv = document.createElement('div');
        fallbackDiv.innerHTML = `
            <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; margin-top: 15px;">
                <p>Camera not available. Use manual input instead:</p>
                <button onclick="manualQRInput()" class="btn">Manual QR Input</button>
            </div>
        `;
        scannerContainer.appendChild(fallbackDiv);
    });
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

// Html5Qrcode handles scanning automatically - no need for manual scanning
function startScanning() {
    // Html5Qrcode handles continuous scanning automatically
    // This function is kept for compatibility but does nothing
    console.log('Html5Qrcode is handling scanning automatically');
}

// QR detection function - will be replaced by the real implementation below

function handleQRScan(qrData) {
    if (!qrData) return;
    
    console.log('QR Code detected instantly:', qrData);
    
    // Stop scanning temporarily
    if (scanner && isScanning) {
        scanner.stop().then(() => {
            isScanning = false;
        }).catch(err => {
            console.error('Error stopping scanner:', err);
        });
    }
    
    // Show instant feedback
    showScanResult('✓ QR Detected! Processing...', true);
    
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
            restartCamera();
        }, 2000);
    })
    .catch(err => {
        console.error('Error scanning QR:', err);
        showScanResult('Error processing QR code.', false);
        
        // Resume scanning after 2 seconds
        setTimeout(() => {
            restartCamera();
        }, 2000);
    });
}

// Html5Qrcode handles all QR detection - no need for additional libraries

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

// Html5Qrcode handles all QR detection automatically

// Camera control functions for Html5Qrcode
function stopCamera() {
    if (scanner && isScanning) {
        scanner.stop().then(() => {
            console.log('Scanner stopped');
            isScanning = false;
        }).catch(err => {
            console.error('Error stopping scanner:', err);
        });
    }
}

function restartCamera() {
    stopCamera();
    setTimeout(() => {
        // Clear the scanner container
        const scannerElement = document.getElementById('html5-qrcode-scanner');
        if (scannerElement) {
            scannerElement.remove();
        }
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
    if (!scanner || !isScanning) {
        showScanResult('Scanner not ready. Please wait for camera to initialize.', false);
        return;
    }

    showScanResult('Html5Qrcode is continuously scanning. Just point at QR code!', true);
}
