/**
 * 暗晶着色器 —— 深紫黑色神秘晶体
 */
export const crystalVertexShader = `
  uniform float uTime;
  uniform float uEnergy;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normal;
    vPosition = position;
    
    float pulse = sin(uTime * 2.0 + position.y * 3.0) * uEnergy * 0.1;
    vec3 displaced = position + normal * pulse;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

export const crystalFragmentShader = `
  uniform float uTime;
  uniform float uEnergy;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 crystalDark   = vec3(0.08, 0.05, 0.15);
    vec3 crystalPurple = vec3(0.35, 0.1, 0.6);
    vec3 crystalGlow   = vec3(0.6, 0.3, 1.0);

    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 3.0);
    float pulse = sin(uTime * 1.5) * 0.5 + 0.5;
    
    vec3 color = mix(crystalDark, crystalPurple, fresnel);
    color += crystalGlow * fresnel * uEnergy * pulse;
    
    float alpha = 0.8 + fresnel * 0.15;
    gl_FragColor = vec4(color, alpha);
  }
`;
