import { describe, expect, it } from 'vitest'
import type { EmotionType } from '../types'
import {
  applyAction,
  createArtifactState,
  HITS_TO_SHATTER,
  MAX_TREES,
  tickState,
  type ArtifactAction,
  type ArtifactState,
} from './rules'

const P: [number, number, number] = [0, 1, 0]
const N: [number, number, number] = [0, 1, 0]
const plant: ArtifactAction = { kind: 'plant', point: P, normal: N }
const knock: ArtifactAction = { kind: 'knock', point: P, normal: N }
const water = (amount = 0.2): ArtifactAction => ({ kind: 'pour', liquid: 'water', amount })
const gas = (amount = 0.2): ArtifactAction => ({ kind: 'pour', liquid: 'gasoline', amount })

function run(type: EmotionType, actions: ArtifactAction[], start = createArtifactState()) {
  let state = start
  const kinds: string[] = []
  for (const a of actions) {
    const r = applyAction(state, type, a)
    state = r.state
    kinds.push(...r.effects.map((e) => e.kind))
  }
  return { state, kinds }
}

function tick(type: EmotionType, state: ArtifactState, seconds: number) {
  let s = state
  const kinds: string[] = []
  for (let t = 0; t < seconds; t += 0.1) {
    const r = tickState(s, type, 0.1)
    s = r.state
    kinds.push(...r.effects.map((e) => e.kind))
  }
  return { state: s, kinds }
}

describe('种树', () => {
  it('冰上是霜花树，石上是绿树，都会慢慢长大', () => {
    const ice = run('ice', [plant]).state
    const stone = run('stone', [plant]).state
    expect(ice.trees[0].species).toBe('frost')
    expect(stone.trees[0].species).toBe('green')
    expect(tick('stone', stone, 10).state.trees[0].growth).toBe(1)
  })

  it('燃烧的火核上种树会被烧成灰；熄灭成黑曜石后能种活', () => {
    const { state, kinds } = run('fire', [plant])
    expect(state.trees[0].species).toBe('ash')
    expect(state.trees[0].burnt).toBe(true)
    expect(kinds).toContain('ash')

    const extinguished = run('fire', Array(10).fill(water(0.3))).state
    expect(extinguished.obsidian).toBe(true)
    expect(run('fire', [plant], extinguished).state.trees[0].species).toBe('green')
  })

  it('最多种 12 棵', () => {
    expect(run('stone', Array(20).fill(plant)).state.trees).toHaveLength(MAX_TREES)
  })

  it('湿润的石头上树长得更快', () => {
    const dry = tick('stone', run('stone', [plant]).state, 2).state.trees[0].growth
    const wet = tick('stone', run('stone', [water(1), plant]).state, 2).state.trees[0].growth
    expect(wet).toBeGreaterThan(dry)
  })
})

describe('浇水', () => {
  it('冰：再冻一层', () => {
    const { state, kinds } = run('ice', [water(0.5)])
    expect(state.frost).toBeGreaterThan(0.3)
    expect(kinds).toContain('freeze')
  })

  it('石：变湿，随时间长苔藓', () => {
    const wet = run('stone', [water(1)]).state
    expect(wet.wet).toBe(1)
    expect(tick('stone', wet, 10).state.moss).toBeGreaterThan(0.3)
  })

  it('火核：持续浇水才会熄灭成黑曜石，中途停下会慢慢缓过来', () => {
    const half = run('fire', [water(0.4)]).state
    expect(half.obsidian).toBe(false)
    expect(tick('fire', half, 5).state.extinguish).toBeLessThan(half.extinguish)
    const { state, kinds } = run('fire', [water(0.5), water(0.5), water(0.5)])
    expect(state.obsidian).toBe(true)
    expect(kinds).toContain('extinguished')
  })

  it('能浇灭汽油火', () => {
    const burning = run('stone', [gas(0.5)]).state
    expect(burning.burning).toBe(1)
    const { state, kinds } = run('stone', [water(0.5)], burning)
    expect(state.burning).toBe(0)
    expect(kinds).toContain('steam')
  })
})

describe('浇汽油', () => {
  it('冰：点燃后边烧边融化', () => {
    const { state, kinds } = run('ice', [gas(0.5)])
    expect(kinds).toContain('ignite')
    expect(tick('ice', state, 5).state.melt).toBeGreaterThan(0.1)
  })

  it('石：燃烧熏黑，并烧掉树', () => {
    const planted = tick('stone', run('stone', [plant]).state, 5).state
    const { state } = run('stone', [gas(0.5)], planted)
    const after = tick('stone', state, 3)
    expect(after.state.soot).toBeGreaterThan(0.1)
    expect(after.state.trees[0].burnt).toBe(true)
    expect(after.kinds).toContain('ash')
  })

  it('火核：爆燃，火势加成有上限', () => {
    const { state, kinds } = run('fire', Array(10).fill(gas(0.5)))
    expect(kinds).toContain('flare')
    expect(state.fireBoost).toBe(0.6)
    expect(state.burning).toBe(0)
  })

  it('汽油火会自己慢慢熄灭', () => {
    const { state } = run('stone', [gas(0.5)])
    expect(tick('stone', state, 15).state.burning).toBe(0)
  })
})

describe('敲击', () => {
  it('每次留下裂纹，第 3 次碎裂，之后不再响应任何操作', () => {
    const { state, kinds } = run('ice', Array(HITS_TO_SHATTER).fill(knock))
    expect(state.cracks).toHaveLength(3)
    expect(state.shattered).toBe(true)
    expect(state.release).toBe(1)
    expect(kinds.filter((k) => k === 'crack')).toHaveLength(3)
    expect(kinds).toContain('shatter')

    const after = run('ice', [plant, water(), gas(), knock], state)
    expect(after.state).toBe(state)
    expect(after.kinds).toHaveLength(0)
  })
})

describe('释放度', () => {
  it('每种处置都会增加，封顶 1', () => {
    const { state } = run('stone', [plant, water(0.5), gas(0.5), knock])
    expect(state.release).toBeGreaterThan(0.2)
    expect(state.release).toBeLessThanOrEqual(1)
  })
})

describe('纯函数', () => {
  it('不修改传入的状态', () => {
    const start = createArtifactState()
    const snapshot = JSON.stringify(start)
    run('stone', [plant, water(), gas(), knock], start)
    tickState(start, 'stone', 1)
    expect(JSON.stringify(start)).toBe(snapshot)
  })
})
