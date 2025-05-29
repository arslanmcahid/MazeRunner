// MazeRunner.js

function createPerspectiveMatrix(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) * nf;
    out[15] = 0;
    return out;
}

function createLookAtMatrix(eye, center, up) {
    const out = new Float32Array(16);
    let x0, x1, x2, y0, y1, y2, z0, z1, z2, len, eyex, eyey, eyez, upx, upy, upz, centerx, centery, centerz;
    eyex = eye[0];
    eyey = eye[1];
    eyez = eye[2];
    upx = up[0];
    upy = up[1];
    upz = up[2];
    centerx = center[0];
    centery = center[1];
    centerz = center[2];
    if (
        Math.abs(eyex - centerx) < 0.000001 &&
        Math.abs(eyey - centery) < 0.000001 &&
        Math.abs(eyez - centerz) < 0.000001
    ) {
        return mat4.identity(out);
    }
    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;
    len = 1 / Math.hypot(z0, z1, z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;
    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.hypot(x0, x1, x2);
    if (!len) {
        x0 = 0;
        x1 = 0;
        x2 = 0;
    } else {
        len = 1 / len;
        x0 *= len;
        x1 *= len;
        x2 *= len;
    }
    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;
    len = Math.hypot(y0, y1, y2);
    if (!len) {
        y0 = 0;
        y1 = 0;
        y2 = 0;
    } else {
        len = 1 / len;
        y0 *= len;
        y1 *= len;
        y2 *= len;
    }
    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;
    return out;
}

class Maze {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.grid = this.generateMaze();
        
        // Check if Box2D is loaded
        if (typeof b2World === 'undefined') {
            console.error('Box2D is not loaded!');
            alert('Box2D library is not loaded. Please check if Box2D.js is included.');
            return;
        }
        
        console.log('Box2D loaded successfully');
        
        // Initialize Box2D world with zero gravity
        this.world = new b2World(new b2Vec2(0, 0), true);
        console.log('Box2D world created');
        
        // Create ball body with larger radius - ASTRAY PHYSICS
        const bodyDef = new b2BodyDef();
        bodyDef.type = b2Body.b2_dynamicBody;
        bodyDef.position.Set(1, 1);
        // bodyDef.linearDamping = 0.5;  // Remove linear damping for Astray physics
        this.ballBody = this.world.CreateBody(bodyDef);
        
        const fixDef = new b2FixtureDef();
        fixDef.density = 1.0;
        fixDef.friction = 0.0;  // ASTRAY: No friction
        fixDef.restitution = 0.02;  // MINIMAL BOUNCE: Almost no bounce - was 0.1, now 0.02
        fixDef.shape = new b2CircleShape(0.25);  // SMALLER: Reduced from 0.35 to 0.25
        this.ballBody.CreateFixture(fixDef);

        // Create maze walls
        bodyDef.type = b2Body.b2_staticBody;
        fixDef.shape = new b2PolygonShape();
        fixDef.shape.SetAsBox(0.5, 0.5);
        fixDef.restitution = 0.02;  // MINIMAL BOUNCE: Reduced from 0.4 to 0.02
        fixDef.friction = 0.1;
        
        for (let i = 0; i < this.height; i++) {
            for (let j = 0; j < this.width; j++) {
                if (this.grid[i][j] === 1) {
                    bodyDef.position.x = j;
                    bodyDef.position.y = i;
                    this.world.CreateBody(bodyDef).CreateFixture(fixDef);
                }
            }
        }

        this.ball = {
            position: { x: 1, y: 1 },
            rotation: { x: 0, y: 0, z: 0 },
            radius: 0.25,  // SMALLER: Reduced from 0.35 to 0.25
            rotationSpeed: Math.PI * 2
        };

        this.camera = {
            position: { x: 1, y: 1 },
            height: 5,
            lerpFactor: 0.1  // ASTRAY: Faster camera follow (0.1 vs 0.05)
        };

        this.lastTime = performance.now();
        // ASTRAY MOVEMENT SYSTEM
        this.keyAxis = [0, 0];  // Astray uses keyAxis array instead of moveDirection
        this.collectibles = [];
        this.score = 0;
        this.gameCompleted = false;  // Victory flag
        this.createCollectibles();
    }

    // ASTRAY MOVEMENT METHODS - Replace old movement system
    setMovement(x, y) {
        this.keyAxis = [x, y];
    }

    updateMovement() {
        // ASTRAY PHYSICS - Apply "friction" (reduced for more speed)
        const lv = this.ballBody.GetLinearVelocity();
        lv.Multiply(0.99);  // Further reduced friction: 0.99 instead of 0.98 for even more speed
        this.ballBody.SetLinearVelocity(lv);
        
        // ASTRAY PHYSICS - Apply user-directed force (increased for faster acceleration)
        const f = new b2Vec2(
            this.keyAxis[0] * this.ballBody.GetMass() * 1.2,  // Increased from 0.75 to 1.2 (60% faster acceleration)
            this.keyAxis[1] * this.ballBody.GetMass() * 1.2   // Increased from 0.75 to 1.2 (60% faster acceleration)
        );
        this.ballBody.ApplyImpulse(f, this.ballBody.GetPosition());
        this.keyAxis = [0, 0];  // Reset keyAxis after applying force

        // Take a time step
        this.world.Step(1/60, 8, 3);

        // Get ball position and calculate movement for rotation
        const pos = this.ballBody.GetPosition();
        
        // Calculate movement step for rotation (before updating ball position)
        const stepX = pos.x - this.ball.position.x;
        const stepY = pos.y - this.ball.position.y;
        
        // Update ball position
        this.ball.position.x = pos.x;
        this.ball.position.y = pos.y;

        // ASTRAY BALL ROTATION - Update ball rotation based on movement
        this.ball.rotation.x += stepY / this.ball.radius * 2;  // Multiply by 2 for more visible rotation
        this.ball.rotation.z -= stepX / this.ball.radius * 2;  // Multiply by 2 for more visible rotation

        // ASTRAY CAMERA - Update camera position smoothly
        this.camera.position.x += (this.ball.position.x - this.camera.position.x) * this.camera.lerpFactor;
        this.camera.position.y += (this.ball.position.y - this.camera.position.y) * this.camera.lerpFactor;

        // Check for collectible collection
        this.checkCollectibles();
    }

    generateMaze() {
        const grid = Array(this.height).fill().map(() => 
            Array(this.width).fill(1)
        );
        
        const carve = (x, y) => {
            grid[y][x] = 0;
            
            const directions = [
                [2, 0], [-2, 0], [0, 2], [0, -2]
            ].sort(() => Math.random() - 0.5);
            
            for (let [dx, dy] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx > 0 && nx < this.width - 1 && 
                    ny > 0 && ny < this.height - 1 && 
                    grid[ny][nx] === 1) {
                    grid[y + dy/2][x + dx/2] = 0;
                    carve(nx, ny);
                }
            }
        };
        
        carve(1, 1);
        return grid;
    }

    createCollectibles() {
        // Labirentin boş hücrelerini bul
        const emptySpaces = [];
        for (let i = 0; i < this.height; i++) {
            for (let j = 0; j < this.width; j++) {
                if (this.grid[i][j] === 0 && !(j === 1 && i === 1)) { // Başlangıç noktası hariç
                    emptySpaces.push({x: j, y: i});
                }
            }
        }

        // Rastgele 10 nokta seç
        const collectibleCount = Math.min(10, emptySpaces.length);
        for (let i = 0; i < collectibleCount; i++) {
            const randomIndex = Math.floor(Math.random() * emptySpaces.length);
            const position = emptySpaces[randomIndex];
            this.collectibles.push({
                x: position.x,
                y: position.y,
                collected: false,
                rotationY: 0 // Zümrütün dönüş açısı
            });
            emptySpaces.splice(randomIndex, 1);
        }
    }

    checkCollectibles() {
        const ballX = Math.round(this.ball.position.x);
        const ballY = Math.round(this.ball.position.y);
        
        this.collectibles.forEach(collectible => {
            if (!collectible.collected && 
                Math.abs(ballX - collectible.x) < 0.5 && 
                Math.abs(ballY - collectible.y) < 0.5) {
                collectible.collected = true;
                this.score += 100;  // 100 points per emerald (base score)
                console.log('Score:', this.score);
            }
            // Zümrütü döndür
            collectible.rotationY += 0.02;
        });

        // Victory check - all emeralds collected
        const allCollected = this.collectibles.every(collectible => collectible.collected);
        if (allCollected && !this.gameCompleted) {
            this.gameCompleted = true;
            // Notify game instance
            if (window.gameInstance) {
                window.gameInstance.showVictoryScreen();
            }
        }
    }

    calculateFinalScore(completionTimeMs) {
        const emeraldCount = this.collectibles.length;
        const collectedCount = this.collectibles.filter(c => c.collected).length;
        
        // Base score: 100 points per emerald
        const baseScore = collectedCount * 100;
        
        // Perfect completion bonus
        const perfectBonus = (collectedCount === emeraldCount) ? 500 : 0;
        
        // Time bonus calculation (faster = higher bonus)
        const completionTimeSeconds = completionTimeMs / 1000;
        const targetTime = 60; // Target: 60 seconds for perfect time bonus
        const maxTimeBonus = 1000;
        
        // Time bonus decreases as time increases
        const timeBonus = Math.max(0, maxTimeBonus - (completionTimeSeconds - targetTime) * 10);
        
        // Speed multiplier (1.0 to 2.0)
        const speedMultiplier = completionTimeSeconds <= targetTime ? 
            1.5 + (targetTime - completionTimeSeconds) / targetTime * 0.5 : 
            Math.max(1.0, 1.5 - (completionTimeSeconds - targetTime) / targetTime * 0.3);
        
        // Final score calculation
        const finalScore = Math.round((baseScore + perfectBonus + timeBonus) * speedMultiplier);
        
        return {
            finalScore,
            breakdown: {
                baseScore,
                perfectBonus,
                timeBonus: Math.round(timeBonus),
                speedMultiplier: speedMultiplier.toFixed(2),
                emeraldCount: collectedCount,
                totalEmeralds: emeraldCount,
                completionTime: completionTimeSeconds.toFixed(1)
            }
        };
    }
}

