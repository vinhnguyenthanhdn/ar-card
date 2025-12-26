import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

let mindarThree = null;
let isARRunning = false;
let videoElement = null;
let currentVideoIndex = -1; // Track current video to avoid repetition
let videoTexture = null;
let videoMaterial = null;
let ring = null; // Ring mesh for marker indicator
let videoPlane = null; // Video plane mesh
let isTargetVisible = false; // Track if target is currently visible
let textMeshes = []; // Array to hold 3D text meshes
let animationTime = 0; // For bounce animation

// Video paths array
const VIDEO_PATHS = [
    '/ar-card/assets/video1.mp4',
    '/ar-card/assets/video2.mp4',
    '/ar-card/assets/video3.mp4'
];

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const welcomeScreen = document.getElementById('welcome-screen');
const arContainer = document.getElementById('ar-container');
const startButton = document.getElementById('start-button');
const backButton = document.getElementById('back-button');
const rescanButton = document.getElementById('rescan-button');
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

// ReScan button - reset video and allow rescanning
rescanButton.addEventListener('click', () => {
    console.log('🔄 ReScan button clicked');

    // Stop and hide video
    if (videoElement) {
        videoElement.pause();
        videoElement.currentTime = 0;
    }

    // Hide video plane
    if (videoPlane) {
        videoPlane.visible = false;
    }

    // Show ring again
    if (ring) {
        ring.visible = true;
    }

    // Hide text meshes
    textMeshes.forEach(sprite => {
        sprite.visible = false;
    });

    // Reset target visibility state
    isTargetVisible = false;

    // Update UI
    arTitle.textContent = '🔍 Hãy quét lại marker để xem video mới!';
    arTitle.style.color = 'white';
});

// Get random video index different from current
function getRandomVideoIndex() {
    if (VIDEO_PATHS.length === 1) return 0;

    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * VIDEO_PATHS.length);
    } while (newIndex === currentVideoIndex);

    return newIndex;
}

// Load video by index
function loadVideo(index) {
    const videoPath = new URL(VIDEO_PATHS[index], import.meta.url).href;

    if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.loop = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.setAttribute('playsinline', '');
        videoElement.crossOrigin = 'anonymous';
    }

    // Pause current video
    videoElement.pause();

    // Load new video
    videoElement.src = videoPath;
    videoElement.load();
    currentVideoIndex = index;

    // Update texture when video is ready
    videoElement.addEventListener('loadeddata', () => {
        if (videoTexture) {
            videoTexture.needsUpdate = true;
        }
        console.log(`📹 Video ${index + 1} ready to play`);
    }, { once: true });

    console.log(`📹 Loading video ${index + 1}: ${VIDEO_PATHS[index]}`);
}

// Initialize AR
async function initializeAR() {
    try {
        arTitle.textContent = '⏳ Đang tải dữ liệu AR (0%)...';

        console.log('Resolving asset paths...');
        const targetPath = new URL('/ar-card/assets/targets-BI1wfD3M.mind', import.meta.url).href;

        console.log('Target URL:', targetPath);

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

        // Load first random video
        const initialVideoIndex = getRandomVideoIndex();
        loadVideo(initialVideoIndex);

        // Video texture
        videoTexture = new THREE.VideoTexture(videoElement);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.format = THREE.RGBAFormat;

        // Video plane
        const aspectRatio = 16 / 9;
        const videoGeometry = new THREE.PlaneGeometry(1, 1 / aspectRatio);
        videoMaterial = new THREE.MeshBasicMaterial({
            map: videoTexture,
            side: THREE.DoubleSide
        });
        videoPlane = new THREE.Mesh(videoGeometry, videoMaterial);
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
        ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.z = 0.02;
        anchor.group.add(ring);

        // Create 3D Text using canvas texture
        const texts = ['AInnovation', 'GST GDN', 'SUMUP 2025'];
        const textYPositions = [0.4, 0.3, 0.2]; // Y positions for each line

        texts.forEach((text, index) => {
            // Create canvas for text
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 1024;
            canvas.height = 256;

            // Style text
            context.fillStyle = '#ffffff';
            context.font = 'bold 100px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';

            // Add glow effect
            context.shadowColor = '#FFD700';
            context.shadowBlur = 20;
            context.fillText(text, canvas.width / 2, canvas.height / 2);

            // Create texture from canvas
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;

            // Create sprite material
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                opacity: 0.9
            });

            // Create sprite
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(1.2, 0.3, 1);
            sprite.position.set(0, textYPositions[index], 0.05);

            // Store for animation
            sprite.userData.baseY = textYPositions[index];
            sprite.userData.offset = index * 0.5; // Offset for wave effect

            anchor.group.add(sprite);
            textMeshes.push(sprite);
        });

        // Target Found
        anchor.onTargetFound = () => {
            console.log('🎯 Target found!');

            // Only load new video if not currently visible (after rescan)
            if (!isTargetVisible) {
                // Load a new random video (different from current)
                const newVideoIndex = getRandomVideoIndex();
                loadVideo(newVideoIndex);

                arTitle.textContent = `🎉 Video ${newVideoIndex + 1}/3`;
            }

            arTitle.style.color = '#4ECDC4';

            // Show video plane
            if (videoPlane) {
                videoPlane.visible = true;
            }

            // Hide the ring when video is playing
            if (ring) {
                ring.visible = false;
            }

            // Show text meshes
            textMeshes.forEach(sprite => {
                sprite.visible = true;
            });

            // Mark target as visible
            isTargetVisible = true;

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

        // Render loop with animation
        renderer.setAnimationLoop(() => {
            // Animate text bounce
            animationTime += 0.03;
            textMeshes.forEach((sprite) => {
                const bounce = Math.sin(animationTime + sprite.userData.offset) * 0.03;
                sprite.position.y = sprite.userData.baseY + bounce;
            });

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
