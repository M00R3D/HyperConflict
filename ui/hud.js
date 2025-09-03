// ui/hud.js
// Exporta drawHealthBars y drawInputQueues que reciben explicitamente player1/player2

function drawInputQueues(p1, p2) {
  const centerX = width / 2;
  const y = 40;
  const spacing = 22;
  textSize(14);
  textAlign(CENTER, CENTER);

  const drawBuffer = (buf, x, bufferDuration = 1400) => {
    for (let i = 0; i < buf.length; i++) {
      const entry = buf[i];
      const age = millis() - entry.time;
      const alpha = map(age, 0, bufferDuration, 255, 0);
      fill(255, alpha);
      noStroke();
      text(entry.symbol, x + i * spacing - (buf.length - 1) * spacing / 2, y);
    }
  };

  drawBuffer(p1.inputBuffer || [], centerX - 140, p1.inputBufferDuration);
  drawBuffer(p2.inputBuffer || [], centerX + 140, p2.inputBufferDuration);
}

function drawHealthBars(p1, p2) {
  const barWidth = 200;
  const barHeight = 20;
  const xOffset = 20;
  const yOffset = 10;

  function drawWavyBorder(x, y, w, h) {
    noFill();
    stroke(0);
    strokeWeight(6);
    beginShape();
    for (let i = 0; i <= w; i += 5) {
      let offset = sin((i + frameCount * 5) * 0.2) * 2;
      vertex(x + i, y + offset);
    }
    for (let i = 0; i <= h; i += 5) {
      let offset = cos((i + frameCount * 5) * 0.2) * 2;
      vertex(x + w + offset, y + i);
    }
    for (let i = w; i >= 0; i -= 5) {
      let offset = sin((i + frameCount * 5) * 0.2) * 2;
      vertex(x + i, y + h + offset);
    }
    for (let i = h; i >= 0; i -= 5) {
      let offset = cos((i + frameCount * 5) * 0.2) * 2;
      vertex(x + offset, y + i);
    }
    endShape(CLOSE);
  }

  // Player 1
  push();
  translate(xOffset, yOffset);
  noStroke();
  for (let i = 0; i < barHeight; i++) {
    let fade = map(i, 0, barHeight, 0, 255);
    let r = 200 + 55 * sin(frameCount * 0.1 + i * 0.3);
    let g = 30 + 150 * sin(frameCount * 0.2 + i * 0.5);
    let b = 0 + 100 * cos(frameCount * 0.15 + i * 0.4);
    fill(r, g, b, fade);
    rect(0, i, barWidth, 1);
  }
  const p1HealthWidth = map((p1?.hp ?? 0), 0, 10, 0, barWidth);
  for (let i = 0; i < barHeight; i++) {
    let wave = sin(frameCount * 0.3 + i) * 2;
    rect(0, i + wave, p1HealthWidth, 1);
  }
  drawWavyBorder(0, 0, barWidth, barHeight);
  pop();

  // Player 2
  push();
  translate(width - xOffset - barWidth, yOffset);
  noStroke();
  for (let i = 0; i < barHeight; i++) {
    let fade = map(i, 0, barHeight, 0, 255);
    let r = 180 + 75 * cos(frameCount * 0.1 + i * 0.2);
    let g = 0 + 180 * sin(frameCount * 0.15 + i * 0.4);
    let b = 20 + 100 * cos(frameCount * 0.2 + i * 0.3);
    fill(r, g, b, fade);
    rect(0, i, barWidth, 1);
  }
  const p2HealthWidth = map((p2?.hp ?? 0), 0, 10, 0, barWidth);
  for (let i = 0; i < barHeight; i++) {
    let wave = cos(frameCount * 0.25 + i) * 2;
    rect(barWidth - p2HealthWidth, i + wave, p2HealthWidth, 1);
  }
  drawWavyBorder(0, 0, barWidth, barHeight);
  pop();
}

export { drawInputQueues, drawHealthBars };
