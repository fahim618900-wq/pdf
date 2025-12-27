// Face Attendance System - Complete JavaScript Code
// No model download needed - uses CDN

// Global variables
let registrationDescriptors = [];
let capturedPhotos = [];
let isAttendanceRunning = false;
let attendanceInterval = null;
let modelsLoaded = false;

// বাংলা মাসের নাম
const banglaMonths = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

// বাংলা দিনের নাম
const banglaDays = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

// ডেটা স্টোরেজ ক্লাস
class AttendanceStorage {
    constructor() {
        this.studentsKey = 'face_attendance_students';
        this.attendanceKey = 'face_attendance_records';
        this.settingsKey = 'face_attendance_settings';
    }

    // ছাত্র সংরক্ষণ
    saveStudent(student) {
        const students = this.getAllStudents();
        students.push(student);
        localStorage.setItem(this.studentsKey, JSON.stringify(students));
        return student.id;
    }

    // সকল ছাত্র পাওয়া
    getAllStudents() {
        const data = localStorage.getItem(this.studentsKey);
        return data ? JSON.parse(data) : [];
    }

    // আইডি দিয়ে ছাত্র খোঁজা
    getStudentById(id) {
        const students = this.getAllStudents();
        return students.find(student => student.id === id);
    }

    // হাজিরা সংরক্ষণ
    saveAttendanceRecord(record) {
        const records = this.getAllAttendance();
        
        // চেক করুন আজকে এই ছাত্রের হাজিরা ইতিমধ্যে দেওয়া হয়েছে কিনা
        const today = this.getTodayDateString();
        const alreadyMarked = records.some(r => 
            r.studentId === record.studentId && r.date === today
        );
        
        if (!alreadyMarked) {
            records.push(record);
            localStorage.setItem(this.attendanceKey, JSON.stringify(records));
            return true;
        }
        return false;
    }

    // সকল হাজিরা রেকর্ড
    getAllAttendance() {
        const data = localStorage.getItem(this.attendanceKey);
        return data ? JSON.parse(data) : [];
    }

    // তারিখ অনুযায়ী হাজিরা রেকর্ড
    getAttendanceByDate(date) {
        const records = this.getAllAttendance();
        return records.filter(record => record.date === date);
    }

    // আজকের হাজিরা রেকর্ড
    getTodayAttendance() {
        const today = this.getTodayDateString();
        return this.getAttendanceByDate(today);
    }

    // ছাত্রের হাজিরা হিস্ট্রি
    getStudentAttendance(studentId) {
        const records = this.getAllAttendance();
        return records.filter(record => record.studentId === studentId);
    }

    // তারিখ স্ট্রিং ফরম্যাট
    getTodayDateString() {
        const today = new Date();
        return today.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    // বাংলা তারিখ ফরম্যাট
    getBanglaDateString(dateStr) {
        const date = dateStr ? new Date(dateStr) : new Date();
        const day = date.getDate();
        const month = banglaMonths[date.getMonth()];
        const year = date.getFullYear();
        const dayName = banglaDays[date.getDay()];
        
        return `${day} ${month} ${year}, ${dayName}`;
    }

    // ডেটা ব্যাকআপ
    backupData() {
        const data = {
            students: this.getAllStudents(),
            attendance: this.getAllAttendance(),
            backupDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_backup_${this.getTodayDateString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return true;
    }

    // ডেটা রিস্টোর
    restoreData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (data.students && data.attendance) {
                localStorage.setItem(this.studentsKey, JSON.stringify(data.students));
                localStorage.setItem(this.attendanceKey, JSON.stringify(data.attendance));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Restore error:', error);
            return false;
        }
    }

    // ডেটা ক্লিয়ার
    clearAllData() {
        localStorage.removeItem(this.studentsKey);
        localStorage.removeItem(this.attendanceKey);
        return true;
    }

    // স্টোরেজ ব্যবহার
    getStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length * 2; // UTF-16 characters are 2 bytes
            }
        }
        return total;
    }
}

// ফেস ডিটেকশন ক্লাস
class FaceDetection {
    constructor() {
        this.storage = new AttendanceStorage();
        this.modelsLoaded = false;
    }

