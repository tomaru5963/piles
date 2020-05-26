import Phaser from 'phaser';

const BAR_LABEL_OFFSET = 17;
const FLOOR_THICKNESS = 200;
const FLOOR_BODY_CONFIG = {friction: 1, isStatic: true, restitution: 0};
const HEAD_ROOM = 300;
const PILE_BODY_CONFIG = {friction: 1, isStatic: true, restitution: 0};
const SCORE_LABEL_FORMAT = 'HIGH SCORE: %1\nSCORE %2';
const VAR_THRESHOLD = 1000;

const getRndColor = () => Phaser.Display.Color.RandomRGB().color;

/**
 * GameScene
 */
export default class GameScene extends Phaser.Scene {
  /**
   * constructor
   */
  constructor() {
    super('game-scene');
    this.highScore = 0;
  }

  /**
   * preload
   */
  preload() {
    this.load.image('cloud', 'assets/cloud.png');
  }

  /**
   * create
   */
  create() {
    // this.matter.step(1000 / (60 * 10), 1);

    this.bar = null;
    this.barLabel = null;
    this.floor = null;
    this.isGameOver = false;
    this.keys = null;
    this.lastPile = null;
    this.maxSpeed = 0;
    this.newPile = null;
    this.touchedPiles = [];
    this.score = 0;
    this.scoreLabel = null;

    const camera = this.cameras.main;
    const width = camera.width;
    const height = camera.height;

    // score label
    this.scoreLabel = this.add.text(10, 10, '', {
      fontFamily: 'Arial',
      fontSize: 15,
      color: '#ffffff',
    });
    this.scoreLabel.setDepth(1);
    this.scoreLabel.setScrollFactor(0);
    this.updateScoreLabel();

    // floor
    const floor = this.add.rectangle(
        width / 2, height + FLOOR_THICKNESS / 4,
        width, FLOOR_THICKNESS, getRndColor());
    this.matter.add.gameObject(floor, FLOOR_BODY_CONFIG);
    this.floor = floor;

    // bar and score
    const bar = this.add.line(width / 2, 0, 0, 0, width, 0, 0x333333);
    bar.y = height;
    const barLabel = this.add.text(10, bar.y - BAR_LABEL_OFFSET, '', {
      fontFamily: 'Arial',
      fontSize: 15,
      color: '#333333',
    });
    this.bar = bar;
    this.barLabel = barLabel;

    this.matter.world.on('collisionstart', (event) => {
      event.pairs.forEach((pair) => {
        const {bodyA, bodyB} = pair;
        if (bodyA.gameObject === this.lastPile ||
            bodyB.gameObject === this.lastPile) {
          this.touchedPiles.push(this.lastPile);
        }
      });
    });

    this.matter.world.on('collisionactive', (event) => {
      event.pairs.forEach((pair) => {
        const {bodyA, bodyB} = pair;
        if ((bodyA.gameObject === this.lastPile ||
            bodyB.gameObject === this.lastPile) &&
            this.bar.y > this.lastPile.y) {
          this.bar.y = this.lastPile.y;
          this.barLabel.y = this.bar.y - BAR_LABEL_OFFSET;
          this.score = Math.floor(height - this.bar.y);
          this.updateScoreLabel();
          this.barLabel.setText(`${this.score}`);
        }
      });

      // calc variance
      let ax = 0;
      this.touchedPiles.forEach((pile) => {
        ax += pile.x;
      });
      ax /= this.touchedPiles.length;

      let var_ = 0;
      this.touchedPiles.forEach((pile) => {
        const d = pile.x - ax;
        var_ += d * d;
      });

      // if the variance is too wide, it is game over
      // console.log(`var = ${var_}`);
      if (var_ > VAR_THRESHOLD) this.isGameOver = true;
    });

    const {LEFT, RIGHT, SPACE, A, D} = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({
      left: LEFT,
      right: RIGHT,
      space: SPACE,
      a: A,
      d: D,
    });

    this.spawnPile();
  }

