/**
 * LifeCare Diagnostic Centre - PDF Letterhead Generator
 * Powered by pdf-lib (100% Client-Side Processing in Browser)
 * Ultra-Responsive Mobile/Desktop, Instant Auto-Generate, Single Download Button
 */

(function () {
  'use strict';

  // State Management
  const state = {
    uploadedPdfBytes: null,
    uploadedPdfName: '',
    uploadedPdfPageCount: 0,

    originalBlobUrl: null,
    generatedBlobUrl: null,
    generatedPdfBytes: null,

    headerDataUrl: null,
    headerBytes: null,
    headerFormat: 'jpeg',
    headerWidth: 2880,
    headerHeight: 544,

    footerDataUrl: null,
    footerBytes: null,
    footerFormat: 'jpeg',
    footerWidth: 2880,
    footerHeight: 207,

    activeTab: 'generated',
    isGenerating: false
  };

  // DOM Elements
  const DOM = {
    // Dropzone & File
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('pdfFileInput'),
    fileCard: document.getElementById('fileCard'),
    fileNameDisplay: document.getElementById('fileNameDisplay'),
    fileSizeDisplay: document.getElementById('fileSizeDisplay'),
    filePagesDisplay: document.getElementById('filePagesDisplay'),
    btnRemoveFile: document.getElementById('btnRemoveFile'),
    btnLoadSample: document.getElementById('btnLoadSample'),
    btnEmptySample: document.getElementById('btnEmptySample'),

    // Single Primary Action: Download PDF
    btnDownloadPdf: document.getElementById('btnDownloadPdf'),
    btnFullscreen: document.getElementById('btnFullscreen'),

    // Preview
    previewContainer: document.getElementById('previewContainer'),
    previewEmptyState: document.getElementById('previewEmptyState'),
    previewLoading: document.getElementById('previewLoading'),
    loadingText: document.getElementById('loadingText'),
    previewIframe: document.getElementById('pdfPreviewIframe'),
    previewStatusBadge: document.getElementById('previewStatusBadge'),
    tabGenerated: document.getElementById('tabGenerated'),
    tabOriginal: document.getElementById('tabOriginal'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
  };

  /**
   * Helper: Convert Base64 / DataURL to Uint8Array
   */
  function dataUrlToUint8Array(dataUrl) {
    const base64Index = dataUrl.indexOf('base64,');
    const base64 = base64Index !== -1 ? dataUrl.substring(base64Index + 7) : dataUrl;
    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Helper: Format bytes to human readable string
   */
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Show Toast Notification
   */
  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '';
    if (type === 'success') {
      icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    } else {
      icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `${icon}<span>${message}</span>`;
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Initialize Default Header & Footer Assets
   */
  async function initDefaultAssets() {
    try {
      if (window.LIFECARE_DEFAULTS) {
        state.headerDataUrl = window.LIFECARE_DEFAULTS.headerDataUrl;
        state.headerBytes = dataUrlToUint8Array(state.headerDataUrl);
        state.headerFormat = 'jpeg';
        state.headerWidth = window.LIFECARE_DEFAULTS.headerWidth;
        state.headerHeight = window.LIFECARE_DEFAULTS.headerHeight;

        state.footerDataUrl = window.LIFECARE_DEFAULTS.footerDataUrl;
        state.footerBytes = dataUrlToUint8Array(state.footerDataUrl);
        state.footerFormat = 'jpeg';
        state.footerWidth = window.LIFECARE_DEFAULTS.footerWidth;
        state.footerHeight = window.LIFECARE_DEFAULTS.footerHeight;
      } else {
        const [headerRes, footerRes] = await Promise.all([
          fetch('header.jpeg'),
          fetch('footer.jpeg')
        ]);
        const headerBuf = await headerRes.arrayBuffer();
        const footerBuf = await footerRes.arrayBuffer();
        state.headerBytes = new Uint8Array(headerBuf);
        state.footerBytes = new Uint8Array(footerBuf);
      }
    } catch (err) {
      console.warn('Asset initialization warning:', err);
    }
  }

  /**
   * Handle PDF File Selection / Drop (Auto-generates immediately!)
   */
  async function handleFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast('Please select a valid PDF document (.pdf)', 'error');
      return;
    }

    try {
      showLoading(true, 'Reading and branding PDF with letterhead...');
      const arrayBuffer = await file.arrayBuffer();
      state.uploadedPdfBytes = new Uint8Array(arrayBuffer);
      state.uploadedPdfName = file.name;

      // Validate & inspect with pdf-lib
      const pdfDoc = await PDFLib.PDFDocument.load(state.uploadedPdfBytes, { ignoreEncryption: true });
      state.uploadedPdfPageCount = pdfDoc.getPageCount();

      // Create Original Blob URL
      if (state.originalBlobUrl) {
        URL.revokeObjectURL(state.originalBlobUrl);
      }
      const origBlob = new Blob([state.uploadedPdfBytes], { type: 'application/pdf' });
      state.originalBlobUrl = URL.createObjectURL(origBlob);

      // Update UI
      DOM.fileNameDisplay.textContent = file.name;
      DOM.fileSizeDisplay.textContent = formatBytes(file.size);
      DOM.filePagesDisplay.textContent = `${state.uploadedPdfPageCount} Page${state.uploadedPdfPageCount > 1 ? 's' : ''}`;
      DOM.fileCard.classList.remove('hidden');
      DOM.dropzone.classList.add('hidden');
      DOM.tabOriginal.disabled = false;

      // Auto-generate branded PDF immediately!
      await generateBrandedPdf();

    } catch (err) {
      showLoading(false);
      console.error('PDF Load Error:', err);
      showToast('Error reading PDF. File may be encrypted or corrupted.', 'error');
    }
  }

  /**
   * Load Sample Lab Report (Auto-generates immediately!)
   */
  async function loadSampleReport() {
    try {
      showLoading(true, 'Loading and branding sample laboratory report...');
      let sampleBytes;

      if (window.LIFECARE_DEFAULTS && window.LIFECARE_DEFAULTS.samplePdfDataUrl) {
        sampleBytes = dataUrlToUint8Array(window.LIFECARE_DEFAULTS.samplePdfDataUrl);
      } else {
        const res = await fetch('sample-lab-report.pdf');
        const buf = await res.arrayBuffer();
        sampleBytes = new Uint8Array(buf);
      }

      state.uploadedPdfBytes = sampleBytes;
      state.uploadedPdfName = 'sample-lab-report.pdf';

      const pdfDoc = await PDFLib.PDFDocument.load(state.uploadedPdfBytes);
      state.uploadedPdfPageCount = pdfDoc.getPageCount();

      if (state.originalBlobUrl) {
        URL.revokeObjectURL(state.originalBlobUrl);
      }
      const origBlob = new Blob([state.uploadedPdfBytes], { type: 'application/pdf' });
      state.originalBlobUrl = URL.createObjectURL(origBlob);

      DOM.fileNameDisplay.textContent = 'sample-lab-report.pdf';
      DOM.fileSizeDisplay.textContent = formatBytes(sampleBytes.byteLength);
      DOM.filePagesDisplay.textContent = `${state.uploadedPdfPageCount} Pages (A4)`;
      DOM.fileCard.classList.remove('hidden');
      DOM.dropzone.classList.add('hidden');
      DOM.tabOriginal.disabled = false;

      // Auto-generate branded PDF immediately!
      await generateBrandedPdf();

    } catch (err) {
      showLoading(false);
      console.error('Failed to load sample report:', err);
      showToast('Could not load sample PDF', 'error');
    }
  }

  /**
   * Core PDF Generation Engine using pdf-lib
   * 100% END-TO-END Edge-to-Edge Line Across the Full Page
   */
  async function generateBrandedPdf() {
    if (!state.uploadedPdfBytes) return;

    if (state.isGenerating) return;
    state.isGenerating = true;

    try {
      showLoading(true, 'Applying LifeCare letterhead to every page...');
      const startTime = performance.now();

      // Load original PDF document (preserves vector text, fonts, forms, and pages)
      const pdfDoc = await PDFLib.PDFDocument.load(state.uploadedPdfBytes, { ignoreEncryption: true });

      // Embed Header Image (4x UHD 2880px)
      let headerImage;
      if (state.headerFormat === 'png') {
        headerImage = await pdfDoc.embedPng(state.headerBytes);
      } else {
        headerImage = await pdfDoc.embedJpg(state.headerBytes);
      }

      // Embed Footer Image (4x UHD 2880px)
      let footerImage;
      if (state.footerFormat === 'png') {
        footerImage = await pdfDoc.embedPng(state.footerBytes);
      } else {
        footerImage = await pdfDoc.embedJpg(state.footerBytes);
      }

      const pages = pdfDoc.getPages();
      const totalPages = pages.length;

      // Header & Footer aspect ratios: width / height
      const headerAspect = headerImage.width / headerImage.height;
      const footerAspect = footerImage.width / footerImage.height;

      // Iterate through every page and draw 100% END-TO-END header & footer
      for (let i = 0; i < totalPages; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();

        // 1. Draw Header: 100% END-TO-END across entire page width (starts at x=0, ends at x=width)
        const headerWidth = width;
        const headerHeight = headerWidth / headerAspect;
        const headerY = height - headerHeight;

        page.drawImage(headerImage, {
          x: 0,
          y: headerY,
          width: headerWidth,
          height: headerHeight
        });

        // 2. Draw Footer: 100% END-TO-END across entire page width (starts at x=0, ends at x=width)
        const footerWidth = width;
        const footerHeight = footerWidth / footerAspect;
        const footerY = 0;

        page.drawImage(footerImage, {
          x: 0,
          y: footerY,
          width: footerWidth,
          height: footerHeight
        });
      }

      // Save modified PDF as Uint8Array
      const outBytes = await pdfDoc.save();
      state.generatedPdfBytes = outBytes;

      const elapsed = Math.round(performance.now() - startTime);

      // Create Blob URL for live preview
      if (state.generatedBlobUrl) {
        URL.revokeObjectURL(state.generatedBlobUrl);
      }
      const outBlob = new Blob([outBytes], { type: 'application/pdf' });
      state.generatedBlobUrl = URL.createObjectURL(outBlob);

      // Display generated PDF in preview
      displayPreview('generated');

      // Enable Download button immediately!
      DOM.btnDownloadPdf.disabled = false;
      DOM.btnFullscreen.disabled = false;

      DOM.previewStatusBadge.textContent = `Ready in ${elapsed}ms (${totalPages} Pages)`;
      showLoading(false);
      showToast(`Branded PDF ready! Click Download PDF`, 'success');

    } catch (err) {
      showLoading(false);
      console.error('Error generating PDF:', err);
      showToast('Error branding PDF: ' + err.message, 'error');
    } finally {
      state.isGenerating = false;
    }
  }

  /**
   * Display PDF in Preview Iframe
   */
  function displayPreview(targetTab) {
    state.activeTab = targetTab;

    if (targetTab === 'generated' && state.generatedBlobUrl) {
      DOM.tabGenerated.classList.add('active');
      DOM.tabOriginal.classList.remove('active');
      DOM.previewIframe.src = state.generatedBlobUrl + '#toolbar=1&navpanes=0&view=FitH';
      DOM.previewIframe.classList.remove('hidden');
      DOM.previewEmptyState.classList.add('hidden');
    } else if (targetTab === 'original' && state.originalBlobUrl) {
      DOM.tabOriginal.classList.add('active');
      DOM.tabGenerated.classList.remove('active');
      DOM.previewIframe.src = state.originalBlobUrl + '#toolbar=1&navpanes=0&view=FitH';
      DOM.previewIframe.classList.remove('hidden');
      DOM.previewEmptyState.classList.add('hidden');
    }
  }

  /**
   * Download the Generated PDF
   */
  function downloadGeneratedPdf() {
    if (!state.generatedBlobUrl) {
      showToast('Please upload a PDF first', 'error');
      return;
    }

    const originalName = state.uploadedPdfName || 'document.pdf';
    const baseName = originalName.replace(/\.pdf$/i, '');
    const downloadName = `${baseName}_LifeCare_Branded.pdf`;

    const a = document.createElement('a');
    a.href = state.generatedBlobUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast(`Downloading ${downloadName}`, 'success');
  }

  /**
   * Reset / Remove File
   */
  function resetAll() {
    if (state.originalBlobUrl) URL.revokeObjectURL(state.originalBlobUrl);
    if (state.generatedBlobUrl) URL.revokeObjectURL(state.generatedBlobUrl);

    state.uploadedPdfBytes = null;
    state.uploadedPdfName = '';
    state.uploadedPdfPageCount = 0;
    state.originalBlobUrl = null;
    state.generatedBlobUrl = null;
    state.generatedPdfBytes = null;
    state.activeTab = 'generated';

    DOM.fileInput.value = '';
    DOM.fileCard.classList.add('hidden');
    DOM.dropzone.classList.remove('hidden');

    DOM.btnDownloadPdf.disabled = true;
    DOM.btnFullscreen.disabled = true;
    DOM.tabOriginal.disabled = true;

    DOM.previewIframe.src = '';
    DOM.previewIframe.classList.add('hidden');
    DOM.previewEmptyState.classList.remove('hidden');
    DOM.previewStatusBadge.textContent = 'No PDF Loaded';

    showToast('Ready for new PDF', 'info');
  }

  /**
   * Fullscreen Action
   */
  function openFullscreen() {
    const url = state.activeTab === 'original' ? state.originalBlobUrl : state.generatedBlobUrl;
    if (url) {
      window.open(url, '_blank');
    }
  }

  /**
   * Loading Spinner Overlay
   */
  function showLoading(show, message = 'Processing...') {
    if (show) {
      DOM.loadingText.textContent = message;
      DOM.previewLoading.classList.remove('hidden');
    } else {
      DOM.previewLoading.classList.add('hidden');
    }
  }

  /**
   * Attach All Event Listeners
   */
  function setupEventListeners() {
    // Dropzone Events
    DOM.dropzone.addEventListener('click', () => DOM.fileInput.click());
    DOM.dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        DOM.fileInput.click();
      }
    });

    DOM.fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    });

    ['dragenter', 'dragover'].forEach(name => {
      DOM.dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        DOM.dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      DOM.dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        DOM.dropzone.classList.remove('dragover');
      });
    });

    DOM.dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    });

    // Sample Lab Report Buttons
    DOM.btnLoadSample.addEventListener('click', (e) => {
      e.stopPropagation();
      loadSampleReport();
    });

    DOM.btnEmptySample.addEventListener('click', () => {
      loadSampleReport();
    });

    // Remove File / Change
    DOM.btnRemoveFile.addEventListener('click', resetAll);

    // Single Download Action
    DOM.btnDownloadPdf.addEventListener('click', downloadGeneratedPdf);
    DOM.btnFullscreen.addEventListener('click', openFullscreen);

    // Preview Tabs
    DOM.tabGenerated.addEventListener('click', () => displayPreview('generated'));
    DOM.tabOriginal.addEventListener('click', () => displayPreview('original'));
  }

  // Self Initialization
  document.addEventListener('DOMContentLoaded', async () => {
    await initDefaultAssets();
    setupEventListeners();
  });

})();
