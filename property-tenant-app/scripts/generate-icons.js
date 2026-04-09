const fs = require('fs');
const path = require('path');

// Basic SVG icons for tabbar
const icons = {
  'workorder': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="#909399" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7H3zm13-4H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/></svg>',
  'workorder_active': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#2979ff" d="M21 7H3v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7zM8 5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2H8V5z"/></svg>',
  'task': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="#909399" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2l4-4"/></svg>',
  'task_active': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#2979ff" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-3 15l-2-2l1.41-1.41L11 14.17l3.59-3.59L16 12l-5 5zM13 9V3.5L18.5 9H13z"/></svg>',
  'mine': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="#909399" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8a4 4 0 0 0 0 8z"/></svg>',
  'mine_active': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#2979ff" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4s-4 1.79-4 4s1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
};

const outputDir = path.join(__dirname, '../static/tabbar');

Object.entries(icons).forEach(([name, content]) => {
  fs.writeFileSync(path.join(outputDir, `${name}.svg`), content);
});
