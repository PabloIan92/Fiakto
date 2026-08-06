import fs from 'fs';
import sharp from 'sharp';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generate() {
  if (!fs.existsSync('public/icons')) {
    fs.mkdirSync('public/icons', { recursive: true });
  }

  for (const size of sizes) {
    try {
      await sharp('public/icons/icon-base.svg')
        .resize(size, size)
        .png()
        .toFile(`public/icons/icon-${size}x${size}.png`);
      console.log('Generated:', size);
    } catch (e) {
      console.error('Error', size, e.message);
    }
  }
}
generate();