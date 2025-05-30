import { Maze } from './maze.js';
import { Renderer } from './renderer.js';

export class Game {
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
        
        // Initialize keys object for keyboard handling
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
                    <li>🎮 H, J, K, L: Vim-style movement controls</li>
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
                <p style="padding-left: 20px;">Navigate through the maze and collect emerald gems to increase your score! Features realistic ball physics for smooth movement.</p>
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
        // Keyboard handling
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

    // Key axis update
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