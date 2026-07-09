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
    symbolResults: document.getElementById('symbol-results'),
    symbolsCount: document.getElementById('symbols-count'),
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
  let currentGraph = null;

  function clearGraph() {
    const graph = els.graphContainer.querySelector('.graph-canvas');
    if (graph) graph.remove();
  }

  function renderGraph(message) {
    if (els.graphOnboarding) els.graphOnboarding.hidden = true;
    if (els.graphPlaceholder) els.graphPlaceholder.hidden = true;
    clearGraph();
    const nodes = message.nodes || [];
    if (nodes.length === 0) {
      els.graphPlaceholder.hidden = false;
      els.graphPlaceholder.innerHTML = '<p>No callable symbols found in this file.</p><p class="hint">Select another indexed source file.</p>';
      return;
    }

    const canvas = document.createElement('div');
    canvas.className = 'graph-canvas';
    const width = Math.max(260, els.graphContainer.clientWidth - 16);
    const rowHeight = 54;
    const height = Math.max(220, Math.ceil(nodes.length / 2) * rowHeight + 24);
    canvas.style.height = `${height}px`;
    const positions = new Map();
    nodes.forEach((node, index) => positions.set(node.id, {
      x: 16 + (index % 2) * Math.max(110, (width - 150) / 2),
      y: 16 + Math.floor(index / 2) * rowHeight,
    }));

    const nodeEls = new Map();
    const state = { scale: 1, selectedId: message.focusedId || nodes[0].id, impactIds: new Set(), dragging: null };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = '<marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="currentColor"/></marker>';
    svg.appendChild(defs);
    const edgeEls = [];
    const draw = () => {
      svg.style.transform = `scale(${state.scale})`;
      for (const entry of edgeEls) {
        const from = positions.get(entry.edge.source); const to = positions.get(entry.edge.target);
        if (!from || !to) continue;
        entry.el.setAttribute('x1', String(from.x + 92)); entry.el.setAttribute('y1', String(from.y + 16));
        entry.el.setAttribute('x2', String(to.x)); entry.el.setAttribute('y2', String(to.y + 16));
        const related = state.selectedId && (entry.edge.source === state.selectedId || entry.edge.target === state.selectedId);
        entry.el.classList.toggle('is-related', related);
      }
      for (const node of nodes) {
        const item = nodeEls.get(node.id); const pos = positions.get(node.id);
        item.style.left = `${pos.x}px`; item.style.top = `${pos.y}px`;
        item.classList.toggle('is-selected', node.id === state.selectedId);
        item.classList.toggle('is-impacted', state.impactIds.has(node.id));
        const related = !state.selectedId || node.id === state.selectedId || (message.edges || []).some(e => (e.source === state.selectedId && e.target === node.id) || (e.target === state.selectedId && e.source === node.id));
        item.classList.toggle('is-muted', !related && state.impactIds.size === 0);
      }
    };
    for (const edge of message.edges || []) {
      const from = positions.get(edge.source); const to = positions.get(edge.target);
      if (!from || !to) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'graph-edge'); line.setAttribute('marker-end', 'url(#arrow)');
      svg.appendChild(line); edgeEls.push({ edge, el: line });
    }
    canvas.appendChild(svg);
    const toolbar = document.createElement('div'); toolbar.className = 'graph-controls';
    toolbar.innerHTML = '<button data-action="zoom-out" title="Zoom out">−</button><span class="zoom-label">100%</span><button data-action="zoom-in" title="Zoom in">+</button><button data-action="reset" title="Reset layout">↺</button><button data-action="clear-impact" title="Clear highlight">Clear</button>';
    toolbar.addEventListener('click', event => {
      const action = event.target.dataset.action;
      if (action === 'zoom-in') state.scale = Math.min(2, state.scale + 0.1);
      if (action === 'zoom-out') state.scale = Math.max(0.5, state.scale - 0.1);
      if (action === 'reset') { state.scale = 1; nodes.forEach((node, index) => positions.set(node.id, { x: 16 + (index % 2) * Math.max(110, (width - 150) / 2), y: 16 + Math.floor(index / 2) * rowHeight })); }
      if (action === 'clear-impact') { state.impactIds.clear(); state.selectedId = null; }
      toolbar.querySelector('.zoom-label').textContent = `${Math.round(state.scale * 100)}%`; draw();
    });
    canvas.appendChild(toolbar);
    for (const node of nodes) {
      const item = document.createElement('button'); const pos = positions.get(node.id);
      item.className = 'graph-node'; item.style.left = `${pos.x}px`; item.style.top = `${pos.y}px`;
      item.dataset.nodeId = node.id;
      item.title = `${node.filePath}:${node.line}`;
      item.innerHTML = `<span class="graph-kind">${escapeHtml(node.kind)}</span><span>${escapeHtml(node.name)}</span>`;
      item.addEventListener('click', () => { state.selectedId = node.id; state.impactIds.clear(); draw(); vscode.postMessage({ command: 'showNodeImpact', nodeId: node.id }); });
      item.addEventListener('dblclick', () => vscode.postMessage({ command: 'findReferences', nodeId: node.id }));
      item.addEventListener('contextmenu', event => showContextMenu(event, node, canvas));
      item.addEventListener('pointerdown', event => { state.dragging = { id: node.id, x: event.clientX - pos.x, y: event.clientY - pos.y }; item.setPointerCapture(event.pointerId); });
      item.addEventListener('pointermove', event => { if (!state.dragging || state.dragging.id !== node.id) return; positions.set(node.id, { x: Math.max(0, event.clientX - state.dragging.x), y: Math.max(0, event.clientY - state.dragging.y) }); draw(); });
      item.addEventListener('pointerup', () => { state.dragging = null; });
      nodeEls.set(node.id, item); canvas.appendChild(item);
    }
    currentGraph = state;
    draw();
    els.graphContainer.appendChild(canvas);
  }

  function showContextMenu(event, node, canvas) {
    event.preventDefault();
    const old = canvas.querySelector('.context-menu'); if (old) old.remove();
    const menu = document.createElement('div'); menu.className = 'context-menu';
    menu.innerHTML = '<button data-action="copy">Copy symbol</button><button data-action="definition">Go to definition</button><button data-action="references">Show references</button>';
    menu.style.left = `${Math.min(event.offsetX, canvas.clientWidth - 130)}px`; menu.style.top = `${Math.min(event.offsetY, canvas.clientHeight - 100)}px`;
    menu.addEventListener('click', click => { const action = click.target.dataset.action; if (action === 'copy') vscode.postMessage({ command: 'copySymbol', symbol: node.name }); if (action === 'definition') vscode.postMessage({ command: 'navigateToSymbol', file: node.file, line: node.line }); if (action === 'references') vscode.postMessage({ command: 'findReferences', nodeId: node.id }); menu.remove(); });
    canvas.appendChild(menu);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

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

  function renderSymbolResults(symbols) {
    els.symbolResults.innerHTML = '';
    els.symbolsCount.textContent = symbols.length ? `(${symbols.length})` : '';
    if (!symbols.length) {
      els.symbolResults.innerHTML = '<div class="empty-list">No symbols matched.</div>';
      return;
    }
    for (const symbol of symbols) {
      const item = document.createElement('button');
      item.className = 'symbol-item';
      item.title = `${symbol.filePath}:${symbol.line}`;
      item.innerHTML = `<span class="symbol-kind">${escapeHtml(symbol.kind)}</span><span>${escapeHtml(symbol.name)}</span>`;
      item.addEventListener('click', () => {
        vscode.postMessage({ command: 'navigateToSymbol', file: symbol.file, line: symbol.line });
        vscode.postMessage({ command: 'findReferences', nodeId: symbol.id });
      });
      els.symbolResults.appendChild(item);
    }
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
      renderSymbolResults([]);
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
        vscode.postMessage({ command: 'showFileGraph', file });
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
        renderSymbolResults(message.symbols || []);
        break;
      }
      case 'stats': {
        renderStats(message.stats);
        setInitialized(!!message.stats.initialized);
        break;
      }
      case 'graph': {
        renderGraph(message);
        break;
      }
      case 'impact': {
        if (currentGraph) {
          currentGraph.impactIds = new Set(message.ids || []);
          const canvas = els.graphContainer.querySelector('.graph-canvas');
          if (canvas) canvas.querySelectorAll('.graph-node').forEach(item => item.classList.toggle('is-impacted', currentGraph.impactIds.has(item.dataset.nodeId)));
        }
        break;
      }
      case 'toast': {
        els.stats.textContent = message.message;
        setTimeout(() => renderStats({ root: 'CodeGraph', files: allFiles.length, initialized: isInitialized, dbSizeBytes: 0, totalSizeBytes: 0 }), 1200);
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
