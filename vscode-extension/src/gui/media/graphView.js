(function() {
  const vscode = acquireVsCodeApi();
  
  const searchInput = document.getElementById('search');
  const fileTree = document.getElementById('file-tree');
  const graphContainer = document.getElementById('graph-container');
  const statsElement = document.getElementById('stats');
  
  // Handle messages from the extension
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
      case 'updateStats':
        statsElement.textContent = `Files: ${message.stats.files} | Nodes: ${message.stats.nodes} | Edges: ${message.stats.edges}`;
        break;
    }
  });
  
  // Handle search input
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length > 0) {
      vscode.postMessage({
        command: 'searchSymbol',
        symbol: query
      });
    }
  });
  
  // Handle file tree item click
  fileTree.addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('file-item')) {
      const file = target.dataset.file;
      if (file) {
        vscode.postMessage({
          command: 'navigateToFile',
          file: file
        });
      }
    }
  });
  
  // Initialize with placeholder content
  fileTree.innerHTML = '<p style="color: var(--vscode-descriptionForeground);">File browser will be available after core integration</p>';
  graphContainer.innerHTML = '<p>Graph visualization will be available after core integration</p>';
  statsElement.textContent = 'Loading...';
})();
