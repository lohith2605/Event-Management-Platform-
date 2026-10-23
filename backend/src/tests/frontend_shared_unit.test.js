import test from 'node:test';
import assert from 'node:assert/strict';

// Pure logic mirror of safe link extraction
function extractSafeUrls(text) {
  if (!text || typeof text !== 'string') return [];
  const urlRegex = /https?:\/\/[^\s<>"]+/gi;
  const matches = text.match(urlRegex) || [];
  const safe = [];
  const seen = new Set();

  matches.forEach((rawUrl) => {
    try {
      const cleaned = rawUrl.replace(/[.,;:)]+$/, '');
      const parsed = new URL(cleaned);
      if (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        !seen.has(cleaned)
      ) {
        seen.add(cleaned);
        safe.push({
          url: cleaned,
          domain: parsed.hostname.replace(/^www\./, ''),
        });
      }
    } catch {
      // ignore
    }
  });

  return safe;
}

// Pure logic mirror of file size formatting
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Pure logic mirror of getDocumentIcon
function getDocumentDetails(originalName = '', mimeType = '') {
  const ext = originalName.split('.').pop().toLowerCase();
  const mime = mimeType.toLowerCase();

  if (ext === 'pdf' || mime === 'application/pdf') {
    return { label: 'PDF', isPdf: true };
  }
  if (
    ext === 'xlsx' ||
    ext === 'csv' ||
    mime.includes('csv') ||
    mime.includes('spreadsheet')
  ) {
    return { label: ext.toUpperCase() || 'XLS', isPdf: false };
  }
  if (ext === 'docx' || mime.includes('word')) {
    return { label: 'DOC', isPdf: false };
  }
  return { label: ext.toUpperCase() || 'FILE', isPdf: false };
}

test('Frontend Shared Content Unit Tests — Utilities & Helpers', async (t) => {
  await t.test('1. extractSafeUrls captures valid https and http URLs', () => {
    const text = 'Visit our site at https://utsav.com and http://blog.utsav.com/news.';
    const urls = extractSafeUrls(text);
    assert.strictEqual(urls.length, 2);
    assert.strictEqual(urls[0].url, 'https://utsav.com');
    assert.strictEqual(urls[0].domain, 'utsav.com');
    assert.strictEqual(urls[1].url, 'http://blog.utsav.com/news');
    assert.strictEqual(urls[1].domain, 'blog.utsav.com');
  });

  await t.test('2. extractSafeUrls rejects dangerous schemes like javascript: and data:', () => {
    const text = 'Dangerous: javascript:alert(1) and data:text/html,<script>alert(1)</script>';
    const urls = extractSafeUrls(text);
    assert.strictEqual(urls.length, 0);
  });

  await t.test('3. extractSafeUrls trims trailing punctuation from URLs', () => {
    const text = 'Check out (https://utsav.com/guide), or https://utsav.com/contact.';
    const urls = extractSafeUrls(text);
    assert.strictEqual(urls[0].url, 'https://utsav.com/guide');
    assert.strictEqual(urls[1].url, 'https://utsav.com/contact');
  });

  await t.test('4. formatFileSize correctly formats bytes, KB, and MB', () => {
    assert.strictEqual(formatFileSize(0), '0 B');
    assert.strictEqual(formatFileSize(500), '500 B');
    assert.strictEqual(formatFileSize(2048), '2 KB');
    assert.strictEqual(formatFileSize(1048576), '1 MB');
    assert.strictEqual(formatFileSize(5242880), '5 MB');
  });

  await t.test('5. getDocumentDetails correctly identifies PDF documents and spreadsheet extensions', () => {
    const pdfDetails = getDocumentDetails('contract.pdf', 'application/pdf');
    assert.strictEqual(pdfDetails.label, 'PDF');
    assert.strictEqual(pdfDetails.isPdf, true);

    const xlsDetails = getDocumentDetails('data.xlsx', 'application/vnd.ms-excel');
    assert.strictEqual(xlsDetails.label, 'XLSX');
    assert.strictEqual(xlsDetails.isPdf, false);

    const docDetails = getDocumentDetails('report.docx', 'application/msword');
    assert.strictEqual(docDetails.label, 'DOC');
    assert.strictEqual(docDetails.isPdf, false);
  });
});
