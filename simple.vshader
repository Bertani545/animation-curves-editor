#version 300 es
 
// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
layout(location = 0) in vec2 a_position;
uniform vec2 u_resolution;
uniform mat3 u_rot;
uniform mat3 u_scale;
uniform mat3 u_trans;


// Pick stuff
uniform float u_pick;
uniform mat3 u_pick_scale;
uniform mat3 u_pick_trans;




// all shaders have a main function
void main() {
  
  vec3 pos = u_trans * u_scale * u_rot * vec3(a_position, 1.0); 

  //For the pick object
  pos =   u_pick * (u_pick_scale * u_pick_trans * pos) + (1. - u_pick) * pos;


  //vec2 pos_clipSpace = ((pos.xy / u_resolution) * 2.0 - 1.0) * vec2(1.0, -1.0); //Canvas goes from 0 to 1 in y axis
 
  // gl_Position is a special variable a vertex shader
  // is responsible for setting
  
  gl_Position = vec4(pos.xy , 0.0, 1.0);
  //gl_Position = vec4(pos_clipSpace , 0.0, 1.0);
}