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
        
        // ছবি ক্যাপচার
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 160, 120);
        
        // প্রিভিউতে যোগ করা
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/jpeg');
        img.className = 'preview-img';
        img.alt = `ছবি ${capturedPhotos.length + 1}`;
        
        // পুরানো কন্টেন্ট মুছে ফেলা
        if (capturedPhotos.length === 0) {
            previewDiv.innerHTML = '';
        }
        
        previewDiv.appendChild(img);
        capturedPhotos.push(img.src);
        
        // ফেস ডিটেক্ট করে ডিস্ক্রিপ্টর সংরক্ষণ
        const descriptor = await this.faceDetector.getFaceDescriptor(video);
        
        if (descriptor) {
            registrationDescriptors.push(Array.from(descriptor));
            
            // আপডেট UI
            const currentCount = capturedPhotos.length;
            photoCount.textContent = `${currentCount}টি ছবি তোলা হয়েছে`;
            
            // প্রোগ্রেস বার আপডেট
            const progressPercent = (currentCount / 5) * 100;
            progressBar.style.width = `${progressPercent}%`;
            progressBar.textContent = `${currentCount}/5`;
            
            if (currentCount >= 5) {
                captureBtn.disabled = true;
                captureBtn.innerHTML = '<i class="fas fa-check"></i> ৫টি ছবি সম্পূর্ণ';
                registerBtn.disabled = false;
                this.showAlert('৫টি ছবি সম্পূর্ণ হয়েছে! এখন রেজিস্টার করুন।', 'success');
            } else {
                captureBtn.disabled = false;
                captureBtn.innerHTML = `<i class="fas fa-camera-retro"></i> ছবি নিন (${currentCount}/5)`;
                
                // পরবর্তী ছবির জন্য অপেক্ষা
                setTimeout(() => {
                    captureBtn.disabled = false;
                }, 1000);
            }
        } else {
            capturedPhotos.pop(); // ফেস না পেলে ছবি রিমুভ
            previewDiv.removeChild(img);
            this.showAlert('কোনো মুখ চিহ্নিত করা যায়নি! আবার চেষ্টা করুন।', 'warning');
            captureBtn.disabled = false;
            captureBtn.innerHTML = `<i class="fas fa-camera-retro"></i> ছবি নিন (${capturedPhotos.length}/5)`;
        }
    }

    // ছাত্র রেজিস্টার করা
    async registerStudent() {
        const nameInput = document.getElementById('studentName');
        const rollInput = document.getElementById('studentRoll');
        const classInput = document.getElementById('studentClass');
        const sectionInput = document.getElementById('studentSection');
        const registerBtn = document.getElementById('registerStudentBtn');
        
        const name = nameInput.value.trim();
        const roll = rollInput.value.trim();
        const className = classInput.value;
        const section = sectionInput.value;
        
        if (!name) {
            this.showAlert('ছাত্রের নাম দিন', 'warning');
            return;
        }
        
        if (!roll) {
            this.showAlert('রোল নম্বর দিন', 'warning');
            return;
        }
        
        if (registrationDescriptors.length < 3) {
            this.showAlert('কমপক্ষে ৩টি ছবির ডেটা প্রয়োজন', 'warning');
            return;
        }
        
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> রেজিস্টার হচ্ছে...';
        
        // ছাত্র অবজেক্ট তৈরি
        const student = {
            id: Date.now().toString(),
            name: name,
            roll: roll,
            class: className,
            section: section,
            descriptors: registrationDescriptors,
            photos: capturedPhotos,
            registrationDate: new Date().toISOString()
        };
        
        // লোকাল স্টোরেজে সংরক্ষণ
        const studentId = this.storage.saveStudent(student);
        
        // UI রিসেট
        this.resetRegistrationForm();
        
        // আপডেট UI
        this.updateUI();
        
        this.showAlert(`${name} সফলভাবে রেজিস্টার্ড হয়েছে! (ID: ${studentId})`, 'success');
        
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<i class="fas fa-save"></i> ছাত্র রেজিস্টার করুন';
    }

    // রেজিস্ট্রেশন ফর্ম রিসেট
    resetRegistrationForm() {
        // ফর্ম ফিল্ড ক্লিয়ার
        document.getElementById('studentName').value = '';
        document.getElementById('studentRoll').value = '';
        
        // গ্লোবাল ভ্যারিয়েবল রিসেট
        registrationDescriptors = [];
        capturedPhotos = [];
        
        // UI ক্লিয়ার
        document.getElementById('photoPreview').innerHTML = 
            '<p class="text-muted text-center">ছবি তোলা শুরু করুন...</p>';
        document.getElementById('photoCount').textContent = '0টি ছবি তোলা হয়েছে';
        document.getElementById('photoProgress').style.width = '0%';
        document.getElementById('photoProgress').textContent = '0/5';
        document.getElementById('capturePhoto').innerHTML = '<i class="fas fa-camera-retro"></i> ছবি নিন (0/5)';
        document.getElementById('capturePhoto').disabled = true;
        document.getElementById('registerStudentBtn').disabled = true;
        document.getElementById('startRegistrationCamera').style.display = 'block';
        document.getElementById('startRegistrationCamera').disabled = false;
        document.getElementById('startRegistrationCamera').innerHTML = 
            '<i class="fas fa-camera"></i> ক্যামেরা চালু করুন';
        
        // ক্যামেরা বন্ধ
        const video = document.getElementById('registrationVideo');
        this.faceDetector.stopCamera(video);
    }

    // হাজিরা শুরু করা
    async startAttendance() {
        const video = document.getElementById('attendanceVideo');
        const startBtn = document.getElementById('startAttendanceBtn');
        const stopBtn = document.getElementById('stopAttendanceBtn');
        
        // মডেল লোড করা
        const modelsLoaded = await this.faceDetector.loadModels();
        
        if (!modelsLoaded) {
            this.showAlert('ফেস মডেল লোড করতে সমস্যা হচ্ছে', 'danger');
            return;
        }
        
        // ক্যামেরা শুরু
        const cameraStarted = await this.faceDetector.startCamera(video);
        
        if (!cameraStarted) {
            this.showAlert('ক্যামেরা চালু করতে সমস্যা হচ্ছে', 'danger');
            return;
        }
        
        // বাটন স্টেট চেঞ্জ
        startBtn.disabled = true;
        stopBtn.disabled = false;
        isAttendanceRunning = true;
        
        this.showAlert('হাজিরা শুরু হয়েছে! ক্যামেরার সামনে দাঁড়ান।', 'success');
        
        // ইন্টারভাল সেট করা (প্রতি ৩ সেকেন্ডে চেক করবে)
        attendanceInterval = setInterval(async () => {
            await this.processAttendance();
        }, 3000);
    }

    // হাজিরা বন্ধ করা
    stopAttendance() {
        const video = document.getElementById('attendanceVideo');
        const startBtn = document.getElementById('startAttendanceBtn');
        const stopBtn = document.getElementById('stopAttendanceBtn');
        
        isAttendanceRunning = false;
        
        if (attendanceInterval) {
            clearInterval(attendanceInterval);
            attendanceInterval = null;
        }
        
        this.faceDetector.stopCamera(video);
        
        // বাটন স্টেট চেঞ্জ
        startBtn.disabled = false;
        stopBtn.disabled = true;
        
        this.showAlert('হাজিরা বন্ধ করা হয়েছে।', 'info');
    }

    // হাজিরা প্রসেস
    async processAttendance() {
        if (!isAttendanceRunning) return;
        
        const video = document.getElementById('attendanceVideo');
        
        // ফেস রিকগনাইজ
        const result = await this.faceDetector.recognizeStudent(video);
        
        if (result.found) {
            const student = result.student;
            const confidence = result.confidence.toFixed(1);
            
            // হাজিরা রেকর্ড তৈরি
            const now = new Date();
            const record = {
                studentId: student.id,
                name: student.name,
                roll: student.roll,
                class: student.class,
                section: student.section,
                date: this.storage.getTodayDateString(),
                time: now.toLocaleTimeString('bn-BD'),
                day: banglaDays[now.getDay()],
                confidence: confidence,
                timestamp: now.getTime()
            };
            
            // সংরক্ষণ করুন
            const saved = this.storage.saveAttendanceRecord(record);
            
            if (saved) {
                this.showAlert(`${student.name} - হাজিরা নেওয়া হয়েছে! (${confidence}%)`, 'success');
                this.updateAttendanceList();
            } else {
                this.showAlert(`${student.name} - ইতিমধ্যে আজ হাজিরা দেওয়া হয়েছে`, 'info');
            }
        } else {
            // শুধু ডিবাগিং এর জন্য
            console.log('Recognition result:', result.message);
        }
    }

    // হাজিরা লিস্ট আপডেট
    updateAttendanceList() {
        const container = document.getElementById('todayAttendanceList');
        const attendance = this.storage.getTodayAttendance();
        const countElement = document.getElementById('attendanceCount');
        
        countElement.innerHTML = `হাজির: <span class="badge bg-primary">${attendance.length}</span>`;
        
        if (attendance.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">হাজিরা এখনো শুরু হয়নি</p>';
            return;
        }
        
        let html = '<div class="list-group">';
        
        attendance.forEach((record, index) => {
            html += `
                <div class="list-group-item list-group-item-action">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${record.name}</h6>
                        <small>${record.time}</small>
                    </div>
                    <p class="mb-1 small">
                        রোল: ${record.roll} | ক্লাস: ${record.class}${record.section ? ' (' + record.section + ')' : ''}
                    </p>
                    <small class="text-muted">আত্মবিশ্বাস: ${record.confidence}%</small>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    // ম্যানুয়াল মার্ক মোডাল দেখান
    showManualMarkModal() {
        const students = this.storage.getAllStudents();
        const selectElement = document.getElementById('manualStudentSelect');
        
        selectElement.innerHTML = '<option value="">ছাত্র নির্বাচন করুন</option>';
        
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = `${student.name} (রোল: ${student.roll}, ক্লাস: ${student.class})`;
            selectElement.appendChild(option);
        });
        
        // মোডাল শো
        const modal = new bootstrap.Modal(document.getElementById('manualMarkModal'));
        modal.show();
    }

    // ম্যানুয়াল হাজিরা মার্ক
    markManualAttendance() {
        const selectElement = document.getElementById('manualStudentSelect');
        const studentId = selectElement.value;
        
        if (!studentId) {
            this.showAlert('দয়া করে একজন ছাত্র নির্বাচন করুন', 'warning');
            return;
        }
        
        const student = this.storage.getStudentById(studentId);
        
        if (!student) {
            this.showAlert('ছাত্র খুঁজে পাওয়া যায়নি', 'danger');
            return;
        }
        
        // হাজিরা রেকর্ড তৈরি
        const now = new Date();
        const record = {
            studentId: student.id,
            name: student.name,
            roll: student.roll,
            class: student.class,
            section: student.section,
            date: this.storage.getTodayDateString(),
            time: now.toLocaleTimeString('bn-BD'),
            day: banglaDays[now.getDay()],
            confidence: 100, // ম্যানুয়াল মার্ক
            timestamp: now.getTime()
        };
        
        // সংরক্ষণ করুন
        const saved = this.storage.saveAttendanceRecord(record);
        
        if (saved) {
            this.showAlert(`${student.name} - ম্যানুয়াল হাজিরা নেওয়া হয়েছে!`, 'success');
            this.updateAttendanceList();
            
            // মোডাল বন্ধ
            const modal = bootstrap.Modal.getInstance(document.getElementById('manualMarkModal'));
            modal.hide();
        } else {
            this.showAlert(`${student.name} - ইতিমধ্যে আজ হাজিরা দেওয়া হয়েছে`, 'info');
        }
    }

    // সব ছাত্র দেখান
    showAllStudentsModal() {
        const students = this.storage.getAllStudents();
        const container = document.getElementById('allStudentsList');
        
        if (students.length === 0) {
            container.innerHTML = '<p class="text-center text-muted py-3">কোনো ছাত্র রেজিস্টার্ড নেই</p>';
        } else {
            let html = '<div class="table-responsive"><table class="table table-striped table-sm"><thead><tr>' +
                       '<th>নাম</th><th>রোল</th><th>ক্লাস</th><th>রেজি. তারিখ</th><th>ছবি</th></tr></thead><tbody>';
            
            students.forEach(student => {
                const regDate = new Date(student.registrationDate).toLocaleDateString('bn-BD');
                const photoCount = student.photos ? student.photos.length : 0;
                
                html += `<tr>
                    <td>${student.name}</td>
                    <td>${student.roll}</td>
                    <td>${student.class}${student.section ? ' (' + student.section + ')' : ''}</td>
                    <td>${regDate}</td>
                    <td><span class="badge bg-info">${photoCount}</span></td>
                </tr>`;
            });
            
            html += '</tbody></table></div>';
            container.innerHTML = html;
        }
        
        // মোডাল শো
        const modal = new bootstrap.Modal(document.getElementById('studentsModal'));
        modal.show();
    }

    // রিপোর্ট তৈরি
    generateReport() {
        const dateInput = document.getElementById('reportDate').value;
        const classInput = document.getElementById('reportClass').value;
        const container = document.getElementById('reportResults');
        
        let attendance = this.storage.getAllAttendance();
        
        // ফিল্টার প্রয়োগ
        if (dateInput) {
            attendance = attendance.filter(record => record.date === dateInput);
        }
        
        if (classInput !== 'all') {
            attendance = attendance.filter(record => record.class === classInput);
        }
        
        if (attendance.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">কোনো রেকর্ড পাওয়া যায়নি</h5>
                    <p class="small">ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন</p>
                </div>
            `;
            return;
        }
        
        // গ্রুপ বাই ডেট
        const groupedByDate = {};
        attendance.forEach(record => {
            if (!groupedByDate[record.date]) {
                groupedByDate[record.date] = [];
            }
            groupedByDate[record.date].push(record);
        });
        
        let html = '<h5 class="mb-4">হাজিরা রিপোর্ট</h5>';
        
        Object.keys(groupedByDate).forEach(date => {
            const records = groupedByDate[date];
            const banglaDate = this.storage.getBanglaDateString(date);
            
            html += `
                <div class="card mb-3">
                    <div class="card-header bg-light">
                        <h6 class="mb-0">${banglaDate} <span class="badge bg-secondary float-end">${records.length} জন</span></h6>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>নাম</th>
                                        <th>রোল</th>
                                        <th>ক্লাস</th>
                                        <th>সময়</th>
                                        <th>আত্মবিশ্বাস</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            records.forEach(record => {
                html += `
                    <tr>
                        <td>${record.name}</td>
                        <td>${record.roll}</td>
                        <td>${record.class}${record.section ? ' (' + record.section + ')' : ''}</td>
                        <td>${record.time}</td>
                        <td><span class="badge ${record.confidence > 80 ? 'bg-success' : 'bg-warning'}">${record.confidence}%</span></td>
                    </tr>
                `;
            });
            
            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    // আজকের হাজিরা CSV এক্সপোর্ট
    exportTodayCSV() {
        const attendance = this.storage.getTodayAttendance();
        
        if (attendance.length === 0) {
            this.showAlert('আজকের কোনো হাজিরা রেকর্ড নেই', 'warning');
            return;
        }
        
        this.exportToCSV(attendance, `today_attendance_${this.storage.getTodayDateString()}`);
    }

    // সব ডেটা CSV এক্সপোর্ট
    exportAllCSV() {
        const attendance = this.storage.getAllAttendance();
        
        if (attendance.length === 0) {
            this.showAlert('কোনো হাজিরা রেকর্ড নেই', 'warning');
            return;
        }
        
        this.exportToCSV(attendance, `all_attendance_${this.storage.getTodayDateString()}`);
    }

    // CSV এক্সপোর্ট হেল্পার
    exportToCSV(data, filename) {
        // CSV হেডার
        let csv = 'নাম,রোল নম্বর,ক্লাস,বিভাগ,তারিখ,দিন,সময়,আত্মবিশ্বাস (%)\n';
        
        // ডেটা রো
        data.forEach(record => {
            csv += `"${record.name}","${record.roll}","${record.class}","${record.section || ''}","${record.date}","${record.day}","${record.time}","${record.confidence}"\n`;
        });
        
        // CSV ফাইল ডাউনলোড
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showAlert(`CSV ফাইল ডাউনলোড শুরু হয়েছে: ${filename}.csv`, 'success');
    }

    // ডেটা ব্যাকআপ
    backupData() {
        const success = this.storage.backupData();
        
        if (success) {
            this.showAlert('ডেটা ব্যাকআপ সম্পন্ন হয়েছে! ফাইলটি ডাউনলোড হবে।', 'success');
        } else {
            this.showAlert('ব্যাকআপ করতে সমস্যা হচ্ছে', 'danger');
        }
    }

    // ডেটা রিস্টোর
    restoreData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const jsonData = e.target.result;
                const success = this.storage.restoreData(jsonData);
                
                if (success) {
                    this.showAlert('ডেটা রিস্টোর সম্পন্ন হয়েছে!', 'success');
                    this.updateUI();
                } else {
                    this.showAlert('রিস্টোর করতে সমস্যা হচ্ছে। ফাইলটি সঠিক কিনা চেক করুন।', 'danger');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }

    // আজকের হাজিরা ক্লিয়ার
    clearTodayAttendance() {
        if (!confirm('আপনি কি নিশ্চিত যে আজকের সব হাজিরা রেকর্ড মুছতে চান?')) {
            return;
        }
        
        const today = this.storage.getTodayDateString();
        const allRecords = this.storage.getAllAttendance();
        const filteredRecords = allRecords.filter(record => record.date !== today);
        
        localStorage.setItem('face_attendance_records', JSON.stringify(filteredRecords));
        
        this.showAlert('আজকের হাজিরা রেকর্ড মুছে ফেলা হয়েছে', 'info');
        this.updateAttendanceList();
    }

    // সব ডেটা ক্লিয়ার
    clearAllData() {
        if (!confirm('⚠️ সতর্কতা! আপনি কি নিশ্চিত যে সব ডেটা মুছতে চান?\n\nছাত্র তালিকা এবং সব হাজিরা রেকর্ড চিরতরে মুছে যাবে।')) {
            return;
        }
        
        const success = this.storage.clearAllData();
        
        if (success) {
            this.showAlert('সব ডেটা মুছে ফেলা হয়েছে', 'info');
            this.updateUI();
        } else {
            this.showAlert('ডেটা মুছতে সমস্যা হচ্ছে', 'danger');
        }
    }

    // UI আপডেট
    updateUI() {
        // ছাত্র সংখ্যা
        const students = this.storage.getAllStudents();
        document.getElementById('studentCount').textContent = students.length;
        document.getElementById('totalStudentsStat').textContent = students.length;
        
        // হাজিরা সংখ্যা
        const attendance = this.storage.getAllAttendance();
        document.getElementById('totalAttendanceStat').textContent = attendance.length;
        
        // আজকের হাজিরা লিস্ট
        this.updateAttendanceList();
        
        // স্টোরেজ ব্যবহার
        const storageBytes = this.storage.getStorageUsage();
        const storageKB = (storageBytes / 1024).toFixed(2);
        document.getElementById('storageUsage').textContent = `${storageKB} KB`;
        
        // তারিখ আপডেট
        document.getElementById('todayDate').textContent = this.storage.getBanglaDateString();
    }

    // এলার্ট শো
    showAlert(message, type = 'info') {
        // এলার্ট এলিমেন্ট তৈরি
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show alert-bangla`;
        alertDiv.style.position = 'fixed';
        alertDiv.style.top = '20px';
        alertDiv.style.right = '20px';
        alertDiv.style.zIndex = '9999';
        alertDiv.style.minWidth = '300px';
        alertDiv.style.maxWidth = '500px';
        
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // বডিতে যোগ
        document.body.appendChild(alertDiv);
        
        // ৫ সেকেন্ড পর অটো রিমুভ
        setTimeout(() => {
            if (alertDiv.parentNode) {
                const bsAlert = new bootstrap.Alert(alertDiv);
                bsAlert.close();
            }
        }, 5000);
    }
}

// অ্যাপ্লিকেশন শুরু
document.addEventListener('DOMContentLoaded', function() {
    // UIManager ইনস্ট্যান্স তৈরি
    const app = new UIManager();
    
    // মডেল প্রি-লোড শুরু
    const faceDetector = new FaceDetection();
    faceDetector.loadModels().then(success => {
        if (success) {
            console.log('ফেস মডেল প্রি-লোড সম্পন্ন');
        }
    });
    
    // UI আপডেট
    app.updateUI();
    
    // ইন্টারভালে UI আপডেট (প্রতি ১০ সেকেন্ডে)
    setInterval(() => {
        app.updateUI();
    }, 10000);
    
    // পেজ আনলোড হলে ক্লিনআপ
    window.addEventListener('beforeunload', function() {
        if (isAttendanceRunning && attendanceInterval) {
            clearInterval(attendanceInterval);
        }
        
        // ক্যামেরা স্টপ
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (video.srcObject) {
                const tracks = video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
        });
    });
});
