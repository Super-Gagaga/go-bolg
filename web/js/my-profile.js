const API = '/api/v1';
const token = () => localStorage.getItem('jwt_token');
const $ = selector => document.querySelector(selector);

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function avatarFor(user = {}) {
  if (user.avatar) return user.avatar;
  return `https://picsum.photos/seed/${encodeURIComponent(user.username || 'journal')}/160/160`;
}

function date(value) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '';
}

function statusText(status) {
  return { draft: '草稿', pending_review: '待审核', published: '已发布', archived: '已归档' }[status] || status || '';
}

function showStatus(message) {
  const el = $('#status');
  el.textContent = message;
  el.hidden = !message;
}

async function api(path, params = {}) {
  if (!token()) {
    location.href = '/';
    return null;
  }
  const url = new URL(API + path, location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) url.searchParams.set(key, value);
  });
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (res.status === 401) {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('refresh_token');
    location.href = '/';
    return null;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.code !== 0) throw new Error(body.message || `请求失败 ${res.status}`);
  return body.data;
}

function renderProfile(profile) {
  $('#profile-avatar').src = avatarFor(profile);
  $('#profile-name').textContent = profile.username || '我的主页';
  $('#profile-bio').textContent = profile.bio || '还没有填写简介。';
  $('#article-count').textContent = profile.article_count || 0;
  $('#follower-count').textContent = profile.follower_count || 0;
  $('#following-count').textContent = profile.following_count || 0;
  $('#profile-hero').hidden = false;
  $('#stat-grid').hidden = false;
}

function renderArticles(result) {
  const list = (result && result.list) || [];
  $('#my-articles').innerHTML = list.length ? list.map(article => `
    <a class="profile-item" href="/editor?id=${article.id}">
      <div class="profile-item-title">${esc(article.title || '未命名文章')}</div>
      <div class="profile-item-meta">
        <span>${esc(statusText(article.status))}</span>
        <span>${date(article.updated_at || article.created_at)}</span>
        <span>${article.view_count || 0} 阅读</span>
        <span>${article.like_count || 0} 喜欢</span>
      </div>
    </a>
  `).join('') : '<div class="empty">还没有文章，去写第一篇吧。</div>';
}

function renderFavorites(result) {
  const list = ((result && result.list) || []).map(item => item.article || item).filter(Boolean);
  $('#my-favorites').innerHTML = list.length ? list.slice(0, 8).map(article => `
    <a class="profile-item" href="/article-detail?id=${article.id}">
      <div class="profile-item-title">${esc(article.title || '未命名文章')}</div>
      <div class="profile-item-meta">
        <span>${date(article.created_at)}</span>
        <span>${article.favorite_count || 0} 收藏</span>
      </div>
    </a>
  `).join('') : '<div class="empty">还没有收藏文章。</div>';
}

(async function init() {
  try {
    showStatus('正在加载我的主页...');
    const [profile, articles, favorites] = await Promise.all([
      api('/user/profile'),
      api('/user/articles', { page: 1, page_size: 10 }),
      api('/user/favorites', { page: 1, page_size: 8 })
    ]);
    if (!profile) return;
    renderProfile(profile);
    renderArticles(articles);
    renderFavorites(favorites);
    $('#profile-content').hidden = false;
    showStatus('');
  } catch (error) {
    showStatus(error.message);
  }
})();
