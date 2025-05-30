import * as THREE from 'https://unpkg.com/three@0.128.0/build/three.module.js';

export class Renderer {
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