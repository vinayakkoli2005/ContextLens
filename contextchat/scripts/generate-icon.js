import { createCanvas } from 'canvas';
import fs from 'fs';

function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background circle
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = '#2E75B6';
  ctx.fill();

  // Chat bubble
  const bw = size * 0.5;  // bubble width
  const bh = size * 0.35; // bubble height
  const bx = (size - bw) / 2;
  const by = (size - bh) / 2 - size * 0.05;
  const br = size * 0.08; // border radius

  ctx.beginPath();
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + bw - br, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
  ctx.lineTo(bx + bw, by + bh - br);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
  ctx.lineTo(bx + bw * 0.35, by + bh);
  ctx.lineTo(bx + bw * 0.2, by + bh + size * 0.1);
  ctx.lineTo(bx + bw * 0.25, by + bh);
  ctx.lineTo(bx + br, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
  ctx.lineTo(bx, by + br);
  ctx.quadraticCurveTo(bx, by, bx + br, by);
  ctx.fillStyle = 'white';
  ctx.fill();

  // Three dots inside bubble
  const dotR = size * 0.035;
  const dotY = by + bh / 2;
  const dotSpacing = bw * 0.2;
  const dotStartX = size/2 - dotSpacing;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(dotStartX + i * dotSpacing, dotR, dotR, 0, Math.PI * 2);
    ctx.fillStyle = '#2E75B6';
    ctx.fill();
  }

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${outputPath} (${size}x${size})`);
}

// Generate all sizes
generateIcon(128, 'src/assets/icon-128.png');
generateIcon(48, 'src/assets/icon-48.png');
generateIcon(16, 'src/assets/icon-16.png');