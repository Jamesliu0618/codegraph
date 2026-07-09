(function() {
  const vscode = acquireVsCodeApi();

  const ICONS = {
    folder: '▸',
    file: '·',
  };

  const els = {
    search: document.getElementById('search'),
    refresh: document.getElementById('refresh'),
    fileTree: document.getElementById('file-tree'),
    filesCount: document.getElementById('files-count'),
    graphContainer: document.getElementById('graph-container'),
    graphOnboarding: document.getElementById('graph-onboarding'),
    graphPlaceholder: document.getElementById('graph-placeholder'),
    stats: document.getElementById('stats'),
    emptyState: document.getElementById('empty-state'),
    content: document.getElementById('content'),
    actions: document.getElementById('actions'),
    btnInitialize: document.getElementById('btn-initialize'),
    btnIndex: document.getElementById('btn-index'),
  };

  let allFiles = [];
  let isInitialized = false;

  // ---- Rendering ----

  function renderFileTree(files) {
    if (!files || files.length === 0) {
      els.fileTree.innerHTML =
        '<div class="empty-list">No code files matched.<br><span class="hint">Try a different filter, or open a workspace folder.</span></div>';
      return;
    }
    const tree = buildTree(files);
    els.fileTree.innerHTML = '';
    els.fileTree.appendChild(renderNode(tree, ''));
  }

  function buildTree(files) {
    const root = { name: '', children: new Map(), files: [] };
    for (const f of files) {
      const parts = f.relPath.split('/');
      let cursor = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!cursor.children.has(part)) {
          cursor.children.set(part, { name: part, children: new Map(), files: [] });
        }
        cursor = cursor.children.get(part);
      }
      cursor.files.push(f);
    }
    return root;
  }

  function renderNode(node, relBase) {
    const container = document.createElement('div');
    container.className = 'tree-node';

    const dirNames = [...node.children.keys()].sort();
    for (const dirName of dirNames) {
      const child = node.children.get(dirName);
      const childRel = relBase ? `${relBase}/${dirName}` : dirName;
      const details = document.createElement('details');
      details.open = relBase === ''; // expand top-level only
      const summary = document.createElement('summary');
      summary.textContent = `${ICONS.folder} ${dirName}/`;
      summary.className = 'dir';
      details.appendChild(summary);
      details.appendChild(renderNode(child, childRel));
      container.appendChild(details);
    }

    for (const f of node.files.sort((a, b) => a.name.localeCompare(b.name))) {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.dataset.file = f.absPath;
      item.title = `${f.relPath}  (${formatSize(f.size)})`;
      item.textContent = `${ICONS.file} ${f.name}`;
      container.appendChild(item);
    }
    return container;
  }

  function renderStats(stats) {
    if (!stats || !stats.root) {
      els.stats.textContent = 'No workspace open';
      return;
    }
    const db = stats.initialized
      ? `DB: ${formatSize(stats.dbSizeBytes)}`
      : 'DB: not initialized';
    els.stats.textContent =
      `${stats.root.split(/[\\/]/).pop()} · ${stats.files} files · ${formatSize(stats.totalSizeBytes)} · ${db}`;
  }

  function showEmptyState(show) {
    els.emptyState.hidden = !show;
    els.content.hidden = show;
    els.actions.hidden = show || isInitialized;
  }

  function setInitialized(value) {
    isInitialized = value;
    if (els.actions) {
      els.btnIndex.disabled = !value;
      els.actions.hidden = value;
    }
    // Right-side panel: onboarding card before init, placeholder after.
    // The two states are mutually exclusive, so just flip the hidden flag.
    if (els.graphOnboarding) els.graphOnboarding.hidden = value;
    if (els.graphPlaceholder) els.graphPlaceholder.hidden = !value;
  }

  // ---- Utilities ----

  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // ---- Event wiring ----

  els.refresh.addEventListener('click', () => {
    vscode.postMessage({ command: 'refreshFiles' });
  });

  els.btnInitialize.addEventListener('click', () => {
    vscode.postMessage({ command: 'initialize' });
  });

  els.btnIndex.addEventListener('click', () => {
    vscode.postMessage({ command: 'indexWorkspace' });
  });

  els.search.addEventListener('input', debounce((e) => {
    const q = e.target.value;
    if (q.trim().length === 0) {
      renderFileTree(allFiles);
      els.filesCount.textContent = allFiles.length > 0 ? `(${allFiles.length})` : '';
      return;
    }
    vscode.postMessage({ command: 'searchFiles', query: q });
  }, 200));

  els.fileTree.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('file-item')) {
      const file = target.dataset.file;
      if (file) {
        vscode.postMessage({ command: 'navigateToFile', file });
      }
    }
  });

  // ---- Message handling ----

  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'files': {
        allFiles = message.files || [];
        if (message.totalCount > message.files.length) {
          els.filesCount.textContent = `(${message.files.length} of ${message.totalCount})`;
        } else if (message.totalCount > 0) {
          els.filesCount.textContent = `(${message.totalCount})`;
        } else {
          els.filesCount.textContent = '';
        }
        if (message.root) {
          showEmptyState(false);
          renderFileTree(allFiles);
        } else {
          showEmptyState(true);
        }
        break;
      }
      case 'searchResults': {
        renderFileTree(message.matches || []);
        els.filesCount.textContent = `(${message.matches.length} matches)`;
        break;
      }
      case 'stats': {
        renderStats(message.stats);
        setInitialized(!!message.stats.initialized);
        break;
      }
      case 'error': {
        els.stats.textContent = `Error: ${message.message}`;
        break;
      }
    }
  });

  // Tell the host we're mounted and ready for the initial state push.
  vscode.postMessage({ command: 'ready' });
})();
