
import { createShader, createProgram, resizeCanvasToDisplaySize } from './webgl-utils.js'

function getIdColor(id) {
  const R = (id & 0xFF0000) >> 16 / 255; // Red
  const G = (id & 0x00FF00) >> 8 / 255;  // Green
  const B = (id & 0x0000FF) / 255;       // Blue
  return  {r:R, g:G, b:B};
}


function getIdFromColor(pixelData) {
  const r = pixelData[0];
  const g = pixelData[1];
  const b = pixelData[2];

  // Reverse the ID encoding
  const id = (r << 16) | (g << 8) | b;
  return id;
}

function get_rotation_matrix(theta)
{
  return new Float32Array([Math.cos(theta), Math.sin(theta), 0, 
                          -Math.sin(theta), Math.cos(theta), 0,
                            0, 0 , 1]);
}

function get_translation_matrix(x, y)
{
  return new Float32Array([1, 0, 0,
                           0, 1, 0,
                           x, y, 1]);
}

function get_scale_matrix(sx, sy)
{
  return new Float32Array([sx, 0, 0,
                           0, sy, 0,
                           0, 0, 1]);
}

class Point
{
  constructor(id, trans, scale, theta, color){

    this.color = {r:color[0], g:color[1], b:color[2], a:color[3]}
    this.ID = id;

    this.Translation = get_translation_matrix(trans[0], trans[1]);
    this.Rotation = get_rotation_matrix(theta);
    this.Scale = get_scale_matrix(scale[0], scale[1]);
  }

  get translation(){ return this.Translation;}
  get scale(){ return this.Scale;}
  get rotation(){ return this.Rotation;}

  update_rotation_matrix(theta){this.Rotation = get_rotation_matrix(theta);}
  update_translation_matrix(trans){this.Translation = get_translation_matrix(trans[0], trans[1]);}
}

class RenderPoints //A square :b
{
  constructor()
  {
      this.VAO = null;
      this.Shader = null;
      this.colorLocation = null;
      this.rotationLocation = null;
      this.translationLocation = null;
      this.scaleLocation = null;

      
      //Pick stuff
      this.pickLocation = null;
      this.pickSacleLocation = null;
      this.pickTransLocation = null;

  }

  static async build(gl)
  {
     const instance = new RenderPoints();

      // ---------------- VAO construction. First so it links the other vbuffers automatically
      var vao = gl.createVertexArray();
      gl.bindVertexArray(vao); // Make it current

      // Screen info
    var vertices = [
      // XY
      -1, -1,
      -1,  1,
       1, -1,
       1,  1,
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


      // ------------------ Shader construction -------------
      var vertexShader = await createShader(gl, gl.VERTEX_SHADER, "./simple.vshader");
      var fragmentShader = await createShader(gl, gl.FRAGMENT_SHADER, "./simple.fshader");
      var program = await createProgram(gl, vertexShader, fragmentShader);



      // Assign the created VAO and Shader to the instance
      instance.VAO = vao;
      instance.Shader = program;

      //Save shader properties
      gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), gl.canvas.width, gl.canvas.height);
      instance.colorLocation = gl.getUniformLocation(program, "u_color");
      instance.rotationLocation = gl.getUniformLocation(program, "u_rot");
      instance.translationLocation = gl.getUniformLocation(program, "u_trans");
      instance.scaleLocation = gl.getUniformLocation(program, "u_scale");

      // Pick stuff
      instance.pickLocation = gl.getUniformLocation(program, "u_pick");
      instance.pickScaleLocation = gl.getUniformLocation(program, "u_pick_scale");
      instance.pickTransLocation = gl.getUniformLocation(program, "u_pick_trans");


