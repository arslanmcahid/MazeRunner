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
        this.position = { x: 1, y: 1 };
        this.direction = 0; // 0: sağ, 1: aşağı, 2: sol, 3: yukarı
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

class Renderer {
    constructor(gl, maze) {
        this.gl = gl;
        this.maze = maze;
        this.setupShaders();
        this.setupBuffers();
    }

    setupShaders() {
        const vsSource = `
            attribute vec3 aVertexPosition;
            attribute vec4 aVertexColor;
            attribute vec3 aVertexNormal;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            varying vec4 vColor;
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main(void) {
                vColor = aVertexColor;
                vNormal = aVertexNormal;
                vPosition = (uModelViewMatrix * vec4(aVertexPosition, 1.0)).xyz;
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
            }
        `;

        const fsSource = `
            precision mediump float;
            varying vec4 vColor;
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main(void) {
                // Işık ve kamera ayarları
                vec3 lightDir = normalize(vec3(0.0, 0.0, 1.0)); // yukarıdan
                vec3 viewDir = normalize(-vPosition); // kameradan piksele
                float ambient = 0.3;
                float diff = max(dot(vNormal, lightDir), 0.0);
                // Specular (yansıma)
                float specularStrength = 0.7;
                vec3 reflectDir = reflect(-lightDir, vNormal);
                float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
                float lighting = ambient + 0.5 * diff + specularStrength * spec;
                gl_FragColor = vec4(vColor.rgb * lighting, vColor.a);
            }
        `;

        const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, fsSource);
        
        if (!vertexShader || !fragmentShader) {
            return;
        }
        
        this.shaderProgram = this.gl.createProgram();
        this.gl.attachShader(this.shaderProgram, vertexShader);
        this.gl.attachShader(this.shaderProgram, fragmentShader);
        this.gl.linkProgram(this.shaderProgram);

