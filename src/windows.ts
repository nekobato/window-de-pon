import path from 'path';
import { ballSize, blockSize, barSize, Bounds, taskBarHeight } from './sizes';
import { BrowserWindow, Size } from 'electron';

export function createMenu(workAreaSize: Size) {
  const width = 750;
  let window = new BrowserWindow({
    x: workAreaSize.width / 2 - width / 2,
    y: 0,
    width,
    height: 380,
    show: false,
    resizable: true,
    center: false,
    webPreferences: {
      nodeIntegration: true,
      preload: path.resolve('./dist/preload.js'),
    },
  });
  window.loadURL('file://' + path.resolve(`./public/menu.html`));
  window.show();

  window.on('closed', function () {
    window = null;
  });

  return window;
}

export function createBall(bounds: Bounds) {
  let window = new BrowserWindow({
    ...bounds,
    // width: ballSize.w,
    // height: ballSize.h,
    useContentSize: true,
    show: false,
    resizable: false,
    center: false,
    webPreferences: {
      nodeIntegration: true,
      preload: path.resolve('./dist/preload.js'),
    },
    maximizable: false,
    minimizable: false,
    closable: false,
    fullscreenable: false,
  });
  window.loadURL('file://' + path.resolve(`./public/ball.html`));
  window.show();

  window.on('closed', function () {
    window = null;
  });

  return window;
}

export function createBlock(bounds: Bounds, type: string) {
  let window = new BrowserWindow({
    ...bounds,
    width: blockSize.w,
    height: blockSize.h,
    show: false,
    resizable: true,
    center: false,
    webPreferences: {
      nodeIntegration: true,
      preload: path.resolve('./dist/preload.js'),
    },
    minimizable: false,
    fullscreenable: false,
  });
  window.loadURL('file://' + path.resolve(`./public/blocks/${type}.html`));
  window.show();

  window.on('closed', function () {
    window = null;
  });

  return window;
}

export function createBar(bounds: Bounds) {
  let window = new BrowserWindow({
    ...bounds,
    width: barSize.w,
    height: barSize.h,
    show: false,
    resizable: true,
    center: false,
    webPreferences: {
      nodeIntegration: true,
      preload: path.resolve('./dist/preload.js'),
    },
    minimizable: false,
    closable: false,
    fullscreenable: false,
  });
  window.loadURL('file://' + path.resolve(`./public/bar.html`));
  window.show();

  window.on('closed', function () {
    window = null;
  });

  return window;
}

export function createBlocks(stageData: any, screen: Size) {
  const defaultPoint = {
    x: screen.width / 2 - blockSize.w * 7,
    y: 0 + taskBarHeight,
  };

  return stageData.blocks.map((blockLine: any[], colIndex: number) => {
    return blockLine.map((block: number, rowIndex) => {
      switch (block) {
        case 0:
          break;
        case 1:
          return createBlock(
            {
              x: defaultPoint.x + rowIndex * blockSize.w,
              y: defaultPoint.y + colIndex * blockSize.h,
            },
            'normal',
          );
        default:
          break;
      }
    });
  });
}
