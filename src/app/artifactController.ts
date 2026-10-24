/**
 * 标本阶段的控制器：凝结 → 处置（种树/浇水/汽油/敲击）→ 收集进画廊；以及从画廊里重新打开。
 */
import { del, get as idbGet, set as idbSet } from 'idb-keyval'
import { EmotionSession, startFrameLoop, type SessionResult } from '../core/audio'
import { createSignature, type ArtifactSignature } from '../core/artifact/signature'
import {
  applyAction,
  createArtifactState,
  summarize,
  tickState,
  type ArtifactAction,
  type ArtifactState,
} from '../core/artifact/rules'
import { live, type ArtifactPointerEvent } from './live'
import { useAppStore, type GalleryItem, type Tool } from './store'

const set = useAppStore.setState
const get = useAppStore.getState
const GALLERY_KEY = 'pressura:gallery'

let stopTick: (() => void) | null = null

/** 会话结束：生成签名，进入处置阶段 */
export function beginInspect(result: SessionResult): void {
  const signature = createSignature(result, get().seed)
  openArtifact(signature, createArtifactState(), null)
}

function openArtifact(signature: ArtifactSignature, state: ArtifactState, viewingId: string | null): void {
  stopTick?.()
  // 用一个静止的快照把场景定格在最终形态
  const snap = live.snapshot ?? new EmotionSession().snapshot
  snap.phase = 'ended'
  snap.form = signature.type
  snap.pressure = signature.finalPressure
  snap.intensity = 0
  snap.voiced = false
  snap.bands.fill(0)
  live.snapshot = snap
  live.artifact = { type: signature.type, state, effects: [], tool: get().tool, pouring: null }
  live.onArtifactPointer = handlePointer
  set({
    phase: 'inspecting',
    seed: signature.seed,
    signature,
    form: signature.type,
    viewingId,
    summary: summarize(state),
  })

  let acc = 0
  stopTick = startFrameLoop((dt) => {
    const a = live.artifact
    if (!a) return
    if (a.pouring && a.tool !== 'plant' && a.tool !== 'knock') {
      dispatch({ kind: 'pour', liquid: a.tool === 'water' ? 'water' : 'gasoline', amount: dt * 0.6, point: a.pouring })
    }
    const r = tickState(a.state, a.type, dt)
    a.state = r.state
    a.effects.push(...r.effects)
    acc += dt
    if (acc > 0.25) {
      acc = 0
      set({ summary: summarize(a.state) })
    }
  })
}

function dispatch(action: ArtifactAction): void {
  const a = live.artifact
  if (!a) return
  const r = applyAction(a.state, a.type, action)
  a.state = r.state
  a.effects.push(...r.effects)
}

let pendingPlant: number | null = null

function handlePointer(e: ArtifactPointerEvent): void {
  const a = live.artifact
  if (!a || a.state.shattered) return
  if (e.kind === 'double') {
    // 双击永远是敲击；取消双击前那次单击排队的种树
    if (pendingPlant !== null) window.clearTimeout(pendingPlant)
    pendingPlant = null
    dispatch({ kind: 'knock', point: e.point, normal: e.normal })
    set({ summary: summarize(a.state) })
    return
  }
  if (e.kind === 'up') {
    a.pouring = null
    return
  }
  if (e.kind === 'move') {
    if (a.pouring) a.pouring = e.point
    return
  }
  // down
  switch (a.tool) {
    case 'plant':
      pendingPlant = window.setTimeout(() => {
        pendingPlant = null
        dispatch({ kind: 'plant', point: e.point, normal: e.normal })
      }, 260)
      break
    case 'knock':
      dispatch({ kind: 'knock', point: e.point, normal: e.normal })
      break
    default:
      a.pouring = e.point
  }
  set({ summary: summarize(a.state) })
}

export function selectTool(tool: Tool): void {
  set({ tool })
  if (live.artifact) {
    live.artifact.tool = tool
    live.artifact.pouring = null
  }
}

/** 收集进画廊（只存在本机 IndexedDB） */
export async function collectArtifact(): Promise<void> {
  const { signature, viewingId } = get()
  const a = live.artifact
  if (!signature || !a) return
  const item: GalleryItem = {
    signature,
    summary: summarize(a.state),
    state: JSON.stringify(a.state),
    thumbnail: live.capture?.() ?? '',
    collectedAt: Date.now(),
  }
  const list = (await loadGallery()).filter((g) => g.signature.id !== (viewingId ?? signature.id))
  list.unshift(item)
  await idbSet(GALLERY_KEY, list)
  set({ gallery: list, notice: viewingId ? '已更新这件藏品' : '已收进标本馆' })
  closeArtifact()
  set({ phase: 'gallery' })
}

export async function loadGallery(): Promise<GalleryItem[]> {
  try {
    return ((await idbGet(GALLERY_KEY)) as GalleryItem[] | undefined) ?? []
  } catch {
    return []
  }
}

export async function openGallery(): Promise<void> {
  closeArtifact()
  set({ phase: 'gallery', gallery: await loadGallery() })
}

export function viewGalleryItem(item: GalleryItem): void {
  let state: ArtifactState
  try {
    state = JSON.parse(item.state) as ArtifactState
  } catch {
    state = createArtifactState()
  }
  openArtifact(item.signature, state, item.signature.id)
}

export async function deleteGalleryItem(id: string): Promise<void> {
  const list = (await loadGallery()).filter((g) => g.signature.id !== id)
  if (list.length) await idbSet(GALLERY_KEY, list)
  else await del(GALLERY_KEY)
  set({ gallery: list })
}

export function closeArtifact(): void {
  stopTick?.()
  stopTick = null
  live.artifact = null
  live.onArtifactPointer = null
  live.snapshot = null
  set({ signature: null, summary: null, viewingId: null })
}
