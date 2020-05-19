import { rgbFromIndex, transparent, toRGB332 } from './lib/colour.js';

export const pixelLength = 256;
const width = 16;

export const colourTable = Array.from({ length: pixelLength }, (_, i) => {
  return rgbFromIndex(i);
});

export function getCoords(e, w = width, h = w) {
  const rect = e.target.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / w) | 0; //x position within the element.
  const y = ((e.clientY - rect.top) / h) | 0; //y position within the element.
  const index = xyToIndex({ x, y, w: 16 });
  return { x, y, index };
}

export function emptyCanvas(ctx) {
  const blankData = new Uint8ClampedArray(
    ctx.canvas.width * ctx.canvas.height * 4
  );
  // blankData.fill(transparent);
  for (let i = 0; i < blankData.length; i += 4) {
    blankData[i + 0] = 0;
    blankData[i + 1] = 0;
    blankData[i + 2] = 0;
    blankData[i + 3] = 0;
  }

  const blank = new ImageData(blankData, ctx.canvas.width, ctx.canvas.height);
  ctx.putImageData(blank, 0, 0);
}

export function xyToIndex({ x, y, w = width }) {
  if (x < 0) {
    return null;
  }

  if (x >= w) {
    return null;
  }

  if (y >= w) {
    return null;
  }

  return w * y + x;
}

export class Sprite {
  scale = 16;
  subSprite = 0; // only used when 8x8

  /**
   *
   * @param {Uint8Array} pixels
   */
  constructor(pixels) {
    this.pixels = pixels;
    this.ctx = document.createElement('canvas').getContext('2d');
    this.ctx.canvas.width = this.ctx.canvas.height = width;
    this.render();
  }

  get canvas() {
    return this.ctx.canvas;
  }

  pget({ index = null, x = null, y }) {
    index = xyToIndex({ x, y, w: this.scale });

    if (this.scale === 8) {
      index += this.subSprite * 64;
    }

    return this.pixels[index];
  }

  pset({ index = null, x = null, y, value }) {
    index = xyToIndex({ x, y, w: this.scale });

    if (this.scale === 8) {
      index += this.subSprite * 64;
    }

    this.pixels[index] = value;
    this.render();
  }

  clear() {
    if (this.scale === 16) {
      this.pixels.fill(transparent);
    } else {
      const empty = new Uint8Array(64);
      empty.fill(transparent);
      this.pixels.set(empty, 64 * this.subSprite);
    }
    this.render();
  }

  mirror(horizontal = true) {
    return new Promise((resolve) => {
      const i = new Image();
      const url = this.canvas.toDataURL(); // needed over a blob because blob is apparently a reference
      i.src = url;
      i.onload = () => {
        this.ctx.clearRect(0, 0, width, width);
        this.ctx.save();
        if (horizontal) {
          this.ctx.scale(-1, 1);
          this.ctx.drawImage(i, 0, 0, -width, width); //, -width, 0);
        } else {
          this.ctx.scale(1, -1);
          this.ctx.drawImage(i, 0, 0, width, -width);
        }
        this.ctx.restore();
        this.canvasToPixels();
        resolve();
      };
    });
  }

  rotate() {
    return new Promise((resolve) => {
      const i = new Image();
      const url = this.canvas.toDataURL(); // needed over a blob because blob is apparently a reference
      i.src = url;
      i.onload = () => {
        this.ctx.clearRect(0, 0, width, width);
        this.ctx.translate(width / 2, width / 2);
        this.ctx.rotate((90 * Math.PI) / 180); // 90deg
        this.ctx.drawImage(i, -width / 2, -width / 2);
        this.ctx.rotate((-90 * Math.PI) / 180);
        this.ctx.translate(-width / 2, -width / 2);
        this.canvasToPixels();
        resolve();
      };
    });
  }

  canvasToPixels() {
    const imageData = this.ctx.getImageData(0, 0, width, width);
    for (let i = 0; i < imageData.data.length / 4; i++) {
      const [r, g, b, a] = imageData.data.slice(i * 4, i * 4 + 4);

      if (a === 0) {
        this.pixels[i] = transparent;
      } else {
        this.pixels[i] = toRGB332(r, g, b);
      }
    }
  }

  render(dx = 0, dy = 0) {
    const pixels = this.pixels;

    // imageData is the internal copy
    const width = this.scale;
    const imageData = this.ctx.getImageData(0, 0, width, width);

    let i = 0;
    let j = pixels.length;
    if (this.scale === 8) {
      i = this.subSprite * 64;
      j = i + 64;
    }

    let ptr = 0;

    for (i; i < j; i++) {
      let index = pixels[i];

      const { r, g, b, a } = colourTable[index];
      imageData.data[ptr * 4 + 0] = r;
      imageData.data[ptr * 4 + 1] = g;
      imageData.data[ptr * 4 + 2] = b;
      imageData.data[ptr * 4 + 3] = a * 255;
      ptr++;
    }

    if (dx !== 0 || dy !== 0) {
      emptyCanvas(this.ctx);
    }

    this.ctx.putImageData(
      imageData,
      dx,
      dy,
      0,
      0,
      imageData.width,
      imageData.height
    );
  }

  // we always paint square…
  paint(ctx, dx = 0, dy = 0, w = null) {
    if (w === null) {
      w = ctx.canvas.width;
    }

    // clear, set to jaggy and scale to canvas
    ctx.clearRect(dx, dy, w, w);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.ctx.canvas,
      0,
      0,
      this.ctx.canvas.width,
      this.ctx.canvas.height,
      dx,
      dy,
      w,
      w
    );
  }

  setScale(scale, index = false) {
    if (index !== false) {
      this.subSprite = index;
    }
    this.scale = scale;
    const canvas = this.ctx.canvas;
    canvas.width = canvas.height = this.scale;
    this.render();
  }

  toggleScale(index = false) {
    this.setScale(this.scale === 16 ? 8 : 16, index);
  }
}

