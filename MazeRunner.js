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
        
        // Initialize Box2D world with zero gravity
        this.world = new b2World(new b2Vec2(0, 0), true);
        
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
        const force = new b2Vec2(dx * 1.0, dy * 1.0); // Reduced force magnitude from 2 to 1
        this.ballBody.ApplyForce(force, this.ballBody.GetWorldCenter());
        this.moveDirection = { x: dx, y: dy };
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
        const maxSpeed = 3.0; // Maximum speed limit
        if (moveDistance > maxSpeed) {
            vel.Multiply(maxSpeed / moveDistance);
            this.ballBody.SetLinearVelocity(vel);
        }
        
        if (moveDistance > 0.001) {
            const rotationAngle = (moveDistance / this.ball.radius) * this.ball.rotationSpeed * deltaTime;
            const normalizedVelX = vel.x / moveDistance;
            const normalizedVelY = vel.y / moveDistance;
            
            this.ball.rotation.y += rotationAngle * normalizedVelX;
            this.ball.rotation.x -= rotationAngle * normalizedVelY;
        }

        // Smooth camera movement with adjusted lerp factors
        const targetX = this.ball.position.x;
        const targetY = this.ball.position.y;
        
        this.camera.position.x += (targetX - this.camera.position.x) * this.camera.lerpFactor;
        this.camera.position.y += (targetY - this.camera.position.y) * this.camera.lerpFactor;
        
        // Smooth camera height adjustment with separate lerp factor
        const targetHeight = 10 + moveDistance * 1.5;
        this.camera.height += (targetHeight - this.camera.height) * this.camera.heightLerpFactor;

        // Apply stronger friction to ball
        vel.Multiply(0.90); // Increased friction from 0.95 to 0.90
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
        this.maze.updateMovement();

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
