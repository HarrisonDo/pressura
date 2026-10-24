import { startRecording } from '../app/controller'
import { useAppStore, type MicStatus } from '../app/store'

const MIC_MESSAGES: Partial<Record<MicStatus, string>> = {
  denied: '麦克风权限被拒绝。请在地址栏左侧的站点设置里允许麦克风后重试，或者先用模拟模式体验。',
  'no-device': '没有检测到麦克风设备。接上麦克风后重试，或者先用模拟模式。',
  busy: '麦克风正被其他程序占用，关闭后再试。',
  insecure: '当前页面不是安全连接（HTTPS），浏览器不允许使用麦克风。',
  unsupported: '这个浏览器不支持麦克风采集，建议使用最新版 Chrome、Edge 或 Safari。',
  unknown: '麦克风启动失败，请重试。',
}

export function Onboarding() {
  const micStatus = useAppStore((s) => s.micStatus)
  const notice = useAppStore((s) => s.notice)
  const requesting = micStatus === 'requesting'
  const error = MIC_MESSAGES[micStatus]

  return (
    <main className="onboarding" aria-labelledby="onboarding-title">
      <div className="onboarding-card">
        <p className="eyebrow">情绪标本</p>
        <h1 id="onboarding-title">Pressura</h1>
        <p className="onboarding-lead">
          把说不出口的压力发出来。
          <br />
          你的声音会在眼前长成冰、石或火。
        </p>

        <div className="onboarding-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void startRecording('mic')}
            disabled={requesting}
          >
            {requesting ? '等待麦克风授权…' : '开始倾诉'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void startRecording('sim')}>
            没有麦克风？用模拟模式
          </button>
        </div>

        {(error || notice) && (
          <p className="onboarding-error" role="alert">
            {notice ?? error}
          </p>
        )}

        <p className="onboarding-note">声音只在这台设备上分析，不上传，也不保存录音。</p>
      </div>
    </main>
  )
}