  /**
   * update
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    const camera = this.cameras.main;

    if (this.isGameOver) {
      camera.startFollow(this.lastPile);

      camera.shake(3000, 0.05);
      camera.fade(3000, 0, 0, 0);
      camera.once('camerafadeoutcomplete', () => {
        this.scene.restart();
      });
    } else if (this.bar.y - camera.scrollY < HEAD_ROOM) {
      camera.scrollY -= 50;

      // put cloud on the screen?
      if (Math.random() < 0.3) {
        const x = Math.random() * camera.width;
        const y = camera.scrollY + Math.random() * 50;
        this.add.image(x, y, 'cloud').setScale(3);
      }
    }

    /*
    if (this.lastPile !== null && this.lastPile.body.velocity.y > 10) {
      this.lastPile.setVelocityY(10);
    }
    */

    if (this.newPile !== null) {
      // move ths new pile
      if (this.keys.left.isDown || this.keys.a.isDown) {
        this.newPile.x -= 1;
      } else if (this.keys.right.isDown || this.keys.d.isDown) {
        this.newPile.x += 1;
      }

      // release the new pile
      if (this.newPile !== null && this.keys.space.isDown) {
        this.newPile.setVelocityX(0);
        this.newPile.setStatic(false);
        this.lastPile = this.newPile;
        this.newPile = null;
        this.time.addEvent({
          callback: this.spawnPile,
          callbackScope: this,
          delay: 1000,
          repeat: 0,
        });
      }
    }

    // might need to limit the max speed of the pile to avoid body-pass-thru
    // because of non CCD support by matter.js
  }

  /**
   *
   */
  updateScoreLabel() {
    this.highScore = Math.max(this.highScore, this.score);
    const label = Phaser.Utils.String.Format(
        SCORE_LABEL_FORMAT,
        [this.highScore, this.score]);
    this.scoreLabel.setText(label);
  }

  /**
   *
   */
  spawnPile() {
    if (this.isGameOver) return;

    const rnd = Math.random();
    const x = this.cameras.main.width / 2 + Phaser.Math.Between(-30, 30);
    const y = this.bar.y - HEAD_ROOM;

    if (rnd < 4 / 7) {
      // rectangle
      const width = Phaser.Math.Between(40, 100);
      const height = Phaser.Math.Between(40, 100);
      this.newPile = this.createRectangle(x, y, width, height);
    } else {
      const radius = Phaser.Math.Between(20, 60);
      if (rnd < 6 / 7) {
        // hexagon
        this.newPile = this.createPolygon(x, y, 6, radius);
      } else {
        // octagon
        this.newPile = this.createPolygon(x, y, 8, radius);
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @return {Phaser.GameObjects.GameObject}
   */
  createRectangle(x, y, width, height) {
    const rect = this.add.rectangle(x, y, width, height, getRndColor());
    this.matter.add.gameObject(rect, PILE_BODY_CONFIG);
    return rect;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} sides
   * @param {number} radius
   * @return {Phaser.GameObjects.GameObject}
   */
  createPolygon(x, y, sides, radius) {
    const vertexes = [];
    const delta = Math.PI * 2 / sides;
    let [minX, minY] = [0, 0];
    for (let [i, rad] = [0, sides % 4 === 0 ? delta / 2 : 0];
      i < sides;
      i++, rad += delta) {
      const [x, y] = [Math.cos(rad), Math.sin(rad)];
      vertexes.push({x: x, y: y});
      [minX, minY] = [Math.min(minX, x), Math.min(minY, y)];
    }

    // give offsets to the vertexes
    vertexes.forEach((vertex) => {
      vertex.x -= minX;
      vertex.y -= minY;
    });

    const polygon = this.add.polygon(x, y, vertexes, getRndColor());
    this.matter.add.gameObject(
        polygon,
        this.matter.add.fromVertices(x, y, vertexes, PILE_BODY_CONFIG));
    polygon.setScale(radius);
    return polygon;
  }
}
