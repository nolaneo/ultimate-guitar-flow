(function() {
  'use strict';

  // Only run on chord pages, not tabs
  if (!window.location.href.includes('-chords-')) {
    return;
  }

  let isSimplifiedView = false;
  let ugfContainer = null;
  let ugfStyles = null;

  function extractSongData() {
    // Get song title
    const titleEl = document.querySelector('h1');
    const title = titleEl ? titleEl.textContent.replace('Chords', '').replace('Tab', '').trim() : 'Unknown';

    // Get artist name
    const artistLink = document.querySelector('a[href*="/artist/"]');
    const artist = artistLink ? artistLink.textContent.trim() : 'Unknown';

    // Get the pre element containing chords and lyrics
    const preEl = document.querySelector('pre.xNWlr');
    if (!preEl) return null;

    // Clone the pre element to preserve the original formatting
    const preClone = preEl.cloneNode(true);

    // Process the content to split into sections for column layout
    const content = preClone.innerHTML;

    // Split by section headers [Verse], [Chorus], {Verse}, {Chorus}, etc.
    // Only match headers with simple text (letters, numbers, spaces) - not HTML
    const sectionRegex = /[\[{]([A-Za-z0-9 ]+)[\]}]/g;
    const sections = [];

    // Check if there are any section headers
    const firstMatch = content.match(sectionRegex);

    if (!firstMatch) {
      // No section headers - split on double line breaks (blank lines)
      const chunks = content.split(/\n\s*\n/);
      for (const chunk of chunks) {
        const trimmed = chunk.trim();
        if (trimmed) {
          sections.push({ title: '', content: trimmed });
        }
      }
      // If still just one big chunk, use it as-is
      if (sections.length === 0) {
        sections.push({ title: '', content: content.trim() });
      }
    } else {
      // Find content before first section (intro/chord definitions)
      const firstSectionIndex = content.indexOf(firstMatch[0]);
      if (firstSectionIndex > 0) {
        const introContent = content.substring(0, firstSectionIndex).trim();
        if (introContent) {
          sections.push({ title: '', content: introContent });
        }
      }

      // Split remaining content by sections
      const parts = content.split(sectionRegex);

      // parts[0] is content before first section (already handled)
      // parts[1] is first section title, parts[2] is first section content, etc.
      for (let i = 1; i < parts.length; i += 2) {
        const sectionTitle = parts[i];
        const sectionContent = parts[i + 1] ? parts[i + 1].trim() : '';
        sections.push({ title: sectionTitle, content: sectionContent });
      }
    }

    return { title, artist, sections };
  }

  function toggleView() {
    if (isSimplifiedView) {
      // Show original
      document.body.style.display = '';
      ugfContainer.style.display = 'none';
    } else {
      // Show simplified
      document.body.style.display = 'none';
      ugfContainer.style.display = '';
    }
    isSimplifiedView = !isSimplifiedView;
  }

  function buildCleanView(songData) {
    const container = document.createElement('div');
    container.className = 'ugf-container';
    container.id = 'ugf-root';

    // Header
    const header = document.createElement('header');
    header.className = 'ugf-header';
    header.innerHTML = `
      <h1 class="ugf-title">${songData.title}</h1>
      <p class="ugf-artist">${songData.artist}</p>
    `;
    container.appendChild(header);

    // Toggle button - switches between views
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ugf-toggle-btn';
    toggleBtn.textContent = 'Original';
    toggleBtn.addEventListener('click', toggleView);
    container.appendChild(toggleBtn);

    // Sections in columns
    const columnsWrapper = document.createElement('div');
    columnsWrapper.className = 'ugf-columns';

    for (const section of songData.sections) {
      const sectionEl = document.createElement('section');
      sectionEl.className = 'ugf-section';

      if (section.title) {
        const sectionTitle = document.createElement('h2');
        sectionTitle.className = 'ugf-section-title';
        sectionTitle.textContent = section.title;
        sectionEl.appendChild(sectionTitle);
      }

      const content = document.createElement('pre');
      content.className = 'ugf-section-content';
      // Preserve the HTML with chord spans intact
      content.innerHTML = section.content;

      sectionEl.appendChild(content);
      columnsWrapper.appendChild(sectionEl);
    }

    container.appendChild(columnsWrapper);
    return container;
  }

  function injectStyles() {
    const styles = document.createElement('style');
    styles.id = 'ugf-styles';
    styles.textContent = `
      #ugf-root {
        --ug-color-text-primary: #4fc3f7;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        margin: 0;
        padding: 1.5rem;
        box-sizing: border-box;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Droid Sans Mono', monospace;
        background: #1a1a1a;
        color: #e0e0e0;
        line-height: 1.5;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      #ugf-root * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      #ugf-root .ugf-header {
        text-align: center;
        padding-bottom: 1rem;
        border-bottom: 1px solid #333;
        flex-shrink: 0;
      }

      #ugf-root .ugf-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: #fff;
        margin-bottom: 0.25rem;
      }

      #ugf-root .ugf-artist {
        font-size: 1rem;
        color: #888;
      }

      #ugf-root .ugf-columns {
        flex: 1;
        padding-top: 1rem;
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
        align-content: flex-start;
        gap: 1rem 2rem;
        overflow-x: auto;
        height: 100%;
      }

      #ugf-root .ugf-section {
        max-height: 100%;
        margin-bottom: 1.5rem;
      }

      #ugf-root .ugf-section-title {
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #888;
        margin-bottom: 0.5rem;
      }

      #ugf-root .ugf-section-content {
        font-family: inherit;
        font-size: 0.9rem;
        white-space: pre;
        line-height: 1.4;
      }

      #ugf-root .ugf-section-content span[data-name] {
        color: var(--ug-color-text-primary);
        font-weight: 600;
      }

      #ugf-root .ugf-toggle-btn {
        position: fixed;
        top: 1rem;
        right: 1rem;
        background: #333;
        color: #888;
        border: 1px solid #444;
        padding: 0.4rem 0.8rem;
        font-family: inherit;
        font-size: 0.8rem;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        z-index: 100000;
      }

      #ugf-root .ugf-toggle-btn:hover {
        background: #444;
        color: #fff;
        border-color: #555;
      }

      #ugf-loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #1a1a1a;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        transition: opacity 0.4s ease-out;
      }

      #ugf-loading-overlay.fade-out {
        opacity: 0;
      }

      .ugf-loader {
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
        font-size: 1.2rem;
        color: #4fc3f7;
        animation: ugf-pulse 1.5s ease-in-out infinite;
      }

      @keyframes ugf-pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(styles);
    return styles;
  }

  function showSimplifiedView(cleanView) {
    // Inject our styles
    ugfStyles = injectStyles();

    // Add our container as sibling to body content
    ugfContainer = cleanView;
    document.documentElement.appendChild(ugfContainer);

    // Hide the original body
    document.body.style.display = 'none';
    isSimplifiedView = true;
  }

  // Run the extension
  function init() {
    const songData = extractSongData();
    if (songData) {
      const cleanView = buildCleanView(songData);
      showSimplifiedView(cleanView);
    }
  }

  // Create loading overlay
  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'ugf-loading-overlay';
    overlay.innerHTML = `<div class="ugf-loader">Simplifying layout</div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  // Remove overlay with fade
  function removeOverlay(overlay) {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 400);
  }

  // Zoom out to force UG to render all chord styling, then run
  function zoomAndInit() {
    // Inject styles early for overlay
    ugfStyles = injectStyles();

    // Create overlay first, before zooming
    const overlay = createOverlay();

    // Apply zoom to a wrapper around body content, not the overlay
    const wrapper = document.createElement('div');
    wrapper.id = 'ugf-zoom-wrapper';

    // Move all body children (except our overlay) into the wrapper
    while (document.body.firstChild && document.body.firstChild !== overlay) {
      wrapper.appendChild(document.body.firstChild);
    }
    document.body.insertBefore(wrapper, overlay);

    // Zoom the wrapper, not the body
    wrapper.style.zoom = '0.1';
    wrapper.style.transformOrigin = 'top left';

    // Wait for UG's lazy rendering to process visible chords
    setTimeout(() => {
      // Unwrap before init so selectors work
      while (wrapper.firstChild) {
        document.body.insertBefore(wrapper.firstChild, wrapper);
      }
      wrapper.remove();

      init();
      // Fade out the overlay
      removeOverlay(overlay);
    }, 500);
  }

  // Wait for the page to fully load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Give UG a moment to render their React content, then zoom
      setTimeout(zoomAndInit, 1000);
    });
  } else {
    // Give UG a moment to render their React content, then zoom
    setTimeout(zoomAndInit, 1000);
  }
})();
