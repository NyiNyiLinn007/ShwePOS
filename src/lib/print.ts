/**
 * Dedicated thermal receipt & barcode label printer using a clean hidden iframe.
 * Avoids main-window CSS/modal/scroll/dark-mode conflicts in browser print preview.
 */
export function printElementById(
  elementId: string,
  options?: {
    title?: string;
    paperSize?: '80mm' | '58mm' | 'A4';
  }
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    window.print();
    return;
  }

  const paperSize = options?.paperSize || '80mm';
  const title = options?.title || document.title || 'ShwePOS Print';

  // Remove any previous print iframe
  const existingIframe = document.getElementById('shwepos-print-frame');
  if (existingIframe && existingIframe.parentNode) {
    existingIframe.parentNode.removeChild(existingIframe);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'shwepos-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    window.print();
    return;
  }

  const maxWidthCss =
    paperSize === '58mm'
      ? '54mm'
      : paperSize === '80mm'
      ? '76mm'
      : '100%';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    :root {
      --space-xs: 4px;
      --space-sm: 8px;
      --space-md: 12px;
      --space-lg: 16px;
      --space-xl: 20px;
      --text-xs: 11px;
      --text-sm: 12px;
      --text-base: 13px;
      --text-lg: 15px;
      --text-xl: 18px;
      --font-mono: 'JetBrains Mono', 'Courier New', Courier, monospace;
      --font-en: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --font-mm: 'Padauk', 'Noto Sans Myanmar', 'Myanmar Text', sans-serif;
      --text-primary: #000000;
      --text-secondary: #111111;
      --text-muted: #222222;
      --primary: #000000;
      --danger: #000000;
      --success: #000000;
      --border-default: #000000;
      --border-subtle: #333333;
      --border-color: #333333;
      --radius-sm: 4px;
      --radius-md: 6px;
    }

    @page {
      margin: 4mm;
    }

    * {
      box-sizing: border-box;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: var(--font-mono);
      font-size: ${paperSize === '58mm' ? '11px' : '12px'};
      line-height: 1.45;
      font-variant-numeric: tabular-nums;
    }

    .print-wrapper {
      width: 100%;
      max-width: ${maxWidthCss};
      margin: 0 auto;
      padding: 4px;
      background: #ffffff !important;
      color: #000000 !important;
    }

    .flex {
      display: flex;
    }

    .justify-between {
      justify-content: space-between;
      gap: 8px;
    }

    .items-center {
      align-items: center;
    }

    .mm-text {
      font-family: var(--font-mm), var(--font-mono);
      line-height: 1.65;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      border: 1px solid #000000;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
    }

    .barcode-print-grid {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)) !important;
      gap: 10px !important;
      width: 100% !important;
    }

    .barcode-sticker {
      border: 1px dashed #000000 !important;
      border-radius: 4px !important;
      padding: 8px !important;
      text-align: center !important;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    img {
      max-width: 100%;
    }
  </style>
</head>
<body>
  <div class="print-wrapper">
    ${sourceEl.innerHTML}
  </div>
</body>
</html>`;

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    }
  };

  // Wait for any images (e.g., business logo) inside the iframe to load before printing
  const images = Array.from(doc.images || []);
  if (images.length === 0) {
    setTimeout(triggerPrint, 120);
  } else {
    let loaded = 0;
    const onImgDone = () => {
      loaded += 1;
      if (loaded >= images.length) {
        setTimeout(triggerPrint, 80);
      }
    };
    images.forEach((img) => {
      if (img.complete) {
        onImgDone();
      } else {
        img.addEventListener('load', onImgDone, { once: true });
        img.addEventListener('error', onImgDone, { once: true });
      }
    });
  }
}
