
import { createShader, createProgram, resizeCanvasToDisplaySize } from './webgl-utils.js'

function getIdColor(id) {
  const r = (id & 0xFF0000) >> 16 / 255; // Red
  const g = (id & 0x00FF00) >> 8 / 255;  // Green
  const b = (id & 0x0000FF) / 255;       // Blue
  return  {r, g, b};
}


function getIdFromColor(pixelData) {
  const r = pixelData[0];
  const g = pixelData[1];
  const b = pixelData[2];

  // Reverse the ID encoding
  const id = (r << 16) | (g << 8) | b;
  return id;
}

function createAndSetupTexture(gl, i, data)
{
  //------- Texture stuff ------
  // Create a texture.
  var texture = gl.createTexture();
  
  // make unit i the active texture unit
  gl.activeTexture(gl.TEXTURE0 + i);
  
  // Bind texture to 'texture unit i' 2D bind point
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the parameters so we don't need mips and so we're not filtering
  // and we don't repeat
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);


  return texture;
}


function buildFrameBuffer_ColorOnly(gl, i, width, height)
{
  var fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  // Tell WebGL how to convert from clip space to pixels
  //gl.viewport(0, 0, width, height);

  var texture = createAndSetupTexture(gl, i);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  // Bind the texture as where color is going to be written
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  //console.log(gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE)
  //Unbind
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {ID: fbo,
          ColorTexture: texture}
}




// Returns a random integer from 0 to range - 1.
function randomInt(range) {
  return Math.floor(Math.random() * range);
}


function get_rotation_matrix(theta)
{
  return new Float32Array([Math.cos(theta), Math.sin(theta), 0, 
          -Math.sin(theta), Math.cos(theta), 0,
          0, 0 , 1]);
}

  // Fills the buffer with the values that define a rectangle.
   
function setRectangle(gl, x, y, width, height) {
    var x1 = x - width / 2;
    var x2 = x + width / 2;
    var y1 = y - height / 2;
    var y2 = y + height / 2;
   
    // NOTE: gl.bufferData(gl.ARRAY_BUFFER, ...) will affect
    // whatever buffer is bound to the `ARRAY_BUFFER` bind point
    // but so far we only have one buffer. If we had more than one
    // buffer we'd want to bind that buffer to `ARRAY_BUFFER` first.
   
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
       x1, y1,
       x2, y1,
       x1, y2,
       x1, y2,
       x2, y1,
       x2, y2]), gl.STATIC_DRAW);
}

async function main() {
  var canvas = document.querySelector("#c");
  //canvas.width = 400;
  //canvas.height = 300;


  var gl = canvas.getContext("webgl2");
  if (!gl) {
  	throw new Error("Error. No se pudo cargar WebGL2");
  }
  // Canvas stuff
  resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); // [-1, 1] maps to [0, canvas.width/height]
  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Construction of shaders
  var vertexShader = await createShader(gl, gl.VERTEX_SHADER, "./simple.vshader");
  var fragmentShader = await createShader(gl, gl.FRAGMENT_SHADER, "./simple.fshader");

  var program = await createProgram(gl, vertexShader, fragmentShader);


    // ---------------- VAO construction. First so it links the other vbuffers automatically
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao); // Make it current

    // Screen info
  var vertices = [
    // XY
    -.1, -.1,
    -.1,  .1,
     .1, -.1,
     .1,  .1,
  ];

    var indices = [
      0, 1, 2,
      1, 2, 3,
    ]

    var vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);


    // ------ Atribute stuff -------
    gl.enableVertexAttribArray(0);

    /*
    var attribute
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 4*2;      // Size of the vertex
    var offset = 0;        // start at the beginning of the buffer
    */
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4*2, 0);



    // Bind the attribute/buffer set we want.
  gl.bindVertexArray(vao);



  // Tell it to use our program (pair of shaders)
  gl.useProgram(program);
  var resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
  var colorLocation = gl.getUniformLocation(program, "u_color");
  var matrixLocation = gl.getUniformLocation(program, "u_matrix");
  gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

  

  //setRectangle(gl, 0, 0, 1, 1);
  gl.uniform4f(colorLocation, 1.0, 0.5, 0.8, 1);

  let theta = 0.0;


  //Mouse stuff
  let mouseX = -1;
  let mouseY = -1;
  var pixelX = mouseX * gl.canvas.width / gl.canvas.clientWidth;
  var pixelY = gl.canvas.height - mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;
  var data = new Uint8Array(4);
    


  var select_obj =   buildFrameBuffer_ColorOnly(gl, 0, 1,1);
  const devicePixelRatio = window.devicePixelRatio || 1;
  const pixelWidth = 1 / (canvas.width * devicePixelRatio);
  const pixelHeight = 1 / (canvas.height * devicePixelRatio);


  // --------- Render cycle ------
  requestAnimationFrame(drawScene);
  function drawScene()
  {


    // Position of the pixel
    pixelX = mouseX * gl.canvas.width / gl.canvas.clientWidth;
    pixelY = gl.canvas.height - mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;

    var ndcX = pixelX / gl.canvas.width * 2 - 1; 
    var ndcY = pixelY / gl.canvas.height * 2 - 1;

    //Render to the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform4f(colorLocation, 1.0, 0.5, 0.8, 1);
    gl.uniform1f(gl.getUniformLocation(program, "u_pick"), 0.0);
    gl.uniformMatrix3fv(matrixLocation, false, get_rotation_matrix(theta));
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

  

    // Render to one pixel so we can determine which object is being click
    gl.bindFramebuffer(gl.FRAMEBUFFER, select_obj.ID); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, 1, 1);
    var {r,g,b} =  getIdColor(10);
    gl.uniform4f(colorLocation,r,g,b, 0.0);
    gl.uniform1f(gl.getUniformLocation(program, "u_pick"), 1.0);
    gl.uniformMatrix3fv(gl.getUniformLocation(program, "u_scale"), false, new Float32Array([1./pixelWidth,0,0,  0, 1./pixelHeight,0,  0,0,1]));
    gl.uniformMatrix3fv(gl.getUniformLocation(program, "u_trans"), false, new Float32Array([1,0,0,  0,1,0,  -ndcX, -ndcY,1])); //Va por columnas

    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    const pixelData = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
    //console.log(pixelData);




    theta += 0.1;
    requestAnimationFrame(drawScene);

  }

  gl.canvas.addEventListener('mousemove', (e) => {
     const rect = canvas.getBoundingClientRect();
     mouseX = e.clientX - rect.left;
     mouseY = e.clientY - rect.top;
  });

  gl.canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = rect.bottom - event.clientY; // Flip Y for WebGL

    // Read the pixel color at the mouse position
    const pixelData = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);

    const id = getIdFromColor(pixelData);
    console.log('Picked object ID:', id);
  });

}

main();