    // মডেল লোড করা
    async loadModels() {
        try {
            // CDN থেকে মডেল লোড করা হচ্ছে
            // কোন আলাদা ডাউনলোডের প্রয়োজন নেই
            await faceapi.nets.ssdMobilenetv1.loadFromUri(
                'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
            );
            await faceapi.nets.faceLandmark68Net.loadFromUri(
                'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
            );
            await faceapi.nets.faceRecognitionNet.loadFromUri(
                'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
            );
            
            this.modelsLoaded = true;
            console.log('Face models loaded successfully from CDN');
            return true;
        } catch (error) {
            console.error('Error loading face models:', error);
            
            // বিকল্প পদ্ধতি
            try {
                // সরাসরি CDN থেকে লোড করার চেষ্টা
                await faceapi.loadSsdMobilenetv1Model('/');
                await faceapi.loadFaceLandmarkModel('/');
                await faceapi.loadFaceRecognitionModel('/');
                
                this.modelsLoaded = true;
                console.log('Models loaded with alternative method');
                return true;
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
                return false;
            }
        }
    }

    // ক্যামেরা শুরু করা
    async startCamera(videoElement, width = 640, height = 480) {
        try {
            const constraints = {
                video: {
                    width: { ideal: width },
                    height: { ideal: height },
                    facingMode: 'user'
                },
                audio: false
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = stream;
            
            // ভিডিও লোড হওয়ার অপেক্ষা
            return new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    videoElement.play();
                    resolve(true);
                };
            });
        } catch (error) {
            console.error('Camera error:', error);
            
            // Demo video as fallback for development
            if (error.name === 'NotFoundError' || error.name === 'NotAllowedError') {
                alert('ক্যামেরা অ্যাক্সেস দেওয়া হয়নি। ডেমো মোডে চালানো হচ্ছে।');
                // একটি placeholder সেট করুন
                videoElement.style.backgroundColor = '#333';
                videoElement.innerHTML = '<div class="text-white text-center p-5"><i class="fas fa-camera-slash fa-3x"></i><p>ক্যামেরা নেই</p></div>';
                return true;
            }
            
            return false;
        }
    }

    // ক্যামেরা বন্ধ করা
    stopCamera(videoElement) {
        if (videoElement.srcObject) {
            const tracks = videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoElement.srcObject = null;
        }
    }

    // ফেস ডিটেক্ট করা
    async detectFace(videoElement) {
        if (!this.modelsLoaded) {
            await this.loadModels();
        }
        
        try {
            const detection = await faceapi
                .detectSingleFace(videoElement)
                .withFaceLandmarks()
                .withFaceDescriptor();
            
            return detection;
        } catch (error) {
            console.error('Face detection error:', error);
            return null;
        }
    }

    // ফেস ডিস্ক্রিপ্টর পাওয়া
    async getFaceDescriptor(videoElement) {
        const detection = await this.detectFace(videoElement);
        return detection ? detection.descriptor : null;
    }

    // ছাত্র খোঁজা
    async recognizeStudent(videoElement) {
        const currentDescriptor = await this.getFaceDescriptor(videoElement);
        
        if (!currentDescriptor) {
            return { found: false, message: 'কোনো মুখ চিহ্নিত করা যায়নি' };
        }
        
        const students = this.storage.getAllStudents();
        let bestMatch = null;
        let minDistance = 0.5; // থ্রেশহোল্ড
        
        for (const student of students) {
            for (const storedDescriptor of student.descriptors) {
                // Array to Float32Array কনভার্ট করা
                const storedDescArray = new Float32Array(storedDescriptor);
                const distance = faceapi.euclideanDistance(currentDescriptor, storedDescArray);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = student;
                }
            }
        }
        
        if (bestMatch) {
            return {
                found: true,
                student: bestMatch,
                confidence: (1 - minDistance) * 100
            };
        }
        
        return { found: false, message: 'কোনো মিল পাওয়া যায়নি' };
    }

    // একাধিক ছবি থেকে ফেস ডিস্ক্রিপ্টর তৈরি
    async createFaceDescriptors(videoElement, count = 5) {
        const descriptors = [];
        
        for (let i = 0; i < count; i++) {
            const descriptor = await this.getFaceDescriptor(videoElement);
            if (descriptor) {
                descriptors.push(Array.from(descriptor)); // Float32Array to regular array
                
                // প্রতিটি ছবির মধ্যে বিরতি
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        return descriptors.length > 0 ? descriptors : null;
    }
}

// UI ম্যানেজমেন্ট ক্লাস
class UIManager {
    constructor() {
        this.storage = new AttendanceStorage();
        this.faceDetector = new FaceDetection();
        this.initEventListeners();
        this.updateUI();
    }

    // ইভেন্ট লিসেনার সেটআপ
    initEventListeners() {
        // রেজিস্ট্রেশন ক্যামেরা শুরু
        document.getElementById('startRegistrationCamera').addEventListener('click', () => {
            this.startRegistrationCamera();
        });

        // ছবি তোলা
        document.getElementById('capturePhoto').addEventListener('click', () => {
            this.captureRegistrationPhoto();
        });

        // ছাত্র রেজিস্টার
        document.getElementById('registerStudentBtn').addEventListener('click', () => {
            this.registerStudent();
        });

        // হাজিরা শুরু
        document.getElementById('startAttendanceBtn').addEventListener('click', () => {
            this.startAttendance();
        });

        // হাজিরা বন্ধ
        document.getElementById('stopAttendanceBtn').addEventListener('click', () => {
            this.stopAttendance();
        });

        // ম্যানুয়াল মার্ক
        document.getElementById('manualMarkBtn').addEventListener('click', () => {
            this.showManualMarkModal();
        });

        // সব ছাত্র দেখুন
        document.getElementById('viewAllStudents').addEventListener('click', () => {
            this.showAllStudentsModal();
        });

        // রিপোর্ট তৈরি
        document.getElementById('generateReportBtn').addEventListener('click', () => {
            this.generateReport();
        });

        // ডেটা ব্যাকআপ
        document.getElementById('backupDataBtn').addEventListener('click', () => {
            this.backupData();
        });

        // ডেটা রিস্টোর
        document.getElementById('restoreDataBtn').addEventListener('click', () => {
            this.restoreData();
        });

        // CSV এক্সপোর্ট
        document.getElementById('exportTodayBtn').addEventListener('click', () => {
            this.exportTodayCSV();
        });

        document.getElementById('exportAllBtn').addEventListener('click', () => {
            this.exportAllCSV();
        });

        // আজকের হাজিরা ক্লিয়ার
        document.getElementById('clearTodayBtn').addEventListener('click', () => {
            this.clearTodayAttendance();
        });

        // সব ডেটা ক্লিয়ার
        document.getElementById('clearAllDataBtn').addEventListener('click', () => {
            this.clearAllData();
        });

        // ম্যানুয়াল মার্ক কনফার্ম
        document.getElementById('confirmManualMark').addEventListener('click', () => {
            this.markManualAttendance();
        });

        // তারিখ সেট করা
        document.getElementById('reportDate').value = this.storage.getTodayDateString();
        document.getElementById('todayDate').textContent = this.storage.getBanglaDateString();
    }

    // রেজিস্ট্রেশন ক্যামেরা শুরু
    async startRegistrationCamera() {
        const video = document.getElementById('registrationVideo');
        const startBtn = document.getElementById('startRegistrationCamera');
        const captureBtn = document.getElementById('capturePhoto');
        
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> লোড হচ্ছে...';
        
        // ফেস মডেল লোড করা
        const modelsLoaded = await this.faceDetector.loadModels();
        
        if (modelsLoaded) {
            const cameraStarted = await this.faceDetector.startCamera(video);
            
            if (cameraStarted) {
                startBtn.style.display = 'none';
                captureBtn.disabled = false;
                this.showAlert('ক্যামেরা চালু হয়েছে! এখন ছবি তোলা শুরু করুন।', 'success');
            } else {
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fas fa-camera"></i> ক্যামেরা চালু করুন';
                this.showAlert('ক্যামেরা চালু করতে সমস্যা হচ্ছে।', 'danger');
            }
        } else {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-camera"></i> ক্যামেরা চালু করুন';
            this.showAlert('ফেস মডেল লোড করতে সমস্যা হচ্ছে। ইন্টারনেট সংযোগ চেক করুন।', 'danger');
        }
    }

    // রেজিস্ট্রেশন ছবি তোলা
    async captureRegistrationPhoto() {
        const video = document.getElementById('registrationVideo');
        const captureBtn = document.getElementById('capturePhoto');
        const registerBtn = document.getElementById('registerStudentBtn');
        const previewDiv = document.getElementById('photoPreview');
        const photoCount = document.getElementById('photoCount');
        const progressBar = document.getElementById('photoProgress');
        
        captureBtn.disabled = true;
        captureBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> প্রক্রিয়াধীন...';
        
        // ছবি ক্যাপচ
