'use strict';

async function main() {
  const item = document.querySelector('.menu-item');
  item.addEventListener('click', () => {
    window.ipc.send('STAGE_SELECT');
    console.log('STAGE_SELECT');
  });
}

main();
