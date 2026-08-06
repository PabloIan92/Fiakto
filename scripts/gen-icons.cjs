const fs = require('fs');
const sharp = require('sharp');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generate() {
  // Ensure icons directory exists
  if (!fs.existsSync('public/icons')) {
    fs.mkdirSync('public/icons', { recursive: true });
  }

  for (const size of sizes) {
    try {
      await sharp('app/favicon.ico')
        .resize(size, size, { fit: 'contain', background: { r: 243, g: 239, b: 230 } })
        .png()
        .toFile(`public/icons/icon-${size}x${size}.png`);
      console.log('Generated:', size);
    } catch (e) {
      console.error('Error', size, e.message);
    }
  }
}
generate();