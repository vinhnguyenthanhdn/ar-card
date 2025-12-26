import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';

let mindarThree = null;
let isARRunning = false;
let videoElement = null;

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const welcomeScreen = document.getElementById('welcome-screen');
const arContainer = document.getElementById('ar-container');
const startButton = document.getElementById('start-button');
const backButton = document.getElementById('back-button');
const arTitle = document.querySelector('.ar-title');

// Hide loading screen after page load
window.addEventListener('load', () => {
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 1000);
});

// Start AR Experience
startButton.addEventListener('click', async () => {
    try {
        welcomeScreen.classList.add('fade-out');
        arTitle.textContent = '⏳ Đang khởi động...';

        setTimeout(async () => {
            welcomeScreen.style.display = 'none';
            arContainer.style.display = 'block';
            await initializeAR();
        }, 500);
    } catch (error) {
        console.error('Error starting AR:', error);
        alert('Không thể khởi động AR. Vui lòng refresh và thử lại.');
        arContainer.style.display = 'none';
        welcomeScreen.style.display = 'flex';
        welcomeScreen.classList.remove('fade-out');
    }
});

// Back to welcome screen
backButton.addEventListener('click', () => {
    stopAR();
    arContainer.style.display = 'none';
    welcomeScreen.style.display = 'flex';
    welcomeScreen.classList.remove('fade-out');
    window.location.reload();
});

// Initialize AR
async function initializeAR() {
    try {
        arTitle.textContent = '⏳ Đang tải dữ liệu AR (0%)...';

        console.log('Resolving asset paths...');
        const targetPath = new URL('/ar-card/assets/targets-BI1wfD3M.mind', import.meta.url).href;
        const videoPath = new URL('/ar-card/assets/video-DnOXofXB.mp4', import.meta.url).href;

        console.log('Target URL:', targetPath);
        console.log('Video URL:', videoPath);

        // Initialize MindAR
        mindarThree = new MindARThree({
            container: document.querySelector('#ar-scene'),
            imageTargetSrc: targetPath,
            uiLoading: 'yes',
            uiScanning: 'no',
            filterMinCF: 0.1,
            filterBeta: 10,
        });

        const { renderer, scene, camera } = mindarThree;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        // Create anchor for target 0
        const anchor = mindarThree.addAnchor(0);

        // Create video element
        videoElement = document.createElement('video');
        videoElement.src = videoPath;
        videoElement.loop = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.setAttribute('playsinline', '');
        videoElement.crossOrigin = 'anonymous';
        videoElement.load();

        // Video texture
        const videoTexture = new THREE.VideoTexture(videoElement);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.format = THREE.RGBAFormat;

        // Video plane
        const aspectRatio = 16 / 9;
        const videoGeometry = new THREE.PlaneGeometry(1, 1 / aspectRatio);
        const videoMaterial = new THREE.MeshBasicMaterial({
            map: videoTexture,
            side: THREE.DoubleSide
        });
        const videoPlane = new THREE.Mesh(videoGeometry, videoMaterial);
        videoPlane.position.z = 0.01;
        anchor.group.add(videoPlane);

        // Ring geometry - REMOVED FROM DISPLAY, will be hidden when video plays
        const ringGeometry = new THREE.RingGeometry(0.52, 0.56, 64);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffd700,
            emissiveIntensity: 0.3,
            metalness: 0.8,
            roughness: 0.2,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.z = 0.02;
        anchor.group.add(ring);

        // Target Found
        anchor.onTargetFound = () => {
            console.log('🎯 Target found!');
            arTitle.textContent = '🎉 Đã tìm thấy Marker!';
            arTitle.style.color = '#4ECDC4';

            // Hide the ring when video is playing
            ring.visible = false;

            if (videoElement) {
                const playPromise = videoElement.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log('Autoplay prevented:', error);
                        arTitle.textContent = '👆 Chạm vào màn hình để xem video';
                    });
                }
            }
        };

        // Target Lost
        anchor.onTargetLost = () => {
            console.log('❌ Target lost');
            arTitle.textContent = '🔍 Đang tìm hình marker...';
            arTitle.style.color = 'white';

            // Show ring again when target is lost
            ring.visible = true;

            if (videoElement) {
                videoElement.pause();
            }
        };

        // Click to unmute
        document.body.addEventListener('click', () => {
            if (videoElement && !videoElement.playing) {
                videoElement.play();
                videoElement.muted = false;
            }
        }, { once: true });

        // Start AR
        arTitle.textContent = '⏳ Đang khởi động Engine...';
        console.log('Starting MindAR...');

        await mindarThree.start();
        isARRunning = true;

        arTitle.textContent = '✅ Đã sẵn sàng! Hãy quét ảnh.';
        console.log('MindAR started successfully!');

        // Render loop
        renderer.setAnimationLoop(() => {
            renderer.render(scene, camera);
        });

    } catch (error) {
        console.error('🔥 AR CRITICAL ERROR:', error);
        arTitle.textContent = '❌ Lỗi: ' + error.message;
        alert('Không thể tải file targets.mind hoặc video. Kiểm tra mạng của bạn!');
    }
}

// Stop AR
function stopAR() {
    if (mindarThree && isARRunning) {
        mindarThree.stop();
        mindarThree.renderer.setAnimationLoop(null);
        isARRunning = false;
    }

    if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
        videoElement.load();
    }
}

// Pause video when page hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isARRunning && videoElement) {
        videoElement.pause();
    }
});
