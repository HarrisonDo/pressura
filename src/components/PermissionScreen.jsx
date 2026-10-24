/**
 * PermissionScreen —— 麦克风权限引导页
 */
export function PermissionScreen({ onStart, permission }) {
  return (
    <div className="permission-screen">
      <div className="permission-inner">
        <div className="perm-icon">
          {permission === 'denied' ? '🚫' : '🎙️'}
        </div>
        <h1 className="perm-title">
          {permission === 'denied' ? '麦克风访问被拒绝' : 'Pressura'}
        </h1>
        <p className="perm-subtitle">
          {permission === 'denied'
            ? '请在浏览器设置中允许麦克风权限后刷新页面'
            : '声音是情绪的形状\n让你的声音，塑造一块属于你的晶体'}
        </p>
        {permission !== 'denied' && (
          <button className="perm-btn" onClick={onStart}>
            <span className="perm-btn-icon">🎤</span>
            开始录制情绪
          </button>
        )}
        <p className="perm-note">
          {permission !== 'denied' && '声音仅在本地处理，不会上传'}
        </p>
      </div>
    </div>
  );
}
