import { Stage } from '../scene/Stage'
import { DebugPanel } from '../ui/DebugPanel'
import { Onboarding } from '../ui/Onboarding'
import { RecordingHud } from '../ui/RecordingHud'
import { ResultCard } from '../ui/ResultCard'
import { useShortcuts } from '../ui/useShortcuts'
import { live } from './live'
import { useAppStore } from './store'
import '../styles/ui.css'

export function App() {
  useShortcuts()
  const phase = useAppStore((s) => s.phase)
  const debugOpen = useAppStore((s) => s.debugOpen)

  return (
    <div className="app">
      <Stage live={live} />
      {phase === 'onboarding' && <Onboarding />}
      {phase === 'recording' && <RecordingHud />}
      {phase === 'result' && <ResultCard />}
      {debugOpen && phase !== 'onboarding' && <DebugPanel />}
    </div>
  )
}
