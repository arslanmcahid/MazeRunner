class Renderer {
    constructor(gl, maze) {
        this.gl = gl;
        this.maze = maze;
        this.setupShaders();
        this.setupBuffers();
    }

    setupShaders() {
        // Vertex shader
        const vsSource = `
            attribute vec3 aVertexPosition;
            attribute vec4 aVertexColor;
            varying vec4 vColor;
            
            void main(void) {
                gl_Position = vec4(aVertexPosition, 1.0);
                vColor = aVertexColor;
            }
        `;

        // Fragment shader
        const fsSource = `
            precision mediump float;
            varying vec4 vColor;
            
            void main(void) {
                gl_FragColor = vColor;
            }
        `;

        // Shader programını oluştur
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
        // Labirent duvarları için vertex buffer
        const vertices = [];
        const colors = [];
        
        // Labirent duvarlarını oluştur
        for (let y = 0; y < this.maze.height; y++) {
            for (let x = 0; x < this.maze.width; x++) {
                if (this.maze.grid[y][x] === 1) {
                    // Duvar için kare oluştur
                    const wallVertices = [
                        x, y, 0,
                        x+1, y, 0,
                        x+1, y+1, 0,
                        x, y+1, 0
                    ];
                    
                    vertices.push(...wallVertices);
                    
                    // Duvar rengi (koyu gri)
                    const wallColor = [0.3, 0.3, 0.3, 1.0];
                    colors.push(...wallColor, ...wallColor, ...wallColor, ...wallColor);
                }
            }
        }
        
        // Vertex buffer
        this.vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
        this.vertexBuffer.numItems = vertices.length / 3; // Vertex sayısını kaydet
        
        // Color buffer
        this.colorBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STATIC_DRAW);
    }

    render() {
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        // Shader programını kullan
        this.gl.useProgram(this.shaderProgram);
        
        // Vertex pozisyonlarını ayarla
        const positionAttributeLocation = this.gl.getAttribLocation(this.shaderProgram, 'aVertexPosition');
        if (positionAttributeLocation === -1) {
            console.error('aVertexPosition attribute bulunamadı');
            return;
        }
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.vertexAttribPointer(positionAttributeLocation, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        
        // Renkleri ayarla
        const colorAttributeLocation = this.gl.getAttribLocation(this.shaderProgram, 'aVertexColor');
        if (colorAttributeLocation === -1) {
            console.error('aVertexColor attribute bulunamadı');
            return;
        }
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.vertexAttribPointer(colorAttributeLocation, 4, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(colorAttributeLocation);
        
        // Çizim
        const vertexCount = this.vertexBuffer.numItems || 4;
        this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, vertexCount);
    }
} 