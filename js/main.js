class Game {
    constructor() {
        this.canvas = document.getElementById('glCanvas');
        this.gl = this.canvas.getContext('webgl2');
        
        if (!this.gl) {
            alert('WebGL 2 desteklenmiyor!');
            return;
        }

        this.maze = new Maze(20, 20); // 20x20 labirent
        this.renderer = new Renderer(this.gl, this.maze);
        
        this.setupEventListeners();
        this.animate();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
                case 'w': this.maze.moveForward(); break;
                case 's': this.maze.moveBackward(); break;
                case 'a': this.maze.turnLeft(); break;
                case 'd': this.maze.turnRight(); break;
            }
        });
    }

    animate() {
        this.renderer.render();
        requestAnimationFrame(() => this.animate());
    }
}

window.onload = () => {
    new Game();
}; 