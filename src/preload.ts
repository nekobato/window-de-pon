import { contextBridge, ipcRenderer } from 'electron';

const gameKeys = new Set(['left', 'right', 'enter', 'space']);

// --------- Expose some API to the Renderer process. ---------
contextBridge.exposeInMainWorld('ipc', {
  send(event: string, payload: unknown) {
    const stageMessage = event === 'STAGE_SELECT' && payload === 1;
    const keyMessage =
      (event === 'KEY_DOWN' || event === 'KEY_UP') &&
      typeof payload === 'string' &&
      gameKeys.has(payload);
    if (!stageMessage && !keyMessage) {
      throw new Error('Unsupported game message');
    }
    ipcRenderer.send(event, payload);
  },
  async invoke(event: string, payload: any) {
    const result = await ipcRenderer.invoke('renderer-event', event, payload);
    console.log('result', event, result);
    return result;
  },
  on(event: string, callback: (...args: any[]) => void) {
    ipcRenderer.on(event, (_, ...args: any[]) => callback(...args));
  },
});

contextBridge.exposeInMainWorld('openUrl', (e: Event, url: string) => {
  e.preventDefault();
  ipcRenderer.send('open-url', { data: url });
});
