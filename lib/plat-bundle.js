const sharp = require('sharp');
const { PDFDocument, StandardFonts, pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject } = require('pdf-lib');
const { buffer } = require('./http');

const allowed = url => /^https:\/\/(www\.)?webercountyutah\.gov\/mounts\/ded_plats\/Book_\d+\/[\w.-]+\.tif$/i.test(url);

// A set of whole original sheets, not a stitched survey or a crop of a selected lot.
async function bundlePlats(plats, load = url => buffer(url, { maxBytes: 40e6, timeout: 45000 })) {
  if (!plats.length) throw new Error('No recorded plat sheets found for this parcel.');
  if (plats.length > 12) throw new Error('This record has more than 12 sheets. Use the original sheet links; no partial bundle was produced.');
  if (!plats.every(p => allowed(p.url))) throw new Error('Unsupported recorded plat URL.');
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.setTitle('Recorded plat sheets - Cornerpin');
  pdf.setSubject('All plat sheets linked by the county parcel record. Not a complete title or easement search.');
  for (let i = 0; i < plats.length; i++) {
    const p = plats[i], bytes = await load(p.url), meta = await sharp(bytes, { limitInputPixels: 150e6 }).metadata();
    if (meta.pages > 1) throw new Error('Multi-page TIFF encountered; use the original file. No incomplete bundle was produced.');
    // Retain native pixels, with no resizing or crop. A small footer sits outside the source image.
    const width = meta.width * 72 / 300, height = meta.height * 72 / 300;
    const page = pdf.addPage([width, height + 32]);
    // County bilevel TIFFs compress dramatically better as 1-bit PDF images than RGB PNGs.
    // Pack exact black/white pixels; never threshold a grayscale scan or resize the drawing.
    const raw = meta.space === 'b-w' ? await sharp(bytes, { limitInputPixels: 150e6 }).greyscale().raw().toBuffer() : null;
    if (raw && raw.every(v => v === 0 || v === 255)) {
      const stride = Math.ceil(meta.width / 8), bits = Buffer.alloc(stride * meta.height);
      for (let y = 0; y < meta.height; y++) for (let x = 0; x < meta.width; x++) {
        if (raw[y * meta.width + x]) bits[y * stride + (x >> 3)] |= 128 >> (x & 7);
      }
      const stream = pdf.context.flateStream(bits, { Type: 'XObject', Subtype: 'Image', Width: meta.width, Height: meta.height, ColorSpace: 'DeviceGray', BitsPerComponent: 1 });
      const key = page.node.newXObject('RecordedSheet', pdf.context.register(stream));
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(width, 0, 0, height, 0, 32), drawObject(key), popGraphicsState());
    } else {
      const png = await sharp(bytes, { limitInputPixels: 150e6 }).png().toBuffer(), img = await pdf.embedPng(png);
      page.drawImage(img, { x: 0, y: 32, width, height });
    }
    page.drawText(`Cornerpin | Recorded sheet ${p.sheet} | ${i + 1} of ${plats.length} linked sheets | Whole original image; no stitching`, { x: 14, y: 20, size: 8, font });
    page.drawText(p.url, { x: 14, y: 8, size: 7, font });
  }
  return Buffer.from(await pdf.save());
}
module.exports = { bundlePlats, allowed };
