/**
 * Generate PWA icons at common sizes from a simple SVG source.
 * Run with: node scripts/generate-icons.js
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const COLORS = {
  bg: "#10b981",
  fg: "#ffffff",
};

const outDir = path.resolve("public/icons");
fs.mkdirSync(outDir, { recursive: true });

/** Compose an SVG for a given size */
function svg(size) {
  const cx = size / 2;
  const r = size * 0.38;
  const fs2 = size * 0.48;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="${COLORS.bg}"/>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="${COLORS.fg}" opacity="0.2"/>
  <text x="${cx}" y="${cx + fs2 * 0.35}" text-anchor="middle" font-size="${fs2}" font-family="system-ui, sans-serif" font-weight="700" fill="${COLORS.fg}">W</text>
</svg>`;
}

async function run() {
  const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
  for (const s of sizes) {
    const png = path.join(outDir, `icon-${s}x${s}.png`);
    await sharp(Buffer.from(svg(s))).png().toFile(png);
    console.log(`  ✓ ${png}`);
  }

  // favicon
  await sharp(Buffer.from(svg(64))).png().toFile(path.join("public", "favicon.png"));
  console.log("  ✓ public/favicon.png");

  // apple-touch-icon
  await sharp(Buffer.from(svg(180))).png().toFile(path.join("public", "apple-touch-icon.png"));
  console.log("  ✓ public/apple-touch-icon.png");

  console.log("\nAll icons generated successfully.");
}

run().catch((e) => { console.error(e); process.exit(1); });
