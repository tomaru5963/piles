import Phaser from 'phaser';

import GameScene from './scenes/GameScene';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#6888ff',
  physics: {
    default: 'matter',
    /*
    matter: {
      debug: {
        showVelocity: true,
      },
    },
    */
  },
  scene: [GameScene],
};

export default new Phaser.Game(config);
