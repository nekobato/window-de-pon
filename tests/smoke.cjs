const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

const testData = fs.mkdtempSync(path.join(os.tmpdir(), 'window-de-pon-test-'));
process.chdir(testData);
app.setPath('userData', testData);
app.setAppLogsPath(path.join(testData, 'logs'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-background-networking');
BrowserWindow.prototype.show = function () {};

const preloadErrors = [];
app.on('browser-window-created', (_, window) => {
  window.webContents.on('console-message', (details) => {
    if (details?.level === 'error') console.error(`Renderer: ${details.message}`);
  });
  window.webContents.on('preload-error', (_, preload, error) => {
    preloadErrors.push(`${preload}: ${error.message}`);
  });
});

const timeout = setTimeout(() => finish(1, new Error('Smoke test timed out')), 20000);
function finish(code, error) {
  clearTimeout(timeout);
  if (error) console.error(error);
  app.removeAllListeners('window-all-closed');
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.webContents.getURL().endsWith('/bar.html')) window.destroy();
  }
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  fs.rmSync(testData, { recursive: true, force: true });
  if (code === 0) app.quit();
  else app.exit(code);
}

async function waitFor(predicate) {
  const deadline = Date.now() + 4000;
  while (!(await predicate())) {
    if (Date.now() >= deadline) throw new Error('Expected game state was not reached');
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

async function loaded(window) {
  if (window.webContents.isLoading()) {
    await new Promise((resolve) => window.webContents.once('did-finish-load', resolve));
  }
}

require(process.env.WINDOW_DE_PON_SMOKE_MAIN || '../dist/main.js');
app
  .whenReady()
  .then(async () => {
    try {
      const menu = BrowserWindow.getAllWindows()[0];
      console.log('Smoke: menu ready');
      assert.ok(menu, 'menu window exists');
      await loaded(menu);
      assert.equal(await menu.webContents.executeJavaScript('typeof require'), 'undefined');
      assert.equal(await menu.webContents.executeJavaScript('typeof window.ipc.send'), 'function');
      const rejected = await menu.webContents.executeJavaScript(`(() => {
      try { window.ipc.send('arbitrary-channel', 'bad'); return false; }
      catch { return true; }
    })()`);
      assert.equal(rejected, true, 'bridge rejects unrelated channels');

      await menu.webContents.executeJavaScript("document.querySelector('.menu-item').click()");
      console.log('Smoke: stage selected');
      await waitFor(() =>
        BrowserWindow.getAllWindows().some((window) =>
          window.webContents.getURL().endsWith('/bar.html'),
        ),
      );
      const bar = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getURL().endsWith('/bar.html'),
      );
      await loaded(bar);
      console.log('Smoke: bar ready');
      assert.deepEqual(preloadErrors, []);
      assert.equal(await bar.webContents.executeJavaScript('typeof require'), 'undefined');
      assert.equal(await bar.webContents.executeJavaScript('typeof gameIpc.send'), 'function');

      assert.equal(ipcMain.listenerCount('KEY_DOWN'), 1, 'keydown handler is registered once');
      const receivedKeys = [];
      ipcMain.on('KEY_DOWN', (_, key) => receivedKeys.push(key));
      await bar.webContents.executeJavaScript(
        "document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 13, bubbles: true }))",
      );
      await waitFor(() => receivedKeys.includes('enter'));
      console.log('Smoke: enter delivered');
      await waitFor(() =>
        BrowserWindow.getAllWindows().some((window) =>
          window.webContents.getURL().endsWith('/ball.html'),
        ),
      );
      console.log('Smoke: ball created');
      assert.ok(
        BrowserWindow.getAllWindows().some((window) =>
          window.webContents.getURL().endsWith('/ball.html'),
        ),
        'first keydown creates a ball',
      );

      const initialX = bar.getBounds().x;
      await bar.webContents.executeJavaScript(
        "document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 39, bubbles: true }))",
      );
      await waitFor(() => bar.getBounds().x > initialX);
      console.log('Smoke: movement verified');
      await bar.webContents.executeJavaScript(
        "document.dispatchEvent(new KeyboardEvent('keyup', { keyCode: 39, bubbles: true }))",
      );

      await bar.webContents.executeJavaScript(`(() => {
      window.ipc.on('smoke-forward', (...args) => {
        window.smokeArgs = args;
      });
    })()`);
      bar.webContents.send('smoke-forward', 'payload');
      await waitFor(
        async () => await bar.webContents.executeJavaScript('Boolean(window.smokeArgs)'),
      );
      assert.equal(
        await bar.webContents.executeJavaScript('JSON.stringify(window.smokeArgs)'),
        '["payload"]',
        'bridge callback does not expose the IPC event',
      );
      assert.deepEqual(preloadErrors, []);
      bar.destroy();
      assert.equal(ipcMain.listenerCount('KEY_DOWN'), 1, 'only the test observer remains');
      assert.equal(ipcMain.listenerCount('KEY_UP'), 0, 'stage keyup listener is disposed');
      console.log(
        'PASS: menu, isolated preload, stage, first keydown, movement, IPC payload safety, disposal',
      );
      finish(0);
    } catch (error) {
      finish(1, error);
    }
  })
  .catch((error) => finish(1, error));
