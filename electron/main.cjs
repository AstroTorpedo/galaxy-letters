const { app, BrowserWindow, Menu, protocol, net, session, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SCHEME = 'galaxy';
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

app.whenReady().then(() => {
  const root = path.resolve(__dirname, '../dist');
  protocol.handle(SCHEME, request => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'app' || request.method !== 'GET') return new Response('Not found', { status: 404 });
      const file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (!file.startsWith(root + path.sep)) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    } catch { return new Response('Not found', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const createWindow = () => {
    const window = new BrowserWindow({
      width: 1366, height: 900, minWidth: 760, minHeight: 600,
      title: '21厘米：星系来信', backgroundColor: '#182630', show: false,
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, devTools: !app.isPackaged },
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const link = new URL(url);
        if (link.protocol === 'https:' && ['www.cv.nrao.edu', 'www.nrao.edu'].includes(link.hostname)) void shell.openExternal(link.toString());
      } catch { /* Ignore malformed/untrusted destinations. */ }
      return { action: 'deny' };
    });
    window.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(`${SCHEME}://app/`)) event.preventDefault();
    });
    window.once('ready-to-show', () => window.show());
    void window.loadURL(`${SCHEME}://app/index.html`);
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ label: '星系来信', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '显示', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'close' }] },
  ]));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
