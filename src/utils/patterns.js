export const drawPatternTile = (props) => {
  const name = (props.pattern || "").toLowerCase();
  const color = props.patternColor || "#888";

  const size = parseFloat(props.patternSize || 16);
  const spacing = parseFloat(props.patternSpacing || size * 2);
  const dim = Math.min(Math.max(spacing || 16, 8), 128);

  const canvas = document.createElement("canvas");
  canvas.width = dim;
  canvas.height = dim;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  switch (name) {
    case "dots":
      ctx.beginPath();
      ctx.arc(dim / 2, dim / 2, size / 3, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "stripes":
      ctx.fillRect(0, 0, size, dim);
      break;

    case "grid":
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dim / 2, 0);
      ctx.lineTo(dim / 2, dim);
      ctx.moveTo(0, dim / 2);
      ctx.lineTo(dim, dim / 2);
      ctx.stroke();
      break;

    case "hatch":
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, dim);
      ctx.lineTo(dim, 0);
      ctx.stroke();
      break;

    case "crosshatch":
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, dim);
      ctx.lineTo(dim, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(dim, dim);
      ctx.stroke();
      break;

    case "water":
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, dim / 2);
      ctx.quadraticCurveTo(dim / 4, dim / 4, dim / 2, dim / 2);
      ctx.quadraticCurveTo((3 * dim) / 4, (3 * dim) / 4, dim, dim / 2);
      ctx.stroke();
      break;

    case "sand":
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc(
          Math.random() * dim,
          Math.random() * dim,
          1,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      break;

    case "rocks":
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(
          Math.random() * dim,
          Math.random() * dim,
          size / 3,
          size / 3
        );
      }
      ctx.globalAlpha = 1;
      break;

    case "trees":
      ctx.font = `${size}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🌳", dim / 2, dim / 2);
      break;

    case "bush":
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(
          Math.random() * dim,
          Math.random() * dim,
          size / 4,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;

    case "restricted":
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(dim, dim);
      ctx.moveTo(dim, 0);
      ctx.lineTo(0, dim);
      ctx.stroke();
      break;

    case "parking":
      ctx.font = `bold ${size}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("P", dim / 2, dim / 2);
      break;

    default:
      ctx.fillRect(4, 4, 4, 4);
  }

  return canvas;
};

export const addPatternImage = (map, props) => {
  const key = `${props.pattern}_${props.patternColor || "#888"}`;
  const id = key.replace(/[^a-zA-Z0-9_\-]/g, "_");

  // ✅ prevent duplicate crash
  if (map.hasImage(id)) return id;

  const canvas = drawPatternTile(props);
  if (!canvas) return null;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  map.addImage(id, {
    width: canvas.width,
    height: canvas.height,
    data: imageData.data,
  });

  return id;
};