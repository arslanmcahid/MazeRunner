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
        
        // Create ball body
        const bodyDef = new b2BodyDef();
        bodyDef.type = b2Body.b2_dynamicBody;
        bodyDef.position.Set(1, 1);
        bodyDef.linearDamping = 1.0; // Added linear damping to reduce maximum speed
        this.ballBody = this.world.CreateBody(bodyDef);
        
        const fixDef = new b2FixtureDef();
        fixDef.density = 1.0;
        fixDef.friction = 0.5; // Increased friction from 0.3 to 0.5
        fixDef.restitution = 0.2; // Reduced restitution for less bouncy behavior
        fixDef.shape = new b2CircleShape(0.3);
        this.ballBody.CreateFixture(fixDef);

        // Create maze walls
        bodyDef.type = b2Body.b2_staticBody;
        fixDef.shape = new b2PolygonShape();
        fixDef.shape.SetAsBox(0.5, 0.5);
        
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
            radius: 0.3,
            rotationSpeed: Math.PI * 2
        };

        this.camera = {
            position: { x: 1, y: 1 },
            height: 10,
            targetHeight: 10,
            lerpFactor: 0.05,
            heightLerpFactor: 0.02
        };

        this.lastTime = performance.now();
        this.moveDirection = { x: 0, y: 0 };
    }

    startMove(dx, dy) {
        // Apply force to the ball instead of direct position change
        console.log('startMove called with:', dx, dy);
        const force = new b2Vec2(dx * 1.0, dy * 1.0); // Reduced force magnitude from 2 to 1
        this.ballBody.ApplyForce(force, this.ballBody.GetWorldCenter());
        this.moveDirection = { x: dx, y: dy };
        console.log('Ball position after force:', this.ballBody.GetPosition().x, this.ballBody.GetPosition().y);
    }

    updateMovement() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Update physics world
        this.world.Step(1/60, 8, 3);

        // Get ball position from physics world
        const pos = this.ballBody.GetPosition();
        this.ball.position.x = pos.x;
        this.ball.position.y = pos.y;

        // Calculate ball rotation based on velocity
        const vel = this.ballBody.GetLinearVelocity();
        const moveDistance = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        
        // Apply maximum speed limit
        const maxSpeed = 3.0;
        if (moveDistance > maxSpeed) {
            vel.Multiply(maxSpeed / moveDistance);
            this.ballBody.SetLinearVelocity(vel);
        }
        
        // Update ball rotation based on movement
        if (moveDistance > 0.001) {
            const rotationAngle = (moveDistance / this.ball.radius) * this.ball.rotationSpeed * deltaTime;
            const normalizedVelX = vel.x / moveDistance;
            const normalizedVelY = vel.y / moveDistance;
            
            // Update rotation based on movement direction
            this.ball.rotation.x += rotationAngle * normalizedVelY;
            this.ball.rotation.z -= rotationAngle * normalizedVelX;
        }

        // Update camera position smoothly
        const targetX = this.ball.position.x;
        const targetY = this.ball.position.y;
        
        this.camera.position.x += (targetX - this.camera.position.x) * this.camera.lerpFactor;
        this.camera.position.y += (targetY - this.camera.position.y) * this.camera.lerpFactor;
        
        // Dynamic camera height based on ball speed
        const targetHeight = 10 + moveDistance * 1.5;
        this.camera.height += (targetHeight - this.camera.height) * this.camera.heightLerpFactor;

        // Apply friction to ball
        vel.Multiply(0.90);
        this.ballBody.SetLinearVelocity(vel);
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
}

class Renderer {
    constructor(gl, maze) {
        this.maze = maze;
        
        // Three.js setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('glCanvas'), antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Setup lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);

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

        // Create ball with its own unique material
        const ballGeometry = new THREE.SphereGeometry(0.3, 32, 32);
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

        // Set initial camera position
        this.camera.position.set(maze.width / 2, 15, maze.height / 2);
        this.camera.lookAt(maze.width / 2, 0, maze.height / 2);
    }

    createMazeWalls() {
        const wallGeometry = new THREE.BoxGeometry(1, 1, 1);
        
        for (let i = 0; i < this.maze.height; i++) {
            for (let j = 0; j < this.maze.width; j++) {
                if (this.maze.grid[i][j] === 1) {
                    // Her duvar için materyal klonlanıyor
                    const wall = new THREE.Mesh(wallGeometry, this.wallMaterial.clone());
                    wall.position.set(j, 0.5, i);
                    this.scene.add(wall);
                }
            }
        }
    }
    
    render() {
        // Update ball position and rotation
        const pos = this.maze.ball.position;
        this.ballMesh.position.set(
            pos.x,
            0.3, // Height of ball from ground
            pos.y
        );
        
        // Update ball rotation
        const rot = this.maze.ball.rotation;
        this.ballMesh.rotation.set(
            rot.x,
            rot.y,
            rot.z
        );
        
        // Update camera position
        const targetX = this.maze.camera.position.x;
        const targetZ = this.maze.camera.position.y;
        const targetY = this.maze.camera.height;
        
        this.camera.position.set(targetX, targetY, targetZ);
        this.camera.lookAt(new THREE.Vector3(targetX, 0, targetZ));
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
    
    // Handle window resize
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
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
        
        // FPS ve frame time takibi için değişkenler
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.currentFps = 0;
        
        // Tuş takibi için
        this.pressedKeys = new Set();
        
        this.setupEventListeners();
        this.createFpsDisplay();
        this.createHowToPlayScreen();
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
                </ul>
                <p><strong>Additional Controls:</strong></p>
                <ul style="list-style-type: none; padding-left: 20px;">
                    <li>🎮 Diagonal Movement: Press two direction keys simultaneously</li>
                    <li>ℹ️ I Key: Toggle this help screen</li>
                </ul>
                <p><strong>Objective:</strong></p>
                <p style="padding-left: 20px;">Navigate through the maze and find your way to the exit. Avoid hitting the walls!</p>
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
        // Tuşa basıldığında
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.pressedKeys.add(key);
            
            // I tuşuna basıldığında how to play ekranını aç/kapa
            if (key === 'i') {
                this.toggleHowToPlay();
            } else {
                this.updateMovement();
            }
        });

        // Tuş bırakıldığında
        document.addEventListener('keyup', (e) => {
            this.pressedKeys.delete(e.key.toLowerCase());
            this.updateMovement();
        });

        // Pencere boyutu değiştiğinde canvas'ı yeniden boyutlandır
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        });
    }

    updateMovement() {
        let dx = 0;
        let dy = 0;

        // Yatay hareket
        if (this.pressedKeys.has('a') || this.pressedKeys.has('arrowleft')) {
            dx -= 1;
        }
        if (this.pressedKeys.has('d') || this.pressedKeys.has('arrowright')) {
            dx += 1;
        }

        // Dikey hareket
        if (this.pressedKeys.has('w') || this.pressedKeys.has('arrowup')) {
            dy += 1;
        }
        if (this.pressedKeys.has('s') || this.pressedKeys.has('arrowdown')) {
            dy -= 1;
        }

        // Çapraz hareket için normalize etme
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        // Hareket varsa uygula
        if (dx !== 0 || dy !== 0) {
            this.maze.startMove(dx, dy);
        }
    }

    animate() {
        this.renderer.render();
        this.updateFpsCounter();
        requestAnimationFrame(() => this.animate());
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