      // Return the instance
      return instance;
  }


  normal_draw(gl, point)
  {
    gl.bindVertexArray(this.VAO);
    gl.useProgram(this.Shader);

    gl.uniform4f(this.colorLocation, point.color.r, point.color.g, point.color.b, point.color.a);
    gl.uniform1f(this.pickLocation, 0.0);
    gl.uniformMatrix3fv(this.rotationLocation, false, point.rotation);
    gl.uniformMatrix3fv(this.translationLocation, false, point.translation);
    gl.uniformMatrix3fv(this.scaleLocation, false, point.scale);


    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
  pick_draw(gl, point, pw, ph, ndcX, ndcY)
  {

    var color =  getIdColor(point.ID);
    
    gl.uniformMatrix3fv(this.rotationLocation, false, point.rotation);
    gl.uniformMatrix3fv(this.translationLocation, false, point.translation);
    gl.uniformMatrix3fv(this.scaleLocation, false, point.scale);

    gl.uniform4f(this.colorLocation, color.r, color.g, color.b, 1.0);
    gl.uniform1f(this.pickLocation, 1.0);
    gl.uniformMatrix3fv(this.pickScaleLocation, false, new Float32Array([1./pw,0,0,  0, 1./ph, 0,  0,0,1]));
    gl.uniformMatrix3fv(this.pickTransLocation, false, new Float32Array([1,0,0,  0,1,0,  -ndcX, -ndcY, 1])); //Va por columnas

    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
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



  // Fills the buffer with the values that define a rectangle.
   

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

  

  // ------------------------- Construct necesary VAOS ------------------------

  const renderPointsInstance = await RenderPoints.build(gl);
  
  

  let theta = 0.0;


  //Mouse stuff
  let mouseX = -1;
  let mouseY = -1;
  var isDragging = false;

  const devicePixelRatio = window.devicePixelRatio || 1;
  const pixelWidth = 1 / (canvas.width * devicePixelRatio);
  const pixelHeight = 1 / (canvas.height * devicePixelRatio);

  // To move objects
  var pixelX;
  var pixelY;
  var mouse_ndcX;
  var mouse_ndcY;

  
  


  
  // New buffer to select objects
  var curr_ID = -1;
  var select_obj =   buildFrameBuffer_ColorOnly(gl, 0, 1,1);


  // ------------ Point definition ----------

  var points = [] // No scope
  points[0] = new Point(1, [-0.5, -0.5], [.1,.1], 1, [0, 0, 1, 1]);
  points[1] = new Point(2, [ 0.5, -0.5], [.1,.1], 1, [0, 0, 1, 1]);
  points[2] = new Point(3, [ 0.5,  0.5], [.1,.1], 1, [0, 0, 1, 1]);
  points[3] = new Point(4, [-0.5,  0.5], [.1,.1], 1, [0, 0, 1, 1]);


  // --------- Render cycle ------
  requestAnimationFrame(drawScene);
  function drawScene()
  {


    // See why if I delete this part it stops rendering
    pixelX = mouseX * gl.canvas.width / gl.canvas.clientWidth;
    pixelY = gl.canvas.height - mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;

    mouse_ndcX = pixelX / gl.canvas.width * 2 - 1; 
    mouse_ndcY = pixelY / gl.canvas.height * 2 - 1;



    //Render to the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, canvas.width, canvas.height);

    for(let p of points){
      p.update_rotation_matrix(theta);
      renderPointsInstance.normal_draw(gl, p);
    }

    // Render to one pixel so we can determine which object is being click
    gl.bindFramebuffer(gl.FRAMEBUFFER, select_obj.ID); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, 1, 1);
    for(let p of points){
      renderPointsInstance.pick_draw(gl, p, pixelWidth, pixelHeight, mouse_ndcX, mouse_ndcY);
    }

    theta += 0.1;
    requestAnimationFrame(drawScene);

  }

  gl.canvas.addEventListener('mousemove', (e) => {
     const rect = canvas.getBoundingClientRect();
     mouseX = e.clientX - rect.left;
     mouseY = e.clientY - rect.top;


     if(isDragging && curr_ID >= 0)
     {
        pixelX = mouseX * gl.canvas.width / gl.canvas.clientWidth;
        pixelY = gl.canvas.height - mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;
        mouse_ndcX = pixelX / gl.canvas.width * 2 - 1; 
        mouse_ndcY = pixelY / gl.canvas.height * 2 - 1;

        console.log(curr_ID)
        points[curr_ID].update_translation_matrix([mouse_ndcX, mouse_ndcY]);

     }
  });

  canvas.addEventListener('mousedown', (e) => {
    
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    // Read the pixel color at the mouse position
    const pixelData = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);

    curr_ID = getIdFromColor(pixelData) - 1;
    console.log('Picked object ID:', curr_ID);


    isDragging = true;

  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });


}

main();