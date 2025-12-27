// app.js - Main Application Logic

// Global Variables
let studentDescriptors = [];
let currentStudent = null;
let isAttendanceRunning = false;
let attendanceInterval = null;

// Initialize FaceAPI Models
async function loadFaceModels() {
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        console.log('Face models loaded successfully');
    } catch (error) {
        console.error('Error loading models:', error);
        alert('মডেল লোড করতে সমস্যা হচ্ছে। ইন্টারনেট চেক করুন।');
    }
}

// LocalStorage Functions
const Storage = {
    // Save students to localStorage
    saveStudents(students) {
        localStorage.setItem('attendance_app_students', JSON.stringify(students));
    },

    // Get all students from localStorage
    getStudents() {
        const students = localStorage.getItem('attendance_app_students');
        return students ? JSON.parse(students) : [];
    },

    // Save attendance record
    saveAttendance(record) {
        let attendance = this.getAttendance();
        attendance.push(record);
        localStorage.setItem('attendance_app_attendance', JSON.stringify(attendance));
    },

    // Get all attendance records
    getAttendance() {
        const attendance = localStorage.getItem('attendance_app_attendance');
        return attendance ? JSON.parse(attendance) : [];
    },

    // Get today's attendance
    getTodayAttendance() {
        const today = new Date().toISOString().split('T')[0];
        const allAttendance = this.getAttendance();
        return allAttendance.filter(record => record.date === today);
    },

    // Get student by ID
    getStudentById(id) {
        const students = this.getStudents();
        return students.find(student => student.id === id);
    }
};

// Camera Functions
async function startCamera(videoElement) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        videoElement.srcObject = stream;
        return true;
    } catch (error) {
        console.error('Camera error:', error);
        alert('ক্যামেরা অ্যাক্সেস করতে সমস্যা হচ্ছে।');
        return false;
    }
}

// Face Detection Functions
async function getFaceDescriptor(videoElement) {
    try {
        const detection = await faceapi
            .detectSingleFace(videoElement)
            .withFaceLandmarks()
            .withFaceDescriptor();
        
        return detection ? detection.descriptor : null;
    } catch (error) {
        console.error('Face detection error:', error);
        return null;
    }
}

// Student Registration
document.addEventListener('DOMContentLoaded', async function() {
    // Load face models
    await loadFaceModels();

    // Tab switching
    document.querySelectorAll('.nav-link').forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            this.classList.add('active');
            const target = this.getAttribute('href');
            document.querySelector(target).classList.add('active');
        });
    });

    // Registration Tab - Start Camera
    document.getElementById('startCamera').addEventListener('click', function() {
        startCamera(document.getElementById('video'));
        studentDescriptors = [];
        document.getElementById('capturedPhotos').innerHTML = '';
    });

    // Capture Photo for Registration
    document.getElementById('capture').addEventListener('click', async function() {
        if (studentDescriptors.length >= 5) {
            alert('৫টি ছবি already নেওয়া হয়েছে');
            return;
        }

        const video = document.getElementById('video');
        const descriptor = await getFaceDescriptor(video);
        
        if (descriptor) {
            studentDescriptors.push(Array.from(descriptor)); // Convert Float32Array to regular array
            
            // Show captured photo preview
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 120;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, 160, 120);
            
            document.getElementById('capturedPhotos').appendChild(canvas);
            
            alert(`ছবি ${studentDescriptors.length}/৫ নেওয়া হয়েছে`);
        } else {
            alert('কোনো মুখ চিহ্নিত করা যায়নি!');
        }
    });

    // Register Student
    document.getElementById('registerStudent').addEventListener('click', function() {
        const name = document.getElementById('studentName').value;
        const className = document.getElementById('studentClass').value;
        
        if (!name || !className) {
            alert('নাম এবং ক্লাস পূরণ করুন');
            return;
        }
        
        if (studentDescriptors.length < 3) {
            alert('কমপক্ষে ৩টি ছবি নিন (৫টি ভালো)');
            return;
        }
        
        const student = {
            id: Date.now().toString(),
            name: name,
            class: className,
            descriptors: studentDescriptors,
            registrationDate: new Date().toISOString()
        };
        
        const students = Storage.getStudents();
        students.push(student);
        Storage.saveStudents(students);
        
        alert(`${name} সফলভাবে রেজিস্টার্ড হয়েছে!`);
        loadRegisteredStudents();
        
        // Reset form
        document.getElementById('studentName').value = '';
        studentDescriptors = [];
        document.getElementById('capturedPhotos').innerHTML = '';
    });

    // Attendance Tab - Start Attendance
    document.getElementById('startAttendance').addEventListener('click', async function() {
        const video = document.getElementById('attendanceVideo');
        const started = await startCamera(video);
        
        if (started) {
            isAttendanceRunning = true;
            attendanceInterval = setInterval(async () => {
                await processAttendance(video);
            }, 3000); // Check every 3 seconds
        }
    });

    // Stop Attendance
    document.getElementById('stopAttendance').addEventListener('click', function() {
        isAttendanceRunning = false;
        if (attendanceInterval) {
            clearInterval(attendanceInterval);
        }
        const video = document.getElementById('attendanceVideo');
        video.srcObject.getTracks().forEach(track => track.stop());
    });

    // Export CSV
    document.getElementById('exportCSV').addEventListener('click', function() {
        exportToCSV();
    });

    // Load initial data
    loadRegisteredStudents();
    loadTodayAttendance();
});

