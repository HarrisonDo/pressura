/**
 * 画廊存储 —— 使用 localStorage 持久化
 */

const STORAGE_KEY = 'pressura_gallery';

export function loadGallery() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToGallery(entityData) {
  const gallery = loadGallery();
  const item = {
    id: `entity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...entityData,
  };
  gallery.unshift(item); // 最新的在最前
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gallery));
  } catch (e) {
    console.warn('画廊存储失败（可能超出 localStorage 限制）:', e);
    // 超出限制时删掉最旧的
    if (gallery.length > 1) {
      gallery.pop();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gallery));
    }
  }
  return item;
}

export function deleteFromGallery(id) {
  const gallery = loadGallery().filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gallery));
  return gallery;
}

export function getEmotionLabel(type) {
  const labels = {
    ice: '压抑·冰',
    fire: '愤怒·火',
    stone: '焦虑·石',
    crystal: '迷茫·晶',
  };
  return labels[type] || '未知';
}

export function getEmotionColor(type) {
  const colors = {
    ice: '#55aaff',
    fire: '#ff6622',
    stone: '#997755',
    crystal: '#9933ff',
  };
  return colors[type] || '#888888';
}
