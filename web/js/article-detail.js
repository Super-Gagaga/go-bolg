const API_BASE = '/api/v1';

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function avatarFor(user) {
  if (user && user.avatar) return user.avatar;
  return `https://picsum.photos/seed/${encodeURIComponent((user && user.username) || 'writer')}/100/100`;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(value));
}

function formatShortDate(value) {
  if (!value) return '刚刚';
  return new Intl.DateTimeFormat('zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(value));
}

function showStatus(message) {
  const el = document.querySelector('#status-line');
  el.textContent = message;
  el.classList.toggle('visible', Boolean(message));
}

async function getJSON(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`请求失败：${res.status}`);
  const body = await res.json();
  if (body.code !== 0) throw new Error(body.message || '接口返回异常');
  return body.data;
}

function renderArticle(article) {
  showStatus('');
  const content = document.querySelector('#article-content');
  content.hidden = false;
  document.title = `${article.title} - Journal`;
  const user = article.user || {};
  const category = article.category && article.category.name;
  const tags = (article.tags || []).map(tag => `<a href="/?tag=${encodeURIComponent(tag.name)}" class="article-tag"># ${escapeHTML(tag.name)}</a>`).join('');
  content.innerHTML = `
    <article>
      <header class="article-header">
        ${category ? `<span class="article-category">${escapeHTML(category)}</span>` : ''}
        <h1 class="article-title">${escapeHTML(article.title)}</h1>
        <div class="author-row">
          <img src="${escapeHTML(avatarFor(user))}" alt="" class="author-avatar">
          <div>
            <div class="author-name">${escapeHTML(user.username || '匿名作者')}</div>
            <div class="publish-info">${formatDate(article.created_at)}</div>
          </div>
        </div>
      </header>
      <div class="stats-bar">
        <span class="stat-item"><i class="ph ph-eye"></i><span class="stat-count">${article.view_count || 0}</span> 阅读</span>
        <span class="stat-item"><i class="ph ph-chat-circle"></i><span class="stat-count">${article.comment_count || 0}</span> 评论</span>
        <span class="stat-item"><i class="ph ph-heart"></i><span class="stat-count">${article.like_count || 0}</span> 点赞</span>
        <span class="stat-item"><i class="ph ph-bookmark"></i><span class="stat-count">${article.favorite_count || 0}</span> 收藏</span>
      </div>
      ${article.cover_image ? `<img src="${escapeHTML(article.cover_image)}" alt="" class="article-cover">` : ''}
      <div class="article-body">${article.content_html || `<p>${escapeHTML(article.content || '')}</p>`}</div>
      ${tags ? `<div class="article-tags">${tags}</div>` : ''}
    </article>
  `;
}

function renderComments(comments) {
  const section = document.querySelector('#comments-section');
  const list = document.querySelector('#comment-list');
  const countEl = document.querySelector('#comment-count');
  const countAll = nodes => nodes.reduce((sum, node) => sum + 1 + countAll(node.replies || []), 0);
  const total = countAll(comments);
  if (!total) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  countEl.textContent = `(${total})`;
  const renderNode = (node, reply = false) => {
    const user = node.user || {};
    let html = `
      <div class="comment-card${reply ? ' reply' : ''}">
        <div class="comment-author">
          <img src="${escapeHTML(avatarFor(user))}" alt="" class="comment-avatar">
          <span class="comment-username">${escapeHTML(user.username || '用户')}</span>
          <span class="comment-time">${formatShortDate(node.created_at)}</span>
        </div>
        <div class="comment-content">${escapeHTML(node.content)}</div>
      </div>`;
    (node.replies || []).forEach(child => { html += renderNode(child, true); });
    return html;
  };
  list.innerHTML = comments.map(c => renderNode(c)).join('');
}

async function bootstrap() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    showStatus('文章 ID 无效，请从首页查看文章。');
    return;
  }
  try {
    const [article, comments] = await Promise.all([
      getJSON(`/articles/${id}`),
      getJSON(`/articles/${id}/comments`).catch(() => [])
    ]);
    renderArticle(article);
    renderComments(comments || []);
  } catch (error) {
    showStatus(error.message);
  }
}

bootstrap();