// Process Attendance
async function processAttendance(video) {
    if (!isAttendanceRunning) return;
    
    const currentDescriptor = await getFaceDescriptor(video);
    if (!currentDescriptor) return;
    
    const students = Storage.getStudents();
    let bestMatch = null;
    let minDistance = 0.5; // Similarity threshold (lower = more strict)
    
    // Compare with all registered students
    students.forEach(student => {
        student.descriptors.forEach(desc => {
            // Convert stored array back to Float32Array for comparison
            const storedDescriptor = new Float32Array(desc);
            const distance = faceapi.euclideanDistance(currentDescriptor, storedDescriptor);
            
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = student;
            }
        });
    });
    
    if (bestMatch) {
        // Check if already marked today
        const today = new Date().toISOString().split('T')[0];
        const todayAttendance = Storage.getTodayAttendance();
        const alreadyMarked = todayAttendance.some(record => record.studentId === bestMatch.id);
        
        if (!alreadyMarked) {
            // Mark attendance
            const now = new Date();
            const attendanceRecord = {
                studentId: bestMatch.id,
                name: bestMatch.name,
                class: bestMatch.class,
                date: today,
                time: now.toLocaleTimeString('bn-BD'),
                day: getDayInBangla(now.getDay()),
                status: 'present',
                timestamp: now.getTime()
            };
            
            Storage.saveAttendance(attendanceRecord);
            
            // Show notification
            showNotification(`${bestMatch.name} - হাজিরা নেওয়া হয়েছে!`);
            
            // Update UI
            loadTodayAttendance();
        }
    } else {
        console.log('No match found');
    }
}

// Helper Functions
function getDayInBangla(dayIndex) {
    const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    return days[dayIndex];
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'alert alert-success alert-dismissible fade show';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container').prepend(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

function loadRegisteredStudents() {
    const students = Storage.getStudents();
    const container = document.getElementById('registeredStudents');
    
    if (students.length === 0) {
        container.innerHTML = '<p class="text-muted">কোনো ছাত্র রেজিস্টার্ড নেই</p>';
        return;
    }
    
    let html = '<table class="table table-sm"><thead><tr><th>নাম</th><th>ক্লাস</th><th>রেজি. তারিখ</th></tr></thead><tbody>';
    
    students.forEach(student => {
        const date = new Date(student.registrationDate).toLocaleDateString('bn-BD');
        html += `<tr>
            <td>${student.name}</td>
            <td>${student.class}</td>
            <td>${date}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function loadTodayAttendance() {
    const attendance = Storage.getTodayAttendance();
    const container = document.getElementById('todayAttendance');
    
    if (attendance.length === 0) {
        container.innerHTML = '<p class="text-muted">আজকে এখনো হাজিরা নেওয়া হয়নি</p>';
        return;
    }
    
    let html = '<table class="table table-sm table-success"><thead><tr><th>নাম</th><th>ক্লাস</th><th>সময়</th></tr></thead><tbody>';
    
    attendance.forEach(record => {
        html += `<tr>
            <td>${record.name}</td>
            <td>${record.class}</td>
            <td>${record.time}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function exportToCSV() {
    const attendance = Storage.getAttendance();
    if (attendance.length === 0) {
        alert('কোনো ডেটা নেই');
        return;
    }
    
    let csv = 'নাম,ক্লাস,তারিখ,দিন,সময়,স্ট্যাটাস\n';
    
    attendance.forEach(record => {
        csv += `"${record.name}","${record.class}","${record.date}","${record.day}","${record.time}","${record.status}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// Load models when page loads
window.onload = loadFaceModels;
