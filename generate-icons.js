const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'icons', 'icon.svg');
const svgContent = fs.readFileSync(svgPath);

const sizes = [16, 32, 48, 128];

async function generateIcons() {
  for (const size of sizes) {
    await sharp(svgContent)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, 'icons', `icon${size}.png`));
    console.log(`✓ 生成 icon${size}.png`);
  }
  console.log('\n所有图标生成完成！');
}

generateIcons().catch(console.error);
