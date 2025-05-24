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
        this.ball = {
            position: { x: 1, y: 1 },
            rotation: { x: 0, y: 0, z: 0 }
        };
        this.camera = {
            position: { x: 1, y: 1 },
            height: 10,
            velocity: { x: 0, y: 0 },
            maxSpeed: 0.1,
            acceleration: 0.008,
            friction: 0.95
        };
        this.rotationSpeed = Math.PI;
        this.lastTime = performance.now();
        this.moveSpeed = 0.05;
        this.currentMove = null;
        this.targetPosition = { x: 1, y: 1 };
        this.lerpFactor = 0.1;
        this.moveDirection = { x: 0, y: 0 };
    }

    startMove(dx, dy) {
        // Hedef pozisyonu hesapla
        const targetX = this.ball.position.x + dx;
        const targetY = this.ball.position.y + dy;
        
        // Sınırları ve duvarları kontrol et
        const gridX = Math.floor(targetX);
        const gridY = Math.floor(targetY);
        
        if (gridX < 0 || gridX >= this.width || 
            gridY < 0 || gridY >= this.height ||
            this.grid[gridY][gridX] === 1) {
            return; // Geçersiz hareket
        }
        
        // Hareket yönünü güncelle
        this.moveDirection = { x: dx, y: dy };
        
        // Hedef pozisyonu güncelle
        this.targetPosition.x = targetX;
        this.targetPosition.y = targetY;
        this.currentMove = { dx, dy };
    }

    updateMovement() {
        if (!this.currentMove) {
            // Hareket yoksa sürtünme uygula
            this.camera.velocity.x *= this.camera.friction;
            this.camera.velocity.y *= this.camera.friction;
            return;
        }
     
        // Top hareketi
        const dx = this.targetPosition.x - this.ball.position.x;
        const dy = this.targetPosition.y - this.ball.position.y;
        
        this.ball.position.x += dx * this.lerpFactor;
        this.ball.position.y += dy * this.lerpFactor;

        // Hareket tamamlandı mı kontrol et
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
            this.ball.position.x = this.targetPosition.x;
            this.ball.position.y = this.targetPosition.y;
            this.currentMove = null;
            this.moveDirection = { x: 0, y: 0 };
        }

        // Kamera hareketi için hız hesapla
        const targetDx = this.ball.position.x - this.camera.position.x;
        const targetDy = this.ball.position.y - this.camera.position.y;
        const distance = Math.sqrt(targetDx * targetDx + targetDy * targetDy);

        if (distance > 0.01) {
            // Normalize edilmiş yön vektörü
            const dirX = targetDx / distance;
            const dirY = targetDy / distance;

            // Hızı güncelle (ivmelenme)
            this.camera.velocity.x += dirX * this.camera.acceleration;
            this.camera.velocity.y += dirY * this.camera.acceleration;

            // Maksimum hızı sınırla
            const currentSpeed = Math.sqrt(
                this.camera.velocity.x * this.camera.velocity.x + 
                this.camera.velocity.y * this.camera.velocity.y
            );
            if (currentSpeed > this.camera.maxSpeed) {
                const scale = this.camera.maxSpeed / currentSpeed;
                this.camera.velocity.x *= scale;
                this.camera.velocity.y *= scale;
            }
        }

        // Kamera pozisyonunu güncelle
        this.camera.position.x += this.camera.velocity.x;
        this.camera.position.y += this.camera.velocity.y;

        // Sürtünme uygula
        this.camera.velocity.x *= this.camera.friction;
        this.camera.velocity.y *= this.camera.friction;
    }

    updateRotation() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        if (this.currentMove) {
            // Top dönüşünü hareket yönüne göre güncelle
            const dx = this.currentMove.dx;
            const dy = this.currentMove.dy;

            // X ve Z eksenleri etrafında dönüş
            if (dx !== 0) {
                this.ball.rotation.z += -Math.sign(dx) * this.rotationSpeed * deltaTime;
            }
            if (dy !== 0) {
                this.ball.rotation.x += Math.sign(dy) * this.rotationSpeed * deltaTime;
            }

            // Açıları normalize et
            this.ball.rotation.x = this.ball.rotation.x % (Math.PI * 2);
            this.ball.rotation.z = this.ball.rotation.z % (Math.PI * 2);
        }

        // Hareketi güncelle
        this.updateMovement();
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
        this.gl = gl;
        this.maze = maze;
        this.textures = {};
        this.setupShaders();
        this.loadTextures();
        this.setupBuffers();
    }

    setupShaders() {
        const vsSource = `
            attribute vec3 aVertexPosition;
            attribute vec4 aVertexColor;
            attribute vec3 aVertexNormal;
            attribute vec2 aTexCoord;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            varying vec4 vColor;
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vTexCoord;
            void main(void) {
                vColor = aVertexColor;
                vNormal = aVertexNormal;
                vPosition = (uModelViewMatrix * vec4(aVertexPosition, 1.0)).xyz;
                vTexCoord = aTexCoord;
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
            }
        `;

        const fsSource = `
            precision mediump float;
            varying vec4 vColor;
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vTexCoord;
            uniform sampler2D uTexture;
            void main(void) {
                vec3 lightDir = normalize(vec3(0.0, 0.0, 1.0));
                vec3 viewDir = normalize(-vPosition);
                float ambient = 0.3;
                float diff = max(dot(vNormal, lightDir), 0.0);
                float specularStrength = 0.7;
                vec3 reflectDir = reflect(-lightDir, vNormal);
                float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
                float lighting = ambient + 0.5 * diff + specularStrength * spec;
                vec4 texColor = texture2D(uTexture, vTexCoord);
                gl_FragColor = vec4(vColor.rgb * texColor.rgb * lighting, vColor.a * texColor.a);
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

    loadTextures() {
        this.textures.floor = this.loadTexture('assets/floor.jpg');
        this.textures.wall = this.loadTexture('assets/wall.jpg');
        this.textures.ball = this.loadTexture('assets/ball.jpg');
    }

    loadTexture(url) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // Geçici 1x1 pixel
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128,128,128,255]));
        const image = new Image();
        image.onload = function() {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            gl.generateMipmap(gl.TEXTURE_2D);
        };
        image.src = url;
        return texture;
    }

    setupBuffers() {
        const vertices = [];
        const colors = [];
        const normals = [];
        const uvs = [];
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
                    // Her yüz için 2 üçgen ve normal ve UV
                    // Ön yüz (z1)
                    vertices.push(
                        x0, y0, z1,  x1, y0, z1,  x1, y1, z1,
                        x0, y0, z1,  x1, y1, z1,  x0, y1, z1
                    );
                    for (let i = 0; i < 6; i++) normals.push(0, 0, 1);
                    uvs.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1);
                    // Arka yüz (z0)
                    vertices.push(
                        x0, y1, z0,  x1, y1, z0,  x1, y0, z0,
                        x0, y1, z0,  x1, y0, z0,  x0, y0, z0
                    );
                    for (let i = 0; i < 6; i++) normals.push(0, 0, -1);
                    uvs.push(0,1, 1,1, 1,0, 0,1, 1,0, 0,0);
                    // Sağ yüz
                    vertices.push(
                        x1, y0, z0,  x1, y1, z0,  x1, y1, z1,
                        x1, y0, z0,  x1, y1, z1,  x1, y0, z1
                    );
                    for (let i = 0; i < 6; i++) normals.push(1, 0, 0);
                    uvs.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1);
                    // Sol yüz
                    vertices.push(
                        x0, y0, z1,  x0, y1, z1,  x0, y1, z0,
                        x0, y0, z1,  x0, y1, z0,  x0, y0, z0
                    );
                    for (let i = 0; i < 6; i++) normals.push(-1, 0, 0);
                    uvs.push(0,1, 1,1, 1,0, 0,1, 1,0, 0,0);
                    // Üst yüz
                    vertices.push(
                        x0, y1, z1,  x1, y1, z1,  x1, y1, z0,
                        x0, y1, z1,  x1, y1, z0,  x0, y1, z0
                    );
                    for (let i = 0; i < 6; i++) normals.push(0, 1, 0);
                    uvs.push(0,1, 1,1, 1,0, 0,1, 1,0, 0,0);
                    // Alt yüz
                    vertices.push(
                        x0, y0, z0,  x1, y0, z0,  x1, y0, z1,
                        x0, y0, z0,  x1, y0, z1,  x0, y0, z1
                    );
                    for (let i = 0; i < 6; i++) normals.push(0, -1, 0);
                    uvs.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1);
                    for (let i = 0; i < 36; i++) {
                        colors.push(0.7, 0.7, 0.7, 1.0);
                    }
                }
            }
        }
        // --- ZEMİN (PLANE) ---
        this.floorStartIdx = vertices.length / 3;
        // Plane: (zemin maze'nin altına tam oturacak şekilde)
        const fx0 = offsetX, fy0 = offsetY, fx1 = offsetX + this.maze.width, fy1 = offsetY + this.maze.height, fz = 0;
        vertices.push(
            fx0, fy0, fz,
            fx1, fy0, fz,
            fx1, fy1, fz,
            fx0, fy0, fz,
            fx1, fy1, fz,
            fx0, fy1, fz
        );
        for (let i = 0; i < 6; i++) normals.push(0, 0, 1);
        uvs.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1);
        for (let i = 0; i < 6; i++) colors.push(1,1,1,1);
        this.floorVertexCount = 6;
        // --- TOPU KÜRE OLARAK EKLE ---
        const player = this.maze.ball.position;
        const px = player.x + offsetX + 0.5;
        const py = player.y + offsetY + 0.5;
        const pz = 0.5;
        const radius = 0.3;
        const latitudeBands = 30;
        const longitudeBands = 30;
        const startIdx = vertices.length / 3;

        // Küre için vertex'leri oluştur
        for (let latNumber = 0; latNumber <= latitudeBands; latNumber++) {
            const theta = latNumber * Math.PI / latitudeBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let longNumber = 0; longNumber <= longitudeBands; longNumber++) {
                const phi = longNumber * 2 * Math.PI / longitudeBands;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                const x = px + radius * cosPhi * sinTheta;
                const y = py + radius * sinPhi * sinTheta;
                const z = pz + radius * cosTheta;

                // Normal vektörler (birim küre için pozisyon - merkez = normal)
                const nx = cosPhi * sinTheta;
                const ny = sinPhi * sinTheta;
                const nz = cosTheta;

                // Texture koordinatları
                const u = 1 - (longNumber / longitudeBands);
                const v = 1 - (latNumber / latitudeBands);

                vertices.push(x, y, z);
                normals.push(nx, ny, nz);
                colors.push(1.0, 1.0, 1.0, 1.0);
                uvs.push(u, v);
            }
        }

        // Üçgenleri oluştur
        for (let latNumber = 0; latNumber < latitudeBands; latNumber++) {
            for (let longNumber = 0; longNumber < longitudeBands; longNumber++) {
                const first = (latNumber * (longitudeBands + 1)) + longNumber + startIdx;
                const second = first + longitudeBands + 1;

                // İlk üçgen
                vertices.push(
                    vertices[first * 3], vertices[first * 3 + 1], vertices[first * 3 + 2],
                    vertices[(first + 1) * 3], vertices[(first + 1) * 3 + 1], vertices[(first + 1) * 3 + 2],
                    vertices[second * 3], vertices[second * 3 + 1], vertices[second * 3 + 2]
                );

                // İkinci üçgen
                vertices.push(
                    vertices[(first + 1) * 3], vertices[(first + 1) * 3 + 1], vertices[(first + 1) * 3 + 2],
                    vertices[(second + 1) * 3], vertices[(second + 1) * 3 + 1], vertices[(second + 1) * 3 + 2],
                    vertices[second * 3], vertices[second * 3 + 1], vertices[second * 3 + 2]
                );

                // Her vertex için normal, renk ve UV değerlerini ekle
                for (let i = 0; i < 6; i++) {
                    normals.push(
                        normals[first * 3], normals[first * 3 + 1], normals[first * 3 + 2]
                    );
                    colors.push(1.0, 1.0, 1.0, 1.0);
                }

                // UV koordinatları
                const u1 = 1 - (longNumber / longitudeBands);
                const v1 = 1 - (latNumber / latitudeBands);
                const u2 = 1 - ((longNumber + 1) / longitudeBands);
                const v2 = 1 - ((latNumber + 1) / latitudeBands);

                // İlk üçgen UV'leri
                uvs.push(u1, v1);
                uvs.push(u2, v1);
                uvs.push(u1, v2);

                // İkinci üçgen UV'leri
                uvs.push(u2, v1);
                uvs.push(u2, v2);
                uvs.push(u1, v2);
            }
        }

        this.playerStartIdx = startIdx;
        this.playerVertexCount = (vertices.length / 3) - startIdx;
        // ---
        this.vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
        this.vertexBuffer.numItems = vertices.length / 3;
        this.colorBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STATIC_DRAW);
        this.normalBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(normals), this.gl.STATIC_DRAW);
        this.uvBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uvBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(uvs), this.gl.STATIC_DRAW);
    }

    render() {
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.gl.useProgram(this.shaderProgram);

        const aspect = this.gl.canvas.width / this.gl.canvas.height;
        const projectionMatrix = createPerspectiveMatrix(Math.PI / 4, aspect, 0.1, 100.0);
        
        const offsetX = -this.maze.width / 2;
        const offsetY = -this.maze.height / 2;
        const player = this.maze.ball.position;
        const px = player.x + offsetX + 0.5;
        const py = player.y + offsetY + 0.5;

        // Kamera pozisyonunu topun üzerine yerleştir
        const cameraHeight = 10; // Kamera yüksekliği
        const eye = [px, py, cameraHeight]; // Kamera pozisyonu
        const center = [px, py, 0]; // Bakış noktası (top)
        const up = [0, 1, 0]; // Yukarı vektörü

        const modelViewMatrix = createLookAtMatrix(eye, center, up);

        // Shader'a matrisleri gönder
        const uProjectionMatrix = this.gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix');
        const uModelViewMatrix = this.gl.getUniformLocation(this.shaderProgram, 'uModelViewMatrix');
        this.gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix);
        this.gl.uniformMatrix4fv(uModelViewMatrix, false, modelViewMatrix);

        // Top için dönüş matrisini güncelle
        this.maze.updateRotation();

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

        const normalAttributeLocation = this.gl.getAttribLocation(this.shaderProgram, 'aVertexNormal');
        if (normalAttributeLocation !== -1) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
            this.gl.vertexAttribPointer(normalAttributeLocation, 3, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(normalAttributeLocation);
        }

        const texCoordAttributeLocation = this.gl.getAttribLocation(this.shaderProgram, 'aTexCoord');
        if (texCoordAttributeLocation !== -1) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uvBuffer);
            this.gl.vertexAttribPointer(texCoordAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(texCoordAttributeLocation);
        }

        // --- ZEMİNİ ÇİZ ---
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.floor);
        this.gl.uniform1i(this.gl.getUniformLocation(this.shaderProgram, 'uTexture'), 0);
        this.gl.drawArrays(this.gl.TRIANGLES, this.floorStartIdx, this.floorVertexCount);

        // --- DUVARLARI ÇİZ ---
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.wall);
        this.gl.uniform1i(this.gl.getUniformLocation(this.shaderProgram, 'uTexture'), 0);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.floorStartIdx);

        // --- TOPU ÇİZ ---
        // Top için dönüş matrisini uygula
        const ballModelViewMatrix = new Float32Array(16);
        for (let i = 0; i < 16; i++) {
            ballModelViewMatrix[i] = modelViewMatrix[i];
        }
        
        // Dönüş matrislerini uygula
        const rotateX = this.maze.ball.rotation.x;
        const rotateY = this.maze.ball.rotation.y;
        const rotateZ = this.maze.ball.rotation.z;
        
        // X ekseni etrafında dönüş
        const cosX = Math.cos(rotateX);
        const sinX = Math.sin(rotateX);
        const rotationX = new Float32Array([
            1, 0, 0, 0,
            0, cosX, -sinX, 0,
            0, sinX, cosX, 0,
            0, 0, 0, 1
        ]);
        
        // Y ekseni etrafında dönüş
        const cosY = Math.cos(rotateY);
        const sinY = Math.sin(rotateY);
        const rotationY = new Float32Array([
            cosY, 0, sinY, 0,
            0, 1, 0, 0,
            -sinY, 0, cosY, 0,
            0, 0, 0, 1
        ]);
        
        // Z ekseni etrafında dönüş
        const cosZ = Math.cos(rotateZ);
        const sinZ = Math.sin(rotateZ);
        const rotationZ = new Float32Array([
            cosZ, -sinZ, 0, 0,
            sinZ, cosZ, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);

        // Dönüş matrislerini uygula
        this.gl.uniformMatrix4fv(uModelViewMatrix, false, ballModelViewMatrix);
        
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.ball);
        this.gl.uniform1i(this.gl.getUniformLocation(this.shaderProgram, 'uTexture'), 0);
        this.gl.drawArrays(this.gl.TRIANGLES, this.playerStartIdx, this.playerVertexCount);
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

    setupEventListeners() {
        // Tuşa basıldığında
        document.addEventListener('keydown', (e) => {
            this.pressedKeys.add(e.key.toLowerCase());
            this.updateMovement();
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
