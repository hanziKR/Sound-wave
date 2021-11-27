window.addEventListener("DOMContentLoaded", async () => {
    const audio = document.getElementById("audio");

    document.getElementById("file").addEventListener("change", function(event) {
        if (!event.target.files.length) return;

        const url = URL.createObjectURL(event.target.files[0]);

        audio.addEventListener("load", () => {
            URL.revokeObjectURL(url);
        });
        audio.src = url;
        audio.load();
    });

    const cubeVertices = [
        -1, 0,
        1, 0,
        1, 1,
        -1, 1,
    ];
    const indices = [
        0, 1, 2,
        0, 2, 3
    ];
    
    const canvas = document.getElementById("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) {
        alert("This browser does not support webgl.");
        return;
    }

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            return shader;
        }
        console.log(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return undefined;
    }
    function loadShader() {
        const vertexShaderSource = document.getElementById("vs").text;
        const fragmentShaderSource = document.getElementById("fs").text;
        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

        if (vertexShader == undefined) {
            return undefined;
        }
        if (fragmentShader == undefined) {
            return undefined;
        }
        
        const program = gl.createProgram();

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        const success = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (!success) {
            console.log(gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return undefined;
        }
        return program;
    }
    const program = loadShader();
    if (program == undefined) {
        alert("Unable to load shaders.");
        return;
    }
    gl.useProgram(program);

    const aposLoc = gl.getAttribLocation(program, "apos");
    const projectionLoc = gl.getUniformLocation(program, "projection");
  
    let buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeVertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aposLoc);
    gl.vertexAttribPointer(aposLoc, 2, gl.FLOAT, false, 0, 0);

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    gl.canvas.width = canvas.clientWidth;
    gl.canvas.height = canvas.clientHeight;

    const angleLog = gl.getUniformLocation(program, "angle");
    const widthLoc = gl.getUniformLocation(program, "width");
    const height1Loc = gl.getUniformLocation(program, "height1");
    const height2Loc = gl.getUniformLocation(program, "height2");
    const color1Loc = gl.getUniformLocation(program, "color1");
    const color2Loc = gl.getUniformLocation(program, "color2");
    
    function toRadian(degree) {
        return Math.PI / 180 * degree;
    }

    let context, src, analyser;
    
    audio.addEventListener("play", function () {
        context = context || new AudioContext();
        src = src || context.createMediaElementSource(audio);

        analyser = analyser || context.createAnalyser();

        src.connect(analyser);
        analyser.connect(context.destination);
        // analyser.fftSize = 64;
        // analyser.fftSize = 512;
        analyser.fftSize = 256;

        const bufferLength = analyser.frequencyBinCount * 0.5;
        let dataArray = new Uint8Array(bufferLength);

        const barWidth = (360 / bufferLength) / 2;

        const fov = toRadian(60);

        function renderFrame() {
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            const aspect = canvas.clientWidth / canvas.clientHeight;
            const projection = m4.perspective(fov, aspect, 0.0001, 500);

            const camera = m4.lookAt([0, 1, 10], [0, 1, 0], [0, 1, 0]);
            const view = m4.inverse(camera);

            const worldViewProjection = m4.multiply(projection, view);
            gl.uniformMatrix4fv(projectionLoc, false, worldViewProjection);
            gl.uniform1f(widthLoc, barWidth);

            analyser.getByteFrequencyData(dataArray);
            
            for (let i = 0; i < 360; i++) {
                gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
            }
            for (let i = 0; i < bufferLength; i++) {
                let index1 = i;
                let index2 = (i == bufferLength - 1 ? 0 : i + 1);

                let barHeight1 = dataArray[index1];
                let barHeight2 = dataArray[index2];

                const distance1 = (index1 > (bufferLength / 2) ? (bufferLength - index1) / (bufferLength / 2) : index1 / (bufferLength / 2));
                const distance2 = (index2 > (bufferLength / 2) ? (bufferLength - index2) / (bufferLength / 2) : index2 / (bufferLength / 2));

                const rgb1 = [10, 250 * distance1, barHeight1 + (25 * distance1)];
                const rgb2 = [10, 250 * distance2, barHeight2 + (25 * distance2)];
                
                gl.uniform1f(angleLog, 360 * (index1 / bufferLength));
                gl.uniform1f(height1Loc, (barHeight1 * 1.25) / 100);
                gl.uniform1f(height2Loc, (barHeight2 * 1.25) / 100);
                gl.uniform3fv(color1Loc, rgb1);
                gl.uniform3fv(color2Loc, rgb2);
                
                gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
            }
            requestAnimationFrame(renderFrame);
        }

        audio.play();
        renderFrame();
    });
});