class Renderer {
    constructor(gl, maze) {
        this.maze = maze;
        
        // Three.js setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        this.scene.add(this.camera); // add camera to scene for add the light as a child of the camera i think
        
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('glCanvas'), antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Fade in the ambient light & camera-spot settings
        this.startAmbientIntensity = 0.6;
        this.endAmbientIntensity = 0.0;
        this.ambientLight = new THREE.AmbientLight(0xffffff, this.startAmbientIntensity);
        this.scene.add(this.ambientLight);

        this.cameraLight = new THREE.PointLight(
            0xffffff, //color
            2, //intensity
            10, //distance
            1); //decay
        this.camera.add(this.cameraLight);

        // Texture loader
        const textureLoader = new THREE.TextureLoader();
        
        // Load textures separately and ensure they're loaded before use
        const ballTexture = textureLoader.load('assets/ball.jpg', (texture) => {
            console.log('Ball texture loaded successfully');
            this.ballMesh.material.map = texture;
            this.ballMesh.material.needsUpdate = true;
        });
        
        const wallTexture = textureLoader.load('assets/wall.jpg', (texture) => {
            console.log('Wall texture loaded successfully');
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
        });
        
        const floorTexture = textureLoader.load('assets/floor.jpg', (texture) => {
            console.log('Floor texture loaded successfully');
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(maze.width/2, maze.height/2);
        });

        // Create ball with smaller radius (0.25)
        const ballGeometry = new THREE.SphereGeometry(0.25, 32, 32);
        const ballMaterial = new THREE.MeshPhongMaterial({
            map: ballTexture,
            specular: 0x555555,
            shininess: 30
        });
        this.ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
        this.scene.add(this.ballMesh);

        // Create walls with separate material
        this.wallMaterial = new THREE.MeshPhongMaterial({
            map: wallTexture,
            specular: 0x222222,
            shininess: 10
        });
        this.createMazeWalls();

        // Create floor
        const floorGeometry = new THREE.PlaneGeometry(maze.width, maze.height);
        const floorMaterial = new THREE.MeshPhongMaterial({
            map: floorTexture,
            side: THREE.DoubleSide
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(maze.width / 2, -0.5, maze.height / 2);
        this.scene.add(floor);

        // Set initial camera position for overview
        const mazeSize = Math.max(maze.width, maze.height);
        this.overviewHeight = mazeSize * 1.2;  // Height to see full maze
        this.camera.position.set(maze.width / 2, this.overviewHeight, maze.height / 2);
        this.camera.lookAt(maze.width / 2, 0, maze.height / 2);

        // Load emerald texture
        const emeraldTexture = textureLoader.load('assets/emerald.png', (texture) => {
            console.log('Emerald texture loaded successfully');
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
        });

        // Create collectibles
        this.collectibleMeshes = [];
        this.createCollectibles(maze.collectibles);
    }

    render() {
        // Update ball position and rotation
        const pos = this.maze.ball.position;
        this.ballMesh.position.set(
            pos.x,
            0.25,  // Smaller ball height (radius)
            pos.y
        );
        
        // Update ball rotation
        const rot = this.maze.ball.rotation;
        this.ballMesh.rotation.set(
            rot.x,
            rot.y,
            rot.z
        );
        
        // Update camera position based on game state
        this.updateCameraPosition();

        // Keep the camera and light on the ball:
        // const camH = this.maze.camera.height + 0.4;
        // this.camera.position.set(pos.x, camH, pos.y);
        // this.camera.lookAt(new THREE.Vector3(pos.x, 0.4, pos.y));
        // since the cameralight is a child, no additional updates are required



        
        // Update collectibles rotation and visibility
        this.collectibleMeshes.forEach((mesh, index) => {
            const collectible = this.maze.collectibles[index];
            if (collectible.collected) {
                if (mesh.visible) {
                    mesh.visible = false;
                }
            } else {
                // Zümrütleri daha yavaş döndür ve yukarı aşağı hareket ettir
                mesh.rotation.y = collectible.rotationY;
                // Yukarı aşağı sallanma hareketi ekle
                mesh.position.y = 1.0 + Math.sin(Date.now() * 0.002) * 0.1;
            }
        });
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
    
    // Handle window resize
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    createMazeWalls() {
        const wallGeometry = new THREE.BoxGeometry(1, 1, 1);
        
        for (let i = 0; i < this.maze.height; i++) {
            for (let j = 0; j < this.maze.width; j++) {
                if (this.maze.grid[i][j] === 1) {
                    const wall = new THREE.Mesh(wallGeometry, this.wallMaterial.clone());
                    wall.position.set(j, 0.5, i);
                    this.scene.add(wall);
                }
            }
        }
    }

    createCollectibles(collectibles) {
        // Zümrüt geometrisi (oktahedron şeklinde)
        const emeraldGeometry = new THREE.OctahedronGeometry(0.2, 0);
        const emeraldMaterial = new THREE.MeshPhongMaterial({
            color: 0x50C878, // Zümrüt yeşili
            emissive: 0x208040,
            emissiveIntensity: 0.2,
            shininess: 100,
            specular: 0xFFFFFF,
            transparent: true,
            opacity: 0.9
        });

        collectibles.forEach(collectible => {
            const mesh = new THREE.Mesh(emeraldGeometry, emeraldMaterial.clone());
            // Zümrütleri yerden biraz yukarıda konumlandır
            mesh.position.set(collectible.x, 1.0, collectible.y);
            this.scene.add(mesh);
            this.collectibleMeshes.push(mesh);
        });
    }

    updateCameraPosition() {
        // const t = window.gameInstance.cameraTransition;
        // this.ambientLight.intensity = THREE.MathUtils.lerp(
        //     this.startAmbientIntensity, // in constructor = 0.6
        //     this.endAmbientIntensity,
        //     t // 0 overview, 1 following
        // );


        // Get camera state from game
        const game = window.gameInstance;

        const t = (game.cameraState === 'overview') 
                    ? 0 
                    : game.cameraTransition;
                    this.ambientLight.intensity = THREE.MathUtils.lerp(
                        this.startAmbientIntensity,
                        this.endAmbientIntensity,
                        t
                    );

        // this.cameraLight.intensity = THREE.MathUtils.lerp(
        //     10, 0, t);

        if (!game) {
            // Fallback to normal following if no game instance
            const targetX = this.maze.camera.position.x;
            const targetZ = this.maze.camera.position.y;
            const targetY = this.maze.camera.height;
            
            this.camera.position.set(targetX, targetY, targetZ);
            this.camera.lookAt(new THREE.Vector3(targetX, 0, targetZ));
            return;
        }

        if (game.cameraState === 'overview') {
            // Overview mode: Show entire maze from above
            const targetX = this.maze.width / 2;
            const targetZ = this.maze.height / 2;
            const targetY = this.overviewHeight;
            
            this.camera.position.set(targetX, targetY, targetZ);
            this.camera.lookAt(new THREE.Vector3(targetX, 0, targetZ));
            
        } else if (game.cameraState === 'transition') {
            // Transition mode: Smooth interpolation
            const t = game.cameraTransition; // 0-1 easing
            
            // Overview position
            const overviewX = this.maze.width / 2;
            const overviewY = this.overviewHeight;
            const overviewZ = this.maze.height / 2;
            
            // Following position
            const followingX = this.maze.camera.position.x;
            const followingY = this.maze.camera.height;
            const followingZ = this.maze.camera.position.y;
            
            // Smooth easing function
            const easeInOut = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            const easedT = easeInOut(t);
            
            // Interpolate positions
            const currentX = overviewX + (followingX - overviewX) * easedT;
            const currentY = overviewY + (followingY - overviewY) * easedT;
            const currentZ = overviewZ + (followingZ - overviewZ) * easedT;
            
            this.camera.position.set(currentX, currentY, currentZ);
            this.camera.lookAt(new THREE.Vector3(followingX, 0, followingZ));
            
        } else {
            // Following mode: Normal ball following
            const targetX = this.maze.camera.position.x;
            const targetZ = this.maze.camera.position.y;
            const targetY = this.maze.camera.height;
            
            this.camera.position.set(targetX, targetY, targetZ);
            this.camera.lookAt(new THREE.Vector3(targetX, 0, targetZ));
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('glCanvas');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.gl = this.canvas.getContext('webgl2');
        
        if (!this.gl) {
            alert('WebGL 2 desteklenmiyor!');
            return;
        }

        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.enable(this.gl.DEPTH_TEST);

        this.maze = new Maze(20, 20);
        this.renderer = new Renderer(this.gl, this.maze);
        
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.currentFps = 0;
        
        // ASTRAY: Initialize keys object for keyboard handling
        this.keys = {};
        
        // CAMERA SYSTEM: Overview -> Following transition
        this.cameraState = 'overview';  // 'overview' or 'following'
        this.overviewDuration = 10000;   // 10 seconds overview
        this.gameStartTime = performance.now();
        this.cameraTransition = 0;      // 0-1 transition progress
        
        // TIMER SYSTEM
        this.gameplayStartTime = null;  // When actual gameplay starts
        this.isGameplayActive = false;  // Flag to control timer
        
        this.setupEventListeners();
        this.createFpsDisplay();
        this.createHowToPlayScreen();
        this.scoreDisplay = this.createScoreDisplay();
        this.createCountdownDisplay();
        this.createTimerDisplay();
        this.createVictoryScreen();
        
        // Set global game instance for renderer access
        window.gameInstance = this;
        
        this.animate();
    }

    createFpsDisplay() {
        this.fpsDisplay = document.createElement('div');
        this.fpsDisplay.style.position = 'fixed';
        this.fpsDisplay.style.top = '10px';
        this.fpsDisplay.style.left = '10px';
        this.fpsDisplay.style.color = 'white';
        this.fpsDisplay.style.fontFamily = 'monospace';
        this.fpsDisplay.style.fontSize = '14px';
        this.fpsDisplay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        this.fpsDisplay.style.padding = '5px';
        document.body.appendChild(this.fpsDisplay);
    }

    updateFpsCounter() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.frameCount++;

        // Her saniye FPS'i güncelle
        if (currentTime - this.lastFpsUpdate > 1000) {
            this.currentFps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
            this.fpsDisplay.textContent = `FPS: ${this.currentFps} | Frame Time: ${deltaTime.toFixed(2)}ms`;
            this.lastFpsUpdate = currentTime;
            this.frameCount = 0;
        }

        this.lastFrameTime = currentTime;
    }

    createHowToPlayScreen() {
        this.howToPlayScreen = document.createElement('div');
        this.howToPlayScreen.style.position = 'fixed';
        this.howToPlayScreen.style.top = '50%';
        this.howToPlayScreen.style.left = '50%';
        this.howToPlayScreen.style.transform = 'translate(-50%, -50%)';
        this.howToPlayScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        this.howToPlayScreen.style.color = 'white';
        this.howToPlayScreen.style.padding = '20px';
        this.howToPlayScreen.style.borderRadius = '10px';
        this.howToPlayScreen.style.fontFamily = 'Arial, sans-serif';
        this.howToPlayScreen.style.fontSize = '16px';
        this.howToPlayScreen.style.maxWidth = '500px';
        this.howToPlayScreen.style.display = 'none';
        this.howToPlayScreen.style.zIndex = '1000';
        this.howToPlayScreen.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
        this.howToPlayScreen.style.border = '1px solid rgba(255,255,255,0.1)';

        this.howToPlayScreen.innerHTML = `
            <h2 style="color: #4CAF50; margin-bottom: 20px; text-align: center;">How to Play</h2>
            <div style="line-height: 1.6;">
                <p><strong>Movement Controls:</strong></p>
                <ul style="list-style-type: none; padding-left: 20px;">
                    <li>⬆️ W or Up Arrow: Move Forward</li>
                    <li>⬇️ S or Down Arrow: Move Backward</li>
                    <li>⬅️ A or Left Arrow: Move Left</li>
                    <li>➡️ D or Right Arrow: Move Right</li>
                    <li>🎮 H, J, K, L: Vim-style movement (Astray compatible)</li>
                </ul>
                <p><strong>Additional Controls:</strong></p>
                <ul style="list-style-type: none; padding-left: 20px;">
                    <li>ℹ️ I Key: Toggle this help screen</li>
                </ul>
                <p><strong>Camera System:</strong></p>
                <ul style="list-style-type: none; padding-left: 20px;">
                    <li>📷 Overview: Game starts with full maze view</li>
                    <li>🎮 Auto-transition: Camera follows ball after 3s or first movement</li>
                    <li>🔄 Smooth transition: 2-second smooth camera movement</li>
                </ul>
                <p><strong>Objective:</strong></p>
                <p style="padding-left: 20px;">Navigate through the maze and collect emerald gems to increase your score! Uses Astray-style physics for realistic ball movement.</p>
                <p style="text-align: center; margin-top: 20px; color: #888;">
                    Press 'I' again to close this window
                </p>
            </div>
        `;

        document.body.appendChild(this.howToPlayScreen);
    }

    toggleHowToPlay() {
        if (this.howToPlayScreen.style.display === 'none') {
            this.howToPlayScreen.style.display = 'block';
        } else {
            this.howToPlayScreen.style.display = 'none';
        }
    }

    setupEventListeners() {
        // ASTRAY STYLE KEYBOARD HANDLING
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            
            if (key === 'i') {
                this.toggleHowToPlay();
                return;
            }

            this.keys = this.keys || {};
            this.keys[key] = true;
            this.updateKeyAxis();
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            
            this.keys = this.keys || {};
            this.keys[key] = false;
            this.updateKeyAxis();
        });

        // Pencere boyutu değiştiğinde
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            this.renderer.onWindowResize();
        });
    }

    // ASTRAY STYLE KEY AXIS UPDATE
    updateKeyAxis() {
        let x = 0, y = 0;
        
        if (this.keys['arrowleft'] || this.keys['a'] || this.keys['h']) x = -1;
        if (this.keys['arrowright'] || this.keys['d'] || this.keys['l']) x = 1;
        if (this.keys['arrowup'] || this.keys['w'] || this.keys['k']) y = -1;
        if (this.keys['arrowdown'] || this.keys['s'] || this.keys['j']) y = 1;
        
        this.maze.setMovement(x, y);
    }

    createScoreDisplay() {
        const scoreDiv = document.createElement('div');
        scoreDiv.style.position = 'fixed';
        scoreDiv.style.top = '50px';
        scoreDiv.style.left = '10px';
        scoreDiv.style.color = 'white';
        scoreDiv.style.fontFamily = 'monospace';
        scoreDiv.style.fontSize = '20px';
        scoreDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
        scoreDiv.style.padding = '10px';
        scoreDiv.style.borderRadius = '5px';
        document.body.appendChild(scoreDiv);
        return scoreDiv;
    }

    createCountdownDisplay() {
        this.countdownDisplay = document.createElement('div');
        this.countdownDisplay.style.position = 'fixed';
        this.countdownDisplay.style.top = '50%';
        this.countdownDisplay.style.left = '50%';
        this.countdownDisplay.style.transform = 'translate(-50%, -50%)';
        this.countdownDisplay.style.color = '#FFD700';  // Gold color
        this.countdownDisplay.style.fontFamily = 'Arial, sans-serif';
        this.countdownDisplay.style.fontSize = '120px';  // Very large
        this.countdownDisplay.style.fontWeight = 'bold';
        this.countdownDisplay.style.textAlign = 'center';
        this.countdownDisplay.style.textShadow = '4px 4px 8px rgba(0,0,0,0.8)';
        this.countdownDisplay.style.backgroundColor = 'rgba(0,0,0,0.7)';
        this.countdownDisplay.style.padding = '30px 50px';
        this.countdownDisplay.style.borderRadius = '20px';
        this.countdownDisplay.style.border = '3px solid #FFD700';
        this.countdownDisplay.style.zIndex = '1000';
        this.countdownDisplay.style.display = 'none';  // Hidden initially
        this.countdownDisplay.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 10px; color: #FFF;">Game starts in</div>
            <div id="countdown-number" style="font-size: 120px;">3</div>
            <div style="font-size: 18px; margin-top: 10px; color: #CCC;">Press any movement key to start immediately</div>
        `;
        document.body.appendChild(this.countdownDisplay);
    }

    createTimerDisplay() {
        this.timerDisplay = document.createElement('div');
        this.timerDisplay.style.position = 'fixed';
        this.timerDisplay.style.top = '10px';
        this.timerDisplay.style.right = '10px';
        this.timerDisplay.style.color = 'white';
        this.timerDisplay.style.fontFamily = 'monospace';
        this.timerDisplay.style.fontSize = '18px';
        this.timerDisplay.style.fontWeight = 'bold';
        this.timerDisplay.style.backgroundColor = 'rgba(0,0,0,0.7)';
        this.timerDisplay.style.padding = '8px 12px';
        this.timerDisplay.style.borderRadius = '5px';
        this.timerDisplay.style.border = '1px solid rgba(255,255,255,0.3)';
        this.timerDisplay.style.zIndex = '999';
        this.timerDisplay.style.display = 'none';  // Hidden initially
        this.timerDisplay.style.minWidth = '80px';
        this.timerDisplay.style.textAlign = 'center';
        this.timerDisplay.innerHTML = `
            <div style="font-size: 12px; color: #CCC; margin-bottom: 2px;">TIME</div>
            <div id="timer-seconds" style="font-size: 18px; color: #4CAF50;">00:00</div>
        `;
        document.body.appendChild(this.timerDisplay);
    }

    createVictoryScreen() {
        this.victoryScreen = document.createElement('div');
        this.victoryScreen.style.position = 'fixed';
        this.victoryScreen.style.top = '50%';
        this.victoryScreen.style.left = '50%';
        this.victoryScreen.style.transform = 'translate(-50%, -50%)';
        this.victoryScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
        this.victoryScreen.style.color = 'white';
        this.victoryScreen.style.padding = '40px';
        this.victoryScreen.style.borderRadius = '15px';
        this.victoryScreen.style.fontFamily = 'Arial, sans-serif';
        this.victoryScreen.style.fontSize = '16px';
        this.victoryScreen.style.minWidth = '400px';
        this.victoryScreen.style.maxWidth = '600px';
        this.victoryScreen.style.display = 'none';
        this.victoryScreen.style.zIndex = '2000';
        this.victoryScreen.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.3)';
        this.victoryScreen.style.border = '2px solid #FFD700';
        this.victoryScreen.style.textAlign = 'center';

        // Initial placeholder content (will be updated when game is won)
        this.victoryScreen.innerHTML = `
            <h2 style="color: #FFD700;">Victory!</h2>
            <p>Congratulations on completing the maze!</p>
        `;

        document.body.appendChild(this.victoryScreen);
    }

    showVictoryScreen() {
        // Stop the timer
        this.isGameplayActive = false;
        
        // Calculate final time
        const finalTime = performance.now() - this.gameplayStartTime;
        const minutes = Math.floor(finalTime / 60000);
        const seconds = Math.floor((finalTime % 60000) / 1000);
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Calculate advanced score
        const scoreData = this.maze.calculateFinalScore(finalTime);
        
        // Get performance rating
        const getRating = (score) => {
            if (score >= 2500) return { text: "LEGENDARY", color: "#FFD700", emoji: "👑" };
            if (score >= 2000) return { text: "EXCELLENT", color: "#FF6B6B", emoji: "🔥" };
            if (score >= 1500) return { text: "GREAT", color: "#4ECDC4", emoji: "⭐" };
            if (score >= 1000) return { text: "GOOD", color: "#45B7D1", emoji: "✨" };
            return { text: "NICE TRY", color: "#95A5A6", emoji: "👍" };
        };
        
        const rating = getRating(scoreData.finalScore);
        
        // Update victory screen content
        this.victoryScreen.innerHTML = `
            <h2 style="color: #FFD700; margin-bottom: 15px; text-align: center; font-size: 28px;">🏆 MAZE COMPLETED! 🏆</h2>
            
            <div style="text-align: center; line-height: 1.6;">
                <div style="background: linear-gradient(45deg, ${rating.color}20, ${rating.color}10); border: 2px solid ${rating.color}; border-radius: 10px; padding: 15px; margin: 20px 0;">
                    <h3 style="color: ${rating.color}; margin: 0; font-size: 24px;">${rating.emoji} ${rating.text} ${rating.emoji}</h3>
                </div>
                
                <div style="background: rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 20px; margin: 20px 0;">
                    <p style="font-size: 24px; color: #FFD700; margin: 10px 0; font-weight: bold;">🎯 FINAL SCORE: ${scoreData.finalScore.toLocaleString()}</p>
                    <p style="font-size: 16px; margin: 8px 0;">💎 Emeralds: ${scoreData.breakdown.emeraldCount}/${scoreData.breakdown.totalEmeralds}</p>
                    <p style="font-size: 16px; margin: 8px 0;">⏱️ Time: ${formattedTime}</p>
                </div>
                
                <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 15px; margin: 15px 0; text-align: left; font-size: 14px;">
                    <h4 style="color: #4CAF50; margin: 0 0 10px 0; text-align: center;">Score Breakdown:</h4>
                    <p style="margin: 5px 0;">📦 Base Score: ${scoreData.breakdown.baseScore}</p>
                    <p style="margin: 5px 0;">🎁 Perfect Bonus: ${scoreData.breakdown.perfectBonus}</p>
                    <p style="margin: 5px 0;">⚡ Speed Bonus: ${scoreData.breakdown.timeBonus}</p>
                    <p style="margin: 5px 0;">🚀 Speed Multiplier: ${scoreData.breakdown.speedMultiplier}x</p>
                </div>
                
                <div style="margin-top: 30px;">
                    <button id="newGameBtn" style="
                        background: linear-gradient(45deg, #4CAF50, #45a049);
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        font-size: 18px;
                        border-radius: 10px;
                        cursor: pointer;
                        font-weight: bold;
                        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
                        transition: all 0.3s ease;
                        margin: 0 10px;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">🎮 Play Again</button>
                </div>
                
                <p style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
                    💡 Tip: Complete faster for higher scores!
                </p>
            </div>
        `;
        
        // Show victory screen
        this.victoryScreen.style.display = 'block';
        
        // Add event listener for new game button
        document.getElementById('newGameBtn').addEventListener('click', () => {
            this.startNewGame();
        });
    }

    startNewGame() {
        // Hide victory screen
        this.victoryScreen.style.display = 'none';
        
        // Reset game state
        this.cameraState = 'overview';
        this.gameStartTime = performance.now();
        this.gameplayStartTime = null;
        this.isGameplayActive = false;
        this.cameraTransition = 0;
        
        // Hide timer
        this.timerDisplay.style.display = 'none';
        
        // Create new maze
        this.maze = new Maze(20, 20);
        this.renderer.maze = this.maze;
        
        // Reset renderer
        this.renderer.scene.clear();
        this.renderer = new Renderer(this.gl, this.maze);
        
        // Update score display
        this.scoreDisplay.textContent = `Score: 0`;
    }

    animate() {
        // Update camera state system
        this.updateCameraState();
        
        // Update timer if gameplay is active
        this.updateTimer();
        
        this.maze.updateMovement();
        this.renderer.render();
        this.updateFpsCounter();
        this.scoreDisplay.textContent = `Score: ${this.maze.score}`;
        requestAnimationFrame(() => this.animate());
    }

    updateCameraState() {
        const currentTime = performance.now();
        const elapsedTime = currentTime - this.gameStartTime;
        
        if (this.cameraState === 'overview') {
            // Show countdown during overview
            this.countdownDisplay.style.display = 'block';
            
            // Calculate remaining time and update countdown
            const remainingTime = Math.max(0, this.overviewDuration - elapsedTime);
            const countdownNumber = Math.ceil(remainingTime / 1000);
            const countdownElement = document.getElementById('countdown-number');
            
            if (countdownElement && countdownNumber > 0) {
                countdownElement.textContent = countdownNumber.toString();
                
                // Add pulse animation on number change
                const lastDisplayedNumber = parseInt(countdownElement.getAttribute('data-last-number') || '4');
                if (countdownNumber !== lastDisplayedNumber) {
                    countdownElement.style.transform = 'scale(1.2)';
                    countdownElement.style.color = '#FF6B6B';  // Red flash
                    setTimeout(() => {
                        countdownElement.style.transform = 'scale(1)';
                        countdownElement.style.color = '#FFD700';  // Back to gold
                    }, 200);
                    countdownElement.setAttribute('data-last-number', countdownNumber.toString());
                }
            }
            
            // Check if overview period is over or user moved
            const userMoved = Object.values(this.keys).some(key => key === true);
            
            if (elapsedTime > this.overviewDuration || userMoved) {
                this.cameraState = 'transition';
                this.transitionStartTime = currentTime;
                this.transitionDuration = 2000; // 2 seconds transition
                this.countdownDisplay.style.display = 'none';  // Hide countdown
            }
            
        } else if (this.cameraState === 'transition') {
            // Update transition progress
            const transitionElapsed = currentTime - this.transitionStartTime;
            this.cameraTransition = Math.min(transitionElapsed / this.transitionDuration, 1.0);
            
            if (this.cameraTransition >= 1.0) {
                this.cameraState = 'following';
                // Start the gameplay timer when following mode begins
                if (!this.isGameplayActive) {
                    this.gameplayStartTime = currentTime;
                    this.isGameplayActive = true;
                    this.timerDisplay.style.display = 'block';  // Show timer
                }
            }
        }
        // 'following' state continues indefinitely
    }

    updateTimer() {
        if (!this.isGameplayActive || !this.gameplayStartTime) return;
        
        const currentTime = performance.now();
        const elapsedTime = currentTime - this.gameplayStartTime;
        
        const timerDisplay = document.getElementById('timer-seconds');
        if (timerDisplay) {
            const minutes = Math.floor(elapsedTime / 60000);
            const seconds = Math.floor((elapsedTime % 60000) / 1000);
            const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            timerDisplay.textContent = formattedTime;
        }
    }
}

window.onload = () => {
    new Game();
};

// Add window resize event listener
window.addEventListener('resize', () => {
    if (game && game.renderer) {
        game.renderer.onWindowResize();
    }
});
