// ui/background.js
function drawBackground() {
  const skyColors = [
    color(135, 206, 235),
    color(255, 140, 0),
    color(0, 0, 0),
    color(25, 25, 112)
  ];
  const speed = 0.00002;
  const t = (frameCount * speed) % 1;
  const total = skyColors.length;
  const index1 = floor(frameCount * speed) % total;
  const index2 = (index1 + 1) % total;
  const c = lerpColor(skyColors[index1], skyColors[index2], t);
  background(c);
}

export { drawBackground };
