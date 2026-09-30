(() => {
  const config = window.SITE_CONFIG;
  const app = document.getElementById('app');
  const siteTitle = document.getElementById('site-title');
  const siteTagline = document.getElementById('site-tagline');
  const footerText = document.getElementById('footer-text');

  siteTitle.textContent = config.title;
  siteTagline.textContent = config.tagline;
  footerText.textContent = `${config.description} © ${config.author}`;

  const state = {
    posts: [],
    query: '',
    category: 'All',
    hiddenPostIds: new Set(),
    notes: [],
    activeNoteId: null,
    noteSearch: '',
    noteDraft: {
      title: '',
      content: ''
    },
    draft: {
      title: '',
      category: 'Notes',
      summary: '',
      content: ''
    }
  };

  const STORAGE_KEY = 'ai_blog_local_posts_v1';
  const HIDDEN_KEY = 'ai_blog_hidden_posts_v1';
  const NOTES_KEY = 'ai_blog_notes_v1';
  const ACTIVE_NOTE_KEY = 'ai_blog_active_note_v1';

  const getLocalPosts = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const setLocalPosts = (posts) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  };

  const getHiddenPosts = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'));
    } catch {
      return new Set();
    }
  };

  const setHiddenPosts = (ids) => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(ids)));
  };

  const getNotes = () => {
    try {
      return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const setNotes = (notes) => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  };

  const getActiveNoteId = () => localStorage.getItem(ACTIVE_NOTE_KEY) || '';

  const setActiveNoteId = (id) => {
    localStorage.setItem(ACTIVE_NOTE_KEY, id || '');
  };

  const buildPostCollection = () => {
    const builtin = config.posts.map((post) => ({ ...post, origin: 'builtin' }));
    const local = getLocalPosts().map((post) => ({ ...post, origin: 'local' }));
    return [...builtin, ...local]
      .filter((post) => !state.hiddenPostIds.has(post.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const escapeHtml = (str) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

  const renderInline = (text) => escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');

  const renderMarkdown = (markdown) => {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const parts = [];
    const headingCount = new Map();
    let inCode = false;
    let codeLang = '';
    let codeBuffer = [];
    let listBuffer = [];
    let listType = '';
    let paragraphBuffer = [];

    const flushParagraph = () => {
      if (!paragraphBuffer.length) return;
      parts.push(`<p>${renderInline(paragraphBuffer.join(' ').trim())}</p>`);
      paragraphBuffer = [];
    };

    const flushList = () => {
      if (!listBuffer.length) return;
      const tag = listType === 'ol' ? 'ol' : 'ul';
      parts.push(`<${tag}>${listBuffer.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`);
      listBuffer = [];
      listType = '';
    };

    const flushCode = () => {
      if (!inCode) return;
      parts.push(`<pre><code class="language-${escapeAttr(codeLang || 'text')}">${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
      inCode = false;
      codeLang = '';
      codeBuffer = [];
    };

    const headingId = (text) => {
      const base = createSlug(text);
      const count = (headingCount.get(base) || 0) + 1;
      headingCount.set(base, count);
      return count === 1 ? base : `${base}-${count}`;
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();

      if (line.startsWith('```')) {
        if (inCode) {
          flushCode();
        } else {
          flushParagraph();
          flushList();
          inCode = true;
          codeLang = line.slice(3).trim();
        }
        continue;
      }

      if (inCode) {
        codeBuffer.push(rawLine);
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        continue;
      }

      if (line.startsWith('# ')) {
        flushParagraph();
        flushList();
        const text = line.slice(2).trim();
        parts.push(`<h1 id="${headingId(text)}">${renderInline(text)}</h1>`);
        continue;
      }

      if (line.startsWith('## ')) {
        flushParagraph();
        flushList();
        const text = line.slice(3).trim();
        parts.push(`<h2 id="${headingId(text)}">${renderInline(text)}</h2>`);
        continue;
      }

      if (line.startsWith('### ')) {
        flushParagraph();
        flushList();
        const text = line.slice(4).trim();
        parts.push(`<h3 id="${headingId(text)}">${renderInline(text)}</h3>`);
        continue;
      }

      if (/^[-*]\s+/.test(line)) {
        flushParagraph();
        if (listType && listType !== 'ul') flushList();
        listType = 'ul';
        listBuffer.push(line.replace(/^[-*]\s+/, ''));
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        flushParagraph();
        if (listType && listType !== 'ol') flushList();
        listType = 'ol';
        listBuffer.push(line.replace(/^\d+\.\s+/, ''));
        continue;
      }

      flushList();
      paragraphBuffer.push(line.trim());
    }

    flushParagraph();
    flushList();
    if (inCode) flushCode();

    return parts.join('\n');
  };

  const loadPost = async (post) => {
    if (post.content) return { ...post, markdown: post.content };
    try {
      const response = await fetch(post.file, { cache: 'no-store' });
      if (!response.ok) throw new Error('load failed');
      const markdown = await response.text();
      return { ...post, markdown };
    } catch {
      return { ...post, markdown: '' };
    }
  };

  const ensurePosts = async () => {
    const allPosts = buildPostCollection();
    const hydrated = await Promise.all(allPosts.map(loadPost));
    state.posts = hydrated;
    return state.posts;
  };

  const categories = () => ['All', ...new Set(buildPostCollection().map((p) => p.category))];

  const createSlug = (text) => text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || `post-${Date.now()}`;

  const refreshStateFromStorage = () => {
    state.hiddenPostIds = getHiddenPosts();
    state.notes = getNotes().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    state.activeNoteId = getActiveNoteId() || state.notes[0]?.id || null;
    const currentNote = state.notes.find((note) => note.id === state.activeNoteId) || null;
    if (currentNote) {
      state.noteDraft = { title: currentNote.title, content: currentNote.content };
    } else if (!state.notes.length) {
      state.noteDraft = { title: '', content: '' };
    }
  };

  const renderHome = async () => {
    refreshStateFromStorage();
    await ensurePosts();
    const filtered = state.posts.filter((post) => {
      const matchesQuery = `${post.title} ${post.summary} ${post.category}`.toLowerCase().includes(state.query.toLowerCase());
      const matchesCategory = state.category === 'All' || post.category === state.category;
      return matchesQuery && matchesCategory;
    });

    app.innerHTML = `
      <section class="hero">
        <div class="hero-mark" aria-hidden="true"></div>
        <h1>${escapeHtml(config.title)}</h1>
        <p>${escapeHtml(config.description)}</p>
      </section>

      <section class="toolbar" aria-label="文章筛选">
        <input id="searchInput" type="search" placeholder="搜索文章标题或内容" value="${escapeAttr(state.query)}" />
        <select id="categorySelect" aria-label="分类筛选">
          ${categories().map((cat) => `<option value="${escapeHtml(cat)}" ${cat === state.category ? 'selected' : ''}>${escapeHtml(cat)}</option>`).join('')}
        </select>
        <button id="clearFilters" type="button">清除筛选</button>
      </section>

      <section class="post-list" aria-label="文章列表">
        ${filtered.length ? filtered.map((post) => `
          <article class="post-card">
            <div class="post-meta">
              <span class="tag">${escapeHtml(post.category)}</span>
              <span>${escapeHtml(post.date)}</span>
            </div>
            <h2><a href="#/post/${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a></h2>
            <p>${escapeHtml(post.summary)}</p>
          </article>
        `).join('') : '<div class="empty">没有找到匹配的文章。</div>'}
      </section>
    `;

    document.getElementById('searchInput').addEventListener('input', (e) => {
      state.query = e.target.value;
      renderHome();
    });

    document.getElementById('categorySelect').addEventListener('change', (e) => {
      state.category = e.target.value;
      renderHome();
    });

    document.getElementById('clearFilters').addEventListener('click', () => {
      state.query = '';
      state.category = 'All';
      renderHome();
    });
  };

  const renderAbout = () => {
    app.innerHTML = `
      <section class="about">
        <h1>${escapeHtml(config.about.title)}</h1>
        <p>${escapeHtml(config.about.intro)}</p>
        <div class="content" style="margin-top:18px; color: var(--text); line-height:1.8;">${escapeHtml(config.about.body)}</div>
        <div class="actions">
          <a class="ghost" href="#/home">返回文章列表</a>
        </div>
      </section>
    `;
  };

  const buildToc = (markdown) => {
    return markdown
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => /^#{2,3}\s+/.test(line))
      .map((line) => {
        const level = line.startsWith('## ') ? 2 : 3;
        const text = line.replace(/^#{2,3}\s+/, '').trim();
        return {
          level,
          text,
          id: createSlug(text)
        };
      });
  };

  const createNoteId = (title) => `note-${createSlug(title || 'untitled')}`;

  const ensureActiveNote = () => {
    if (state.activeNoteId && state.notes.some((note) => note.id === state.activeNoteId)) return;
    state.activeNoteId = state.notes[0]?.id || null;
    setActiveNoteId(state.activeNoteId);
    const current = state.notes.find((note) => note.id === state.activeNoteId);
    state.noteDraft = current ? { title: current.title, content: current.content } : { title: '', content: '' };
  };

  const saveNoteDraft = () => {
    if (!state.activeNoteId) return;
    const next = state.notes.map((note) => {
      if (note.id !== state.activeNoteId) return note;
      return {
        ...note,
        title: state.noteDraft.title,
        content: state.noteDraft.content,
        updatedAt: new Date().toISOString()
      };
    });
    state.notes = next.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    setNotes(state.notes);
  };

  const createNewNote = async () => {
    const note = {
      id: createNoteId(`笔记 ${Date.now()}`),
      title: '新笔记',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.notes.unshift(note);
    setNotes(state.notes);
    state.activeNoteId = note.id;
    setActiveNoteId(note.id);
    state.noteDraft = { title: note.title, content: note.content };
    await renderNotes();
  };

  const selectNote = async (id) => {
    const note = state.notes.find((item) => item.id === id);
    if (!note) return;
    state.activeNoteId = id;
    setActiveNoteId(id);
    state.noteDraft = { title: note.title, content: note.content };
    await renderNotes();
  };

  const deleteNote = async (id) => {
    state.notes = state.notes.filter((note) => note.id !== id);
    setNotes(state.notes);
    if (state.activeNoteId === id) {
      state.activeNoteId = state.notes[0]?.id || null;
      setActiveNoteId(state.activeNoteId);
      const next = state.notes.find((note) => note.id === state.activeNoteId);
      state.noteDraft = next ? { title: next.title, content: next.content } : { title: '', content: '' };
    }
    await renderNotes();
  };

  const renderNotes = async () => {
    refreshStateFromStorage();
    ensureActiveNote();
    const filteredNotes = state.notes.filter((note) => {
      const needle = state.noteSearch.trim().toLowerCase();
      if (!needle) return true;
      return `${note.title} ${note.content}`.toLowerCase().includes(needle);
    });
    const activeNote = state.notes.find((note) => note.id === state.activeNoteId) || null;

    app.innerHTML = `
      <section class="about">
        <h1>记笔记</h1>
        <p>支持新建、编辑、删除，并自动保存到本地。</p>
        <div class="actions">
          <button id="newNoteBtn" type="button">新建笔记</button>
          <a class="ghost" href="#/home">返回文章列表</a>
        </div>
      </section>

      <section class="notes-shell">
        <aside class="notes-list-panel">
          <div class="notes-toolbar">
            <input id="noteSearch" type="search" placeholder="搜索笔记" value="${escapeAttr(state.noteSearch)}" />
          </div>
          <div class="notes-list">
            ${filteredNotes.length ? filteredNotes.map((note) => `
              <button class="note-item ${note.id === state.activeNoteId ? 'active' : ''}" data-note-id="${escapeAttr(note.id)}" type="button">
                <strong>${escapeHtml(note.title || '未命名笔记')}</strong>
                <span>${escapeHtml(new Date(note.updatedAt).toLocaleString())}</span>
              </button>
            `).join('') : '<div class="empty">没有笔记，先新建一个吧。</div>'}
          </div>
        </aside>

        <section class="detail notes-editor">
          ${activeNote ? `
            <form id="noteForm" class="manage-form">
              <input id="noteTitle" name="title" placeholder="笔记标题" value="${escapeAttr(state.noteDraft.title)}" />
              <textarea id="noteContent" name="content" placeholder="开始记录吧">${escapeHtml(state.noteDraft.content)}</textarea>
              <div class="notes-hint">已自动保存到本地</div>
              <div class="actions">
                <button type="button" id="deleteNoteBtn" class="ghost">删除当前笔记</button>
              </div>
            </form>
          ` : '<div class="empty">没有可编辑的笔记，先创建一个。</div>'}
        </section>
      </section>
    `;

    const noteSearch = document.getElementById('noteSearch');
    if (noteSearch) {
      noteSearch.addEventListener('input', (e) => {
        state.noteSearch = e.target.value;
        renderNotes();
      });
    }

    const newNoteBtn = document.getElementById('newNoteBtn');
    if (newNoteBtn) newNoteBtn.addEventListener('click', createNewNote);

    document.querySelectorAll('[data-note-id]').forEach((btn) => {
      btn.addEventListener('click', () => selectNote(btn.dataset.noteId));
    });

    const noteTitle = document.getElementById('noteTitle');
    const noteContent = document.getElementById('noteContent');
    if (noteTitle && noteContent) {
      noteTitle.addEventListener('input', (e) => {
        state.noteDraft.title = e.target.value;
        saveNoteDraft();
      });
      noteContent.addEventListener('input', (e) => {
        state.noteDraft.content = e.target.value;
        saveNoteDraft();
      });
    }

    const deleteNoteBtn = document.getElementById('deleteNoteBtn');
    if (deleteNoteBtn && activeNote) {
      deleteNoteBtn.addEventListener('click', () => deleteNote(activeNote.id));
    }
  };

  const saveDraftPost = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const category = String(data.get('category') || 'Notes').trim() || 'Notes';
    const summary = String(data.get('summary') || '').trim();
    const content = String(data.get('content') || '').trim();

    if (!title || !summary || !content) {
      alert('标题、摘要和正文都要填写。');
      return;
    }

    const post = {
      id: createSlug(title),
      title,
      date: new Date().toISOString().slice(0, 10),
      category,
      summary,
      content
    };

    const localPosts = getLocalPosts();
    localPosts.unshift(post);
    setLocalPosts(localPosts);
    state.draft = { title: '', category, summary: '', content: '' };
    await renderManage();
  };

  const deleteLocalPost = async (id) => {
    const localPosts = getLocalPosts();
    const next = localPosts.filter((post) => post.id !== id);
    setLocalPosts(next);
    await renderManage();
    if (location.hash === `#/post/${encodeURIComponent(id)}`) {
      location.hash = '#/home';
    }
  };

  const hidePost = async (id) => {
    state.hiddenPostIds.add(id);
    setHiddenPosts(state.hiddenPostIds);
    await renderManage();
  };

  const unhidePost = async (id) => {
    state.hiddenPostIds.delete(id);
    setHiddenPosts(state.hiddenPostIds);
    await renderManage();
  };

  const renderManage = async () => {
    refreshStateFromStorage();
    await ensurePosts();
    const localPosts = getLocalPosts();
    const hiddenPosts = state.posts.filter((post) => state.hiddenPostIds.has(post.id));

    app.innerHTML = `
      <section class="about">
        <h1>内容管理</h1>
        <p>这里可以新增本地记录，也可以删除本地文件记录或隐藏现有文章。</p>
        <div class="actions">
          <a class="ghost" href="#/home">返回文章列表</a>
        </div>
      </section>

      <section class="detail">
        <h2>新增记录</h2>
        <form id="newPostForm" class="manage-form">
          <input name="title" placeholder="文章标题" value="${escapeAttr(state.draft.title)}" required />
          <input name="category" placeholder="分类" value="${escapeAttr(state.draft.category)}" />
          <input name="summary" placeholder="摘要" value="${escapeAttr(state.draft.summary)}" required />
          <textarea name="content" placeholder="Markdown 正文" rows="10" required>${escapeHtml(state.draft.content)}</textarea>
          <div class="actions">
            <button type="submit">保存到本地</button>
            <button class="ghost" id="resetDraft" type="button">清空</button>
          </div>
        </form>
      </section>

      <section class="detail">
        <h2>本地记录</h2>
        ${localPosts.length ? localPosts.map((post) => `
          <article class="manage-item">
            <div>
              <strong>${escapeHtml(post.title)}</strong>
              <div class="post-meta">
                <span class="tag">${escapeHtml(post.category)}</span>
                <span>${escapeHtml(post.date)}</span>
              </div>
            </div>
            <div class="actions">
              <a class="ghost" href="#/post/${encodeURIComponent(post.id)}">查看</a>
              <button class="ghost" data-delete-local="${escapeAttr(post.id)}" type="button">删除文件</button>
            </div>
          </article>
        `).join('') : '<div class="empty">当前还没有本地记录。</div>'}
      </section>

      <section class="detail">
        <h2>隐藏中的文章</h2>
        ${hiddenPosts.length ? hiddenPosts.map((post) => `
          <article class="manage-item">
            <div>
              <strong>${escapeHtml(post.title)}</strong>
              <div class="post-meta">
                <span class="tag">${escapeHtml(post.category)}</span>
                <span>${escapeHtml(post.date)}</span>
              </div>
            </div>
            <div class="actions">
              <button class="ghost" data-unhide="${escapeAttr(post.id)}" type="button">恢复显示</button>
            </div>
          </article>
        `).join('') : '<div class="empty">没有被隐藏的文章。</div>'}
      </section>

      <section class="detail">
        <h2>全部文章</h2>
        ${state.posts.map((post) => `
          <article class="manage-item">
            <div>
              <strong>${escapeHtml(post.title)}</strong>
              <div class="post-meta">
                <span class="tag">${escapeHtml(post.origin === 'local' ? 'Local' : 'Builtin')}</span>
                <span>${escapeHtml(post.date)}</span>
              </div>
            </div>
            <div class="actions">
              <a class="ghost" href="#/post/${encodeURIComponent(post.id)}">查看</a>
              ${post.origin === 'local'
                ? `<button class="ghost" data-delete-local="${escapeAttr(post.id)}" type="button">删除文件</button>`
                : `<button class="ghost" data-hide-post="${escapeAttr(post.id)}" type="button">隐藏</button>`}
            </div>
          </article>
        `).join('')}
      </section>
    `;

    document.getElementById('newPostForm').addEventListener('submit', saveDraftPost);
    document.getElementById('resetDraft').addEventListener('click', () => {
      state.draft = { title: '', category: 'Notes', summary: '', content: '' };
      renderManage();
    });

    document.querySelectorAll('[data-delete-local]').forEach((btn) => {
      btn.addEventListener('click', () => deleteLocalPost(btn.dataset.deleteLocal));
    });

    document.querySelectorAll('[data-hide-post]').forEach((btn) => {
      btn.addEventListener('click', () => hidePost(btn.dataset.hidePost));
    });

    document.querySelectorAll('[data-unhide]').forEach((btn) => {
      btn.addEventListener('click', () => unhidePost(btn.dataset.unhide));
    });
  };

  const renderPost = async (id) => {
    await ensurePosts();
    const post = state.posts.find((item) => item.id === id);
    if (!post) {
      app.innerHTML = `<section class="empty">文章不存在。<div class="actions"><a class="ghost" href="#/home">返回首页</a></div></section>`;
      return;
    }

    const html = renderMarkdown(post.markdown);
    const toc = buildToc(post.markdown);
    const relatedPosts = state.posts.filter((item) => item.id !== post.id).slice(0, 4);
    app.innerHTML = `
      <section class="article-shell">
        <header class="article-hero">
          <div class="article-hero-head">
            <span class="tag">${escapeHtml(post.category)}</span>
            <span class="article-date">${escapeHtml(post.date)}</span>
          </div>
          <h1>${escapeHtml(post.title)}</h1>
          <p>${escapeHtml(post.summary)}</p>
          <div class="actions">
            <a class="ghost" href="#/home">返回列表</a>
            <button id="copyLink" type="button">复制链接</button>
          </div>
        </header>

        <div class="article-grid">
          <aside class="article-side">
            <section class="article-panel">
              <h2>目录</h2>
              ${toc.length ? `<nav class="toc-list">${toc.map((item) => `<a class="toc-item level-${item.level}" href="#${escapeAttr(createSlug(item.text))}">${escapeHtml(item.text)}</a>`).join('')}</nav>` : '<div class="empty compact">这篇文章还没有小标题。</div>'}
            </section>

            <section class="article-panel">
              <h2>相关文章</h2>
              ${relatedPosts.length ? relatedPosts.map((item) => `
                <a class="related-item" href="#/post/${encodeURIComponent(item.id)}">
                  <strong>${escapeHtml(item.title)}</strong>
                  <span>${escapeHtml(item.category)} · ${escapeHtml(item.date)}</span>
                </a>
              `).join('') : '<div class="empty compact">暂无相关文章。</div>'}
            </section>
          </aside>

          <article class="article-reader">
            <div class="article-content">${html}</div>
          </article>
        </div>
      </section>
    `;

    document.getElementById('copyLink').addEventListener('click', async () => {
      const url = `${location.origin}${location.pathname}#/post/${encodeURIComponent(post.id)}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const temp = document.createElement('textarea');
        temp.value = url;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
      }
      document.getElementById('copyLink').textContent = '已复制';
      setTimeout(() => {
        const btn = document.getElementById('copyLink');
        if (btn) btn.textContent = '复制链接';
      }, 1200);
    });
  };

  const setActiveNav = (route) => {
    document.querySelectorAll('.nav a').forEach((link) => {
      link.classList.toggle('active', link.dataset.nav === route);
    });
  };

  const router = async () => {
    const hash = location.hash || '#/home';
    const [_, route, slug] = hash.split('/');

    if (route === 'post' && slug) {
      setActiveNav('home');
      await renderPost(decodeURIComponent(slug));
      return;
    }

    if (route === 'about') {
      setActiveNav('about');
      renderAbout();
      return;
    }

    if (route === 'notes') {
      setActiveNav('notes');
      await renderNotes();
      return;
    }

    if (route === 'manage') {
      setActiveNav('manage');
      await renderManage();
      return;
    }

    setActiveNav('home');
    await renderHome();
  };

  window.addEventListener('hashchange', router);
  router();
})();
