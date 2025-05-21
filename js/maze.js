class Maze {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.grid = this.generateMaze();
        this.position = { x: 1, y: 1 };
        this.direction = 0; // 0: sağ, 1: aşağı, 2: sol, 3: yukarı
    }

    generateMaze() {
        // Basit bir labirent oluşturma algoritması
        const grid = Array(this.height).fill().map(() => 
            Array(this.width).fill(1)
        );
        
        // Recursive backtracking algoritması
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

    moveForward() {
        const dx = [1, 0, -1, 0][this.direction];
        const dy = [0, 1, 0, -1][this.direction];
        
        if (this.grid[this.position.y + dy][this.position.x + dx] === 0) {
            this.position.x += dx;
            this.position.y += dy;
        }
    }

    moveBackward() {
        const dx = [-1, 0, 1, 0][this.direction];
        const dy = [0, -1, 0, 1][this.direction];
        
        if (this.grid[this.position.y + dy][this.position.x + dx] === 0) {
            this.position.x += dx;
            this.position.y += dy;
        }
    }

    turnLeft() {
        this.direction = (this.direction + 3) % 4;
    }

    turnRight() {
        this.direction = (this.direction + 1) % 4;
    }
} 