import electron from 'electron';
import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import { barSize } from './sizes';
import { withBlock, withBar, withScreen } from './collision';
import { createBall, createBar, createBlocks, createMenu } from './windows';

let menuWindow: BrowserWindow = null;

function createStage(stageNumber: number) {
  const stageData = require(`../public/data/stages/stage${stageNumber}`);
  const { workAreaSize } = electron.screen.getPrimaryDisplay();

  // create Blocks
  const blockWindows = createBlocks(stageData, workAreaSize);

  // create Bar
  let barX = workAreaSize.width / 2 - barSize.w / 2;
  const barWindow = createBar({
    x: barX,
    y: workAreaSize.height - barSize.h,
  });

  // create Ball
  const ballWindows: BrowserWindow[] = [];
  const ballPositions: { x: number; y: number; vx: number; vy: number }[] = [];

  let movingLeft = false;
  let movingRight = false;

  function onKeyDown(_: any, payload: any) {
    switch (payload) {
      case 'left':
        movingLeft = true;
        break;
      case 'right':
        movingRight = true;
        break;
      case 'space':
        barWindow.setBounds({
          y: workAreaSize.height,
        } as electron.Rectangle);
        break;
      case 'enter':
        let y = workAreaSize.height - barSize.h;
        ballWindows.push(
          createBall({
            x: barX,
            y,
          }),
        );
        ballPositions.push({
          x: barX,
          y,
          vy: 4,
          vx: 3,
        });

      default:
        break;
    }
  }
  ipcMain.on('KEY_DOWN', onKeyDown);
  function onKeyUp(_: any, payload: any) {
    switch (payload) {
      case 'left':
        movingLeft = false;
        break;
      case 'right':
        movingRight = false;
        break;
      case 'space':
        barWindow.setBounds({
          y: workAreaSize.height - barSize.h,
        } as electron.Rectangle);
        break;
    }
  }
  ipcMain.on('KEY_UP', onKeyUp);

  const gameLoop = setInterval(() => {
    // Bar
    if (movingLeft) {
      barX -= 16;
    } else if (movingRight) {
      barX += 16;
    }
    barWindow.setBounds({
      x: barX,
    } as electron.Rectangle);

    // Balls
    ballWindows.forEach((window, ballIndex) => {
      const ballWindowBounds = window.getBounds();

      // collision with Bar
      if (withBar(ballWindowBounds, barWindow.getBounds())) {
        // Bar reflects only when the ball go down
        if (ballPositions[ballIndex].vy > 0) {
          ballPositions[ballIndex].vy *= -1;
        }
      } else {
        blockWindows.forEach((blockRow: BrowserWindow[], rowIndex: number) => {
          blockRow.forEach((blockWindow: BrowserWindow | undefined | null, blockIndex) => {
            if (!blockWindow) {
              return;
            }

            // collision with Block
            switch (withBlock(ballWindowBounds, blockWindow.getBounds())) {
              case 'top':
              case 'bottom':
                blockWindow.close();
                blockWindows[rowIndex][blockIndex] = null;
                ballPositions[ballIndex].vy *= -1;
                break;
              case 'left':
              case 'right':
                blockWindow.close();
                blockWindows[rowIndex][blockIndex] = null;
                ballPositions[ballIndex].vx *= -1;
                break;
              default:
                break;
            }
          });
        });
      }

      switch (withScreen(ballPositions[ballIndex], workAreaSize)) {
        case 'top':
        case 'bottom':
          ballPositions[ballIndex].vy *= -1;
          break;
        case 'left':
        case 'right':
          ballPositions[ballIndex].vx *= -1;
          break;
      }

      // ballPositions[i].vy += ballPositions[i].vy < 8 ? GRAVITY : 0;
      ballPositions[ballIndex].x += ballPositions[ballIndex].vx;
      ballPositions[ballIndex].y += ballPositions[ballIndex].vy;
      window.setBounds({
        x: Math.round(ballPositions[ballIndex].x),
        y: Math.round(ballPositions[ballIndex].y),
      } as electron.Rectangle);
    });
  }, 16.6); // 60fps

  function disposeStage() {
    clearInterval(gameLoop);
    ipcMain.removeListener('KEY_DOWN', onKeyDown);
    ipcMain.removeListener('KEY_UP', onKeyUp);
  }
  app.once('before-quit', disposeStage);
  barWindow.once('closed', () => {
    disposeStage();
    app.removeListener('before-quit', disposeStage);
  });
}

app.on('ready', () => {
  const { workAreaSize } = electron.screen.getPrimaryDisplay();
  menuWindow = createMenu(workAreaSize);

  ipcMain.on('STAGE_SELECT', (event, stageNumber: number) => {
    if (event.sender !== menuWindow.webContents || stageNumber !== 1) {
      return;
    }
    console.log('stage select', stageNumber);
    menuWindow.hide();
    createStage(stageNumber);
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    app.quit();
  }
});

// app.on("activate", function() {
//   if (screenWindow === null) {
//     createWindow();
//   }
// });
