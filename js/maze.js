export class Maze {
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
        
        // Create ball body with larger radius
        const bodyDef = new b2BodyDef();
        bodyDef.type = b2Body.b2_dynamicBody;
        bodyDef.position.Set(1, 1);
        // bodyDef.linearDamping = 0.5;  // Remove linear damping for physics
        this.ballBody = this.world.CreateBody(bodyDef);
        
        const fixDef = new b2FixtureDef();
        fixDef.density = 1.0;
        fixDef.friction = 0.0;  // No friction
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
            lerpFactor: 0.1  // Faster camera follow (0.1 vs 0.05)
        };

        this.lastTime = performance.now();
        // Movement system
        this.keyAxis = [0, 0];  // Uses keyAxis array instead of moveDirection
        this.collectibles = [];
        this.score = 0;
        this.gameCompleted = false;  // Victory flag
        this.createCollectibles();
    }

    // Movement methods - Replace old movement system
    setMovement(x, y) {
        this.keyAxis = [x, y];
    }

    updateMovement() {
        // Physics - Apply "friction" (reduced for more speed)
        const lv = this.ballBody.GetLinearVelocity();
        lv.Multiply(0.99);  // Further reduced friction: 0.99 instead of 0.98 for even more speed
        this.ballBody.SetLinearVelocity(lv);
        
        // Physics - Apply user-directed force (increased for faster acceleration)
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

        // Ball rotation - Update ball rotation based on movement
        this.ball.rotation.x += stepY / this.ball.radius * 2;  // Multiply by 2 for more visible rotation
        this.ball.rotation.z -= stepX / this.ball.radius * 2;  // Multiply by 2 for more visible rotation

        // Camera - Update camera position smoothly
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