        if (!this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS)) {
            alert('Shader programı oluşturulamadı: ' + this.gl.getProgramInfoLog(this.shaderProgram));
            return;
        }
    }

    loadShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            alert('Shader derleme hatası: ' + this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }

    setupBuffers() {
        const vertices = [];
        const colors = [];
        const normals = [];
        const offsetX = -this.maze.width / 2;
        const offsetY = -this.maze.height / 2;
        const wallHeight = 1.0;
        // 3B duvarlar (prizma)
        for (let y = 0; y < this.maze.height; y++) {
            for (let x = 0; x < this.maze.width; x++) {
                if (this.maze.grid[y][x] === 1) {
                    const x0 = x + offsetX;
                    const y0 = y + offsetY;
                    const x1 = x0 + 1;
                    const y1 = y0 + 1;
                    const z0 = 0;
                    const z1 = wallHeight;
                    // Her yüz için 2 üçgen ve normal
                    // Ön yüz (z1)
                    vertices.push(
                        x0, y0, z1,  x1, y0, z1,  x1, y1, z1,
                        x0, y0, z1,  x1, y1, z1,  x0, y1, z1
                    );
                    for (let i = 0; i < 6; i++) normals.push(0, 0, 1);
                    // Arka yüz (z0)
                    vertices.push(
                        x0, y1, z0,  x1, y1, z0,  x1, y0, z0,
                        x0, y1, z0,  x1, y0, z0,  x0, y0, z0
                    );
                    for (let i = 0; i < 6; i++) normals.push(0, 0, -1);
                    // Sağ yüz
                    vertices.push(
                        x1, y0, z0,  x1, y1, z0,  x1, y1, z1,
                        x1, y0, z0,  x1, y1, z1,  x1, y0, z1
                    );
                    for (let i = 0; i < 6; i++) normals.push(1, 0, 0);
                    // Sol yüz
                    vertices.push(
                        x0, y0, z1,  x0, y1, z1,  x0, y1, z0,
                        x0, y0, z1,  x0, y1, z0,  x0, y0, z0
                    );
                    for (let i = 0; i < 6; i++) normals.push(-1, 0, 0);
                    // Üst yüz
                    vertices.push(
                        x0, y1, z1,  x1, y1, z1,  x1, y1, z0,
                        x0, y1, z1,  x1, y1, z0,  x0, y1, z0
                    );
                    for (let i = 0; i < 6; i++) normals.push(0, 1, 0);
                    // Alt yüz
                    vertices.push(
                        x0, y0, z0,  x1, y0, z0,  x1, y0, z1,
                        x0, y0, z0,  x1, y0, z1,  x0, y0, z1
                    );
                    for (let i = 0; i < 6; i++) normals.push(0, -1, 0);
                    // Renkler (her vertex için)
                    for (let i = 0; i < 36; i++) {
                        colors.push(0.7, 0.7, 0.7, 1.0);
                    }
                }
            }
        }
        // --- TOPU 3B SİLİNDİR OLARAK EKLE ---
        const player = this.maze.position;
        const px = player.x + offsetX + 0.5;
        const py = player.y + offsetY + 0.5;
        const pz = 0.5; // duvar yüksekliğinin yarısı
        const radius = 0.3;
        const height = 0.5;
        const numSegments = 32;
        const startIdx = vertices.length / 3;
        // Yan yüzler
        for (let i = 0; i < numSegments; i++) {
            const angle1 = (i / numSegments) * Math.PI * 2;
            const angle2 = ((i + 1) / numSegments) * Math.PI * 2;
            const x1 = px + Math.cos(angle1) * radius;
            const y1 = py + Math.sin(angle1) * radius;
            const x2 = px + Math.cos(angle2) * radius;
            const y2 = py + Math.sin(angle2) * radius;
            // Alt üçgen
            vertices.push(x1, y1, pz - height / 2, x2, y2, pz - height / 2, x2, y2, pz + height / 2);
            vertices.push(x1, y1, pz - height / 2, x2, y2, pz + height / 2, x1, y1, pz + height / 2);
            for (let j = 0; j < 6; j++) {
                // Yanal normal
                const nx = Math.cos((angle1 + angle2) / 2);
                const ny = Math.sin((angle1 + angle2) / 2);
                normals.push(nx, ny, 0);
                colors.push(1.0, 0.0, 0.0, 1.0);
            }
        }
        // Üst kapak
        for (let i = 0; i < numSegments; i++) {
            const angle1 = (i / numSegments) * Math.PI * 2;
            const angle2 = ((i + 1) / numSegments) * Math.PI * 2;
            const x1 = px + Math.cos(angle1) * radius;
            const y1 = py + Math.sin(angle1) * radius;
            const x2 = px + Math.cos(angle2) * radius;
            const y2 = py + Math.sin(angle2) * radius;
            vertices.push(px, py, pz + height / 2, x1, y1, pz + height / 2, x2, y2, pz + height / 2);
            for (let j = 0; j < 3; j++) {
                normals.push(0, 0, 1);
                colors.push(1.0, 0.0, 0.0, 1.0);
            }
        }
        // Alt kapak
        for (let i = 0; i < numSegments; i++) {
            const angle1 = (i / numSegments) * Math.PI * 2;
            const angle2 = ((i + 1) / numSegments) * Math.PI * 2;
            const x1 = px + Math.cos(angle1) * radius;
            const y1 = py + Math.sin(angle1) * radius;
            const x2 = px + Math.cos(angle2) * radius;
            const y2 = py + Math.sin(angle2) * radius;
            vertices.push(px, py, pz - height / 2, x2, y2, pz - height / 2, x1, y1, pz - height / 2);
            for (let j = 0; j < 3; j++) {
                normals.push(0, 0, -1);
                colors.push(1.0, 0.0, 0.0, 1.0);
            }
        }
        this.playerStartIdx = startIdx;
        this.playerVertexCount = vertices.length / 3 - startIdx;
        // ---
        this.vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
        this.vertexBuffer.numItems = vertices.length / 3;
        this.colorBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STATIC_DRAW);
        // Normal buffer
        this.normalBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(normals), this.gl.STATIC_DRAW);
    }

    render() {
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.gl.useProgram(this.shaderProgram);
        // Kamera ve perspektif matrisleri
        const aspect = this.gl.canvas.width / this.gl.canvas.height;
        const projectionMatrix = createPerspectiveMatrix(Math.PI / 4, aspect, 0.1, 100.0);
        const offsetX = -this.maze.width / 2;
        const offsetY = -this.maze.height / 2;
        const player = this.maze.position;
        const px = player.x + offsetX + 0.5;
        const py = player.y + offsetY + 0.5;
        const eye = [px, py, 4];
        const center = [px, py, 0];
        const up = [0, 1, 0];
        const modelViewMatrix = createLookAtMatrix(eye, center, up);
        const uProjectionMatrix = this.gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix');
        const uModelViewMatrix = this.gl.getUniformLocation(this.shaderProgram, 'uModelViewMatrix');
        this.gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix);
        this.gl.uniformMatrix4fv(uModelViewMatrix, false, modelViewMatrix);
        // Attribute ayarları
        const positionAttributeLocation = this.gl.getAttribLocation(this.shaderProgram, 'aVertexPosition');
        if (positionAttributeLocation === -1) {
            console.error('aVertexPosition attribute bulunamadı');
            return;
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.vertexAttribPointer(positionAttributeLocation, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        const colorAttributeLocation = this.gl.getAttribLocation(this.shaderProgram, 'aVertexColor');
        if (colorAttributeLocation === -1) {
            console.error('aVertexColor attribute bulunamadı');
            return;
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.vertexAttribPointer(colorAttributeLocation, 4, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(colorAttributeLocation);
        // Normal attribute
        const normalAttributeLocation = this.gl.getAttribLocation(this.shaderProgram, 'aVertexNormal');
        if (normalAttributeLocation !== -1) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
            this.gl.vertexAttribPointer(normalAttributeLocation, 3, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(normalAttributeLocation);
        }
        // Duvarları çiz
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.vertexBuffer.numItems - this.playerVertexCount);
        // Topu çiz
        this.gl.drawArrays(this.gl.TRIANGLES, this.playerStartIdx, this.playerVertexCount);
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('glcanvas');
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
