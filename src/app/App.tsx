import { Stage } from '../scene/Stage'
import { DebugPanel } from '../ui/DebugPanel'
import { Gallery } from '../ui/Gallery'
import { InspectHud } from '../ui/InspectHud'
import { Onboarding } from '../ui/Onboarding'
import { RecordingHud } from '../ui/RecordingHud'
import { useShortcuts } from '../ui/useShortcuts'
import { openGallery } from './artifactController'
import { live } from './live'
import { useAppStore } from './store'
import '../styles/ui.css'

export function App() {
  useShortcuts()
  const phase = useAppStore((s) => s.phase)
  const debugOpen = useAppStore((s) => s.debugOpen)
  const seed = useAppStore((s) => s.seed)

  return (
    <div className="app">
      <Stage live={live} seed={seed} interactive={phase === 'inspecting'} />
      {phase === 'onboarding' && (
        <>
          <Onboarding />
          <button type="button" className="btn btn-quiet gallery-entry" onClick={() => void openGallery()}>
            🏛 标本馆
          </button>
        </>
      )}
      {phase === 'recording' && <RecordingHud />}
      {phase === 'inspecting' && <InspectHud />}
      {phase === 'gallery' && <Gallery />}
      {debugOpen && phase === 'recording' && <DebugPanel />}
    </div>
  )
}
