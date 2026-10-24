/**
 * 生成端到端测试用的假麦克风音频（48 kHz、单声道、16 位 PCM WAV）。
 * 用法：node scripts/gen-audio.mjs
 *
 * 三段音频分别模拟低沉叹息（冰）、急促碎碎念（石）、吼叫（火），
 * 开头 3 秒安静用于底噪校准，结尾 6 秒安静用于触发凝结。
 * 这是合成信号，只能验证"真实音频 → 特征 → 分类"整条链路是通的，不能代替真人试音。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 48000
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'audio')

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const dbToAmp = (db) => 10 ** (db / 20)

/** 底噪：RMS 为 -65 dBFS 的白噪声 */
function noiseBed(seconds, random) {
  const out = new Float32Array(Math.round(seconds * SR))
  const a = dbToAmp(-65) * Math.sqrt(3)
  for (let i = 0; i < out.length; i++) out[i] = (random() * 2 - 1) * a
  return out
}

/**
 * 在 buffer 的 [start, start+dur) 写入一段谐波"人声"。
 * tilt 越大高次谐波越弱（越闷），levelDb 是这一段的目标 RMS。
 */
function addVoice(buffer, { start, dur, f0, tilt, maxHz, levelDb, attack = 0.012, release = 0.03, random }) {
  const i0 = Math.round(start * SR)
  const n = Math.min(buffer.length - i0, Math.round(dur * SR))
  if (n <= 0) return
  const harmonics = []
  for (let k = 1; k * f0 < maxHz; k++) harmonics.push({ k, amp: 1 / k ** tilt, phase: random() * Math.PI * 2 })
  // 先算单位幅度下的 RMS，再缩放到目标电平
  const unitRms = Math.sqrt(harmonics.reduce((sum, h) => sum + (h.amp * h.amp) / 2, 0))
  const gain = dbToAmp(levelDb) / unitRms
  const vibrato = 0.6 + random() * 0.6
  let phase = 0
  for (let j = 0; j < n; j++) {
    const t = j / SR
    const env = Math.min(1, t / attack, (dur - t) / release)
    const f = f0 * (1 + 0.012 * Math.sin(2 * Math.PI * vibrato * t))
    phase += (2 * Math.PI * f) / SR
    let v = 0
    for (const h of harmonics) v += h.amp * Math.sin(h.k * phase + h.phase)
    buffer[i0 + j] += v * gain * Math.max(0, env)
  }
}

function ice(random) {
  const total = 3 + 18 + 6
  const buf = noiseBed(total, random)
  // 持续的低沉闷声，每 4 秒换一次气
  for (let t = 3; t < 21; t += 4) {
    const dur = Math.min(3.5, 21 - t)
    addVoice(buf, { start: t, dur, f0: 115 + random() * 15, tilt: 2, maxHz: 3000, levelDb: -50, attack: 0.15, release: 0.25, random })
  }
  return buf
}

function stone(random) {
  const total = 3 + 18 + 6
  const buf = noiseBed(total, random)
  // 每秒约 4 个短音节，长短和间隔都不规则
  let t = 3
  while (t < 21) {
    const dur = 0.11 + random() * 0.05
    addVoice(buf, { start: t, dur, f0: 170 + random() * 40, tilt: 1, maxHz: 4000, levelDb: -35 + (random() * 4 - 2), random })
    t += dur + 0.08 + random() * 0.1
  }
  return buf
}

function fire(random) {
  const total = 3 + 18 + 6
  const buf = noiseBed(total, random)
  // 一句 3~5 个吼出来的字，字间短促停顿，句间换气
  let t = 3
  while (t < 21) {
    const words = 3 + Math.floor(random() * 3)
    for (let w = 0; w < words && t < 21; w++) {
      const dur = 0.35 + random() * 0.25
      addVoice(buf, { start: t, dur, f0: 280 + random() * 60, tilt: 0.5, maxHz: 6000, levelDb: -14 + (random() * 3 - 1.5), attack: 0.008, random })
      t += dur + 0.05 + random() * 0.07
    }
    t += 0.3
  }
  return buf
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    data.writeInt16LE(Math.round(v * 32767), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // 单声道
  header.writeUInt32LE(SR, 24)
  header.writeUInt32LE(SR * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

await mkdir(outDir, { recursive: true })
for (const [name, make, seed] of [
  ['ice', ice, 11],
  ['stone', stone, 22],
  ['fire', fire, 33],
]) {
  const file = path.join(outDir, `${name}.wav`)
  await writeFile(file, toWav(make(rng(seed))))
  console.log('写入', path.relative(process.cwd(), file))
}
