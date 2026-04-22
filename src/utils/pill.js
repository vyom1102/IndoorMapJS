const pillCache = new Map();

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

export const createPillImage = (map, text) => {
  if (pillCache.has(text)) return pillCache.get(text);

  const fontSize = 22;
  const hPad = 30;
  const vPad = 18;

  const temp = document.createElement("canvas");
  const tctx = temp.getContext("2d");
  tctx.font = `bold ${fontSize}px sans-serif`;
  const textWidth = tctx.measureText(text).width;

  const width = Math.ceil(textWidth + hPad);
  const height = Math.ceil(fontSize + vPad);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // shadow
  ctx.shadowColor = "rgba(0,0,0,0.15)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  // bg
  ctx.fillStyle = "#fff";
  roundRect(ctx, 0, 0, width, height, height / 4);
  ctx.fill();

  // border
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#E53935";
  ctx.lineWidth = 2;
  ctx.stroke();

  // text
  ctx.fillStyle = "#000";
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);

  const imageData = ctx.getImageData(0, 0, width, height);
  const id = `pill_${text.replace(/\s/g, "_")}`;

  if (!map.hasImage(id)) {
    map.addImage(id, {
      width,
      height,
      data: imageData.data,
    });
  }

  pillCache.set(text, id);
  return id;
};