export default class SpriteSheet {
  sprites = [];
  previewCtx = [];
  history = [];
  ctx = null;
  _undoPtr = 0;
  _current = 0;
  length = 0;
  clipboard = null;
  hooks = [];

  constructor(data, { ctx, scale = 2, subSprites } = {}) {
    this.data = new Uint8Array(pixelLength * 4 * 16);
    this.data.set(data.slice(0, pixelLength * 4 * 16), 0);

    for (let i = 0; i < this.data.length; i += pixelLength) {
      const spriteData = this.data.subarray(i, i + pixelLength);
      const sprite = new Sprite(spriteData);
      this.sprites.push(sprite);

      const ctx = document.createElement('canvas').getContext('2d');
      ctx.canvas.width = ctx.canvas.height = width * scale;
      this.previewCtx.push(ctx);
      sprite.paint(ctx);
    }

    this.snapshot();
    this.length = data.length / pixelLength;
    this._current = 0;
    this.scale = scale;
    this.ctx = ctx;
    this.ctx.canvas.dataset.scale = this.scale;
    this.subSprites = subSprites; // used to preview 8x8 sprites

    window.sprites = this;
  }

  serialize() {
    return {
      data: Array.from(this.data),
    };
  }

  getCoords(e) {
    return getCoords(e, this.scale * 16);
  }

  hook(callback) {
    this.hooks.push(callback);
  }

  trigger() {
    this.hooks.forEach((callback) => callback());
  }

  copy() {
    // FIXME support partial copy/clip //{ x = 0, y = 0, w = width, h = width }
    this.clipboard = new Sprite(new Uint8Array(this.sprite.pixels));
  }

  paste() {
    if (this.clipboard.pixels) this.set(this.clipboard.pixels);
  }

  set(data) {
    // FIXME support partial paste
    this.snapshot();
    this.data.set(data, this._current * pixelLength);
    this.rebuild(this._current);
    this.paint();
  }

  snapshot() {
    this.history.splice(this._undoPtr + 1);
    this.history.push(new Uint8Array(this.data));
    this._undoPtr = this.history.length - 1;
  }

  async rotate() {
    this.snapshot();
    await this.sprite.rotate();
    this.trigger();
    this.paint();
  }

  async mirror(horizontal = true) {
    this.snapshot();
    await this.sprite.mirror(horizontal);
    this.trigger();
    this.paint();
  }

  undo() {
    const data = this.history[this._undoPtr];

    if (!data) {
      return;
    }
    this._undoPtr--;

    this.data = data;
    const subSprite = this.sprite.subSprite;
    const toggle = this.sprite.scale === 8;

    for (let i = 0; i < this.length; i++) {
      this.rebuild(i);
    }
    this.sprite.subSprite = subSprite;
    if (toggle) this.sprite.toggleScale();

    this.paint();
  }

  rebuild(i) {
    if (i < 0 || i > this.length) {
      return; // noop
    }
    const sprite = new Sprite(
      this.data.subarray(i * pixelLength, i * pixelLength + pixelLength)
    );
    this.sprites[i] = sprite;
    sprite.paint(this.previewCtx[i]);
    this.trigger();
  }

  getPreviewElements() {
    return this.previewCtx.map((_) => _.canvas);
  }

  canvasToPixels() {
    this.sprites[this._current].canvasToPixels();
  }

  pset(coords, value) {
    this.sprites[this._current].pset({ ...coords, value });
    this.trigger();
    return true;
  }

  pget(args) {
    return this.sprites[this._current].pget(args);
  }

  get current() {
    return this._current;
  }

  get sprite() {
    return this.sprites[this._current];
  }

  set current(value) {
    this._current = value;
    this.scale = 32 / this.sprites[this._current].scale;
    this.trigger();
    this.paint();
  }

  setSubSprite(index) {
    this.sprite.subSprite = index;
    this.sprite.render();
    this.paint();
  }

  get(index) {
    return this.sprites[index];
  }

  setScale(scale, paintSubSprites = true) {
    const sprite = this.sprite;
    sprite.setScale(scale);
    this.scale = 32 / sprite.scale;

    if (paintSubSprites && sprite.scale === 8) {
      for (let i = 0; i < 4; i++) {
        sprite.subSprite = i;
        sprite.render();
        sprite.paint(this.subSprites[i]);
      }
      sprite.subSprite = 0;
      sprite.render();
    }

    this.current = this._current;
    this.paint();
  }

  toggleScale(paintSubSprites = true) {
    this.setScale(this.sprite.scale === 8 ? 16 : 8, paintSubSprites);
  }

  clear() {
    this.snapshot();
    this.sprites[this._current].clear();
    this.trigger();
    this.paint();
  }

  renderPreview(i) {
    this.sprites[i].draw(this.previewCtx[i]);
  }

  paint(i = this._current) {
    const sprite = this.sprites[i];
    sprite.paint(this.ctx);

    let subSprites = sprite.scale === 8;
    if (subSprites) {
      sprite.toggleScale(false);
    }

    sprite.paint(this.previewCtx[this._current]);

    if (subSprites) {
      sprite.toggleScale(false);
      sprite.paint(this.subSprites[sprite.subSprite]);
    }

    this.getPreviewElements().map((_) => _.classList.remove('focus'));
    this.previewCtx[this._current].canvas.classList.add('focus');
  }
}
