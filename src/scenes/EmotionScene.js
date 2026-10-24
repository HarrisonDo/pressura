/**
 * EmotionScene —— 核心 Three.js 场景管理器
 * 负责：场景初始化、实体生长动画、粒子系统、频谱环
 */
import * as THREE from 'three';
import { EMOTION_TYPES } from '../hooks/useAudioAnalyzer';
import { iceVertexShader, iceFragmentShader } from '../shaders/iceShader';
import { fireVertexShader, fireFragmentShader } from '../shaders/fireShader';
import { stoneVertexShader, stoneFragmentShader } from '../shaders/stoneShader';
import { crystalVertexShader, crystalFragmentShader } from '../shaders/crystalShader';

export class EmotionScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.currentEmotion = EMOTION_TYPES.CRYSTAL;
    this.targetScale = 0.01;
    this.currentScale = 0.01;
    this.isFrozen = false;

    // 鼠标交互
    this.mouse = new THREE.Vector2();
    this.isDragging = false;
    this.prevMouse = new THREE.Vector2();
    this.rotationVelocity = new THREE.Vector2();

    this._init();
    this._bindEvents();
  }

  _init() {
    const { width, height } = this.canvas.getBoundingClientRect();

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(width || window.innerWidth, height || window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // 场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.scene.fog = new THREE.FogExp2(0x050508, 0.08);

    // 相机
    this.camera = new THREE.PerspectiveCamera(60, (width || window.innerWidth) / (height || window.innerHeight), 0.1, 100);
    this.camera.position.set(0, 0, 4);

    // 灯光
    this._setupLights();

    // 实体组（用于旋转）
    this.entityGroup = new THREE.Group();
    this.scene.add(this.entityGroup);

    // 初始创建实体 Mesh
    this._createEntityMesh(EMOTION_TYPES.CRYSTAL);

    // 粒子系统
    this._createParticles();

    // 频谱环
    this._createSpectrumRing();

    // 地面光晕
    this._createGroundGlow();
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0x111122, 0.5);
    this.scene.add(ambient);

    this.pointLight = new THREE.PointLight(0x4488ff, 2, 10);
    this.pointLight.position.set(2, 2, 2);
    this.scene.add(this.pointLight);

    this.pointLight2 = new THREE.PointLight(0xff4422, 1.5, 8);
    this.pointLight2.position.set(-2, -1, 1);
    this.scene.add(this.pointLight2);

    this.entityLight = new THREE.PointLight(0x88aaff, 3, 5);
    this.entityLight.position.set(0, 0, 1.5);
    this.scene.add(this.entityLight);
  }

  _getShaderForEmotion(type) {
    switch (type) {
      case EMOTION_TYPES.ICE:    return { vert: iceVertexShader,    frag: iceFragmentShader };
      case EMOTION_TYPES.FIRE:   return { vert: fireVertexShader,   frag: fireFragmentShader };
      case EMOTION_TYPES.STONE:  return { vert: stoneVertexShader,  frag: stoneFragmentShader };
      default:                   return { vert: crystalVertexShader, frag: crystalFragmentShader };
    }
  }

  _getLightColorForEmotion(type) {
    switch (type) {
      case EMOTION_TYPES.ICE:    return { main: 0x44aaff, secondary: 0xaaddff };
      case EMOTION_TYPES.FIRE:   return { main: 0xff6600, secondary: 0xff2200 };
      case EMOTION_TYPES.STONE:  return { main: 0x886655, secondary: 0x441111 };
      default:                   return { main: 0x8833ff, secondary: 0x220044 };
    }
  }

  _createEntityMesh(emotionType) {
    // 移除旧 mesh
    if (this.entityMesh) {
      this.entityGroup.remove(this.entityMesh);
      this.entityMesh.geometry.dispose();
      this.entityMesh.material.dispose();
    }

    const shaders = this._getShaderForEmotion(emotionType);
    const geo = new THREE.IcosahedronGeometry(1, 4);

    this.entityMaterial = new THREE.ShaderMaterial({
      vertexShader: shaders.vert,
      fragmentShader: shaders.frag,
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.entityMesh = new THREE.Mesh(geo, this.entityMaterial);
    this.entityMesh.scale.setScalar(this.currentScale);
    this.entityGroup.add(this.entityMesh);

    // 更新灯光颜色
    const colors = this._getLightColorForEmotion(emotionType);
    this.entityLight.color.setHex(colors.main);
    this.pointLight.color.setHex(colors.main);
    this.pointLight2.color.setHex(colors.secondary);
  }

  _createParticles() {
    const count = 300;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      sizes[i] = Math.random() * 3 + 1;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.03,
      color: 0x8899ff,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  _createSpectrumRing() {
    const segments = 128;
    const ringGroup = new THREE.Group();

    const points = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * 2, Math.sin(angle) * 2, 0));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x334488, transparent: true, opacity: 0.3 });
    this.spectrumRing = new THREE.Line(geo, mat);
    this.scene.add(this.spectrumRing);

    // 存储用于动态更新的频谱点
    this.spectrumPoints = points;
    this.spectrumSegments = segments;
  }

  _createGroundGlow() {
    const geo = new THREE.CircleGeometry(2, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x112244,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(geo, mat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.5;
    this.scene.add(glow);
    this.groundGlow = glow;
    this.groundGlowMat = mat;
  }

  // 更新频谱环（根据 FFT 数据）
  _updateSpectrumRing(fftData, energy) {
    if (!this.spectrumRing || !fftData) return;

    const positions = this.spectrumRing.geometry.attributes.position;
    const baseRadius = 1.8 + energy * 0.4;

    for (let i = 0; i <= this.spectrumSegments; i++) {
      const angle = (i / this.spectrumSegments) * Math.PI * 2;
      const fftIndex = Math.floor((i / this.spectrumSegments) * fftData.length);
      const fftVal = fftData[fftIndex] / 255;
      const r = baseRadius + fftVal * 0.8;

      positions.setXY(i, Math.cos(angle) * r, Math.sin(angle) * r);
    }
    positions.needsUpdate = true;
  }

  // 主更新接口 —— 由 React 每帧调用
  update(audioData) {
    const elapsed = this.clock.getElapsedTime();
    const { volume, bassEnergy, midEnergy, highEnergy, accumulated, emotionType } = audioData;

    // 情绪类型切换
    if (emotionType !== this.currentEmotion && !this.isFrozen) {
      this.currentEmotion = emotionType;
      this._createEntityMesh(emotionType);
    }

    // 目标缩放 = 累积值映射到 0.05~1.5
    this.targetScale = 0.05 + accumulated * 1.45;

    // 平滑插值缩放（脉冲感）
    const pulseOffset = volume > 0.05 ? Math.sin(elapsed * 15) * volume * 0.08 : 0;
    this.currentScale += (this.targetScale - this.currentScale) * 0.06;

    if (this.entityMesh && !this.isFrozen) {
      const finalScale = this.currentScale + pulseOffset;
      this.entityMesh.scale.setScalar(Math.max(0.01, finalScale));

      // 慢速旋转
      this.entityMesh.rotation.y += 0.003 + volume * 0.02;
      this.entityMesh.rotation.x += 0.001 + bassEnergy * 0.01;
    } else if (this.entityMesh && this.isFrozen) {
      // 凝固后：缓慢自转 + 鼠标拖拽旋转
      this.entityGroup.rotation.y += this.rotationVelocity.x * 0.05;
      this.entityGroup.rotation.x += this.rotationVelocity.y * 0.05;
      this.rotationVelocity.multiplyScalar(0.95); // 惯性衰减
    }

    // 更新着色器 uniforms
    if (this.entityMaterial) {
      this.entityMaterial.uniforms.uTime.value = elapsed;
      this.entityMaterial.uniforms.uEnergy.value = accumulated;
    }

    // 频谱环
    this._updateSpectrumRing(null, volume);
    if (this.spectrumRing) {
      this.spectrumRing.rotation.z += 0.002;
      this.spectrumRing.material.opacity = 0.15 + volume * 0.5;
      const scale = 1.0 + accumulated * 0.3;
      this.spectrumRing.scale.setScalar(scale);
    }

    // 粒子漂浮
    if (this.particles) {
      this.particles.rotation.y += 0.0005;
      this.particles.rotation.x += 0.0002;
      this.particles.material.opacity = 0.2 + accumulated * 0.4;
      this.particles.material.color.setHSL(
        this.currentEmotion === EMOTION_TYPES.FIRE ? 0.05 :
        this.currentEmotion === EMOTION_TYPES.ICE ? 0.6 :
        this.currentEmotion === EMOTION_TYPES.STONE ? 0.08 : 0.75,
        0.6, 0.5
      );
    }

    // 地面光晕
    if (this.groundGlowMat) {
      this.groundGlowMat.opacity = 0.15 + accumulated * 0.4;
      const glowColor = this._getLightColorForEmotion(this.currentEmotion);
      this.groundGlow.material.color.setHex(glowColor.main);
    }

    // 动态灯光强度
    if (this.entityLight) {
      this.entityLight.intensity = 2 + accumulated * 3 + volume * 2;
      this.entityLight.position.x = Math.sin(elapsed * 0.7) * 1.5;
      this.entityLight.position.y = Math.cos(elapsed * 0.5) * 1.5;
    }

    this.renderer.render(this.scene, this.camera);
  }

  // 凝固状态
  freeze() {
    this.isFrozen = true;
    if (this.entityMesh) {
      // 凝固时轻微震动后稳定
      this.entityMesh.scale.setScalar(this.currentScale);
    }
  }

  // 重置场景
  reset() {
    this.isFrozen = false;
    this.currentScale = 0.01;
    this.targetScale = 0.01;
    this.currentEmotion = EMOTION_TYPES.CRYSTAL;
    this.rotationVelocity.set(0, 0);
    this.entityGroup.rotation.set(0, 0, 0);
    this._createEntityMesh(EMOTION_TYPES.CRYSTAL);
  }

  // 获取当前实体截图数据（用于画廊缩略图）
  getSnapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL('image/webp', 0.8);
  }

  // 获取当前实体信息
  getEntityData() {
    return {
      emotionType: this.currentEmotion,
      scale: this.currentScale,
      snapshot: this.getSnapshot(),
      createdAt: Date.now(),
    };
  }

  // 鼠标事件绑定（用于 isFrozen 后的 3D 旋转）
  _bindEvents() {
    this.canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this._onMouseUp.bind(this));
    this.canvas.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: true });
    this.canvas.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: true });
    this.canvas.addEventListener('touchend', this._onMouseUp.bind(this));
  }

  _onMouseDown(e) {
    if (!this.isFrozen) return;
    this.isDragging = true;
    this.prevMouse.set(e.clientX, e.clientY);
  }

  _onMouseMove(e) {
    if (!this.isDragging || !this.isFrozen) return;
    const dx = e.clientX - this.prevMouse.x;
    const dy = e.clientY - this.prevMouse.y;
    this.rotationVelocity.x = dx * 0.01;
    this.rotationVelocity.y = dy * 0.01;
    this.entityGroup.rotation.y += dx * 0.008;
    this.entityGroup.rotation.x += dy * 0.008;
    this.prevMouse.set(e.clientX, e.clientY);
  }

  _onMouseUp() {
    this.isDragging = false;
  }

  _onTouchStart(e) {
    if (!this.isFrozen || e.touches.length < 1) return;
    this.isDragging = true;
    this.prevMouse.set(e.touches[0].clientX, e.touches[0].clientY);
  }

  _onTouchMove(e) {
    if (!this.isDragging || !this.isFrozen || e.touches.length < 1) return;
    const dx = e.touches[0].clientX - this.prevMouse.x;
    const dy = e.touches[0].clientY - this.prevMouse.y;
    this.rotationVelocity.x = dx * 0.01;
    this.rotationVelocity.y = dy * 0.01;
    this.entityGroup.rotation.y += dx * 0.008;
    this.entityGroup.rotation.x += dy * 0.008;
    this.prevMouse.set(e.touches[0].clientX, e.touches[0].clientY);
  }

  // 响应式 resize
  resize(width, height) {
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // 销毁
  dispose() {
    this.renderer.dispose();
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
  }
}
