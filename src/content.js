import { SVGuitarChord } from 'svguitar';
import guitarChords from '@tombatossals/chords-db/lib/guitar.json';

(function() {
  'use strict';

  // Only run on chord pages, not tabs
  if (!window.location.href.includes('-chords-')) {
    return;
  }

  let isSimplifiedView = false;
  let ugfContainer = null;
  let ugfStyles = null;
  let activeChordPopup = null;

  // Custom chord definitions parsed from the page (e.g., "C/B: x2x010")
  const customChords = {};

  // Build a lookup map for chords: key -> suffix -> positions
  const chordMap = {};
  for (const [key, chords] of Object.entries(guitarChords.chords)) {
    for (const chord of chords) {
      const normalizedKey = normalizeChordKey(chord.key);
      if (!chordMap[normalizedKey]) {
        chordMap[normalizedKey] = {};
      }
      chordMap[normalizedKey][chord.suffix] = chord.positions;
    }
  }

  // Normalize chord key names (handle sharps/flats)
  function normalizeChordKey(key) {
    const keyMap = {
      'C': 'C', 'C#': 'C#', 'Db': 'C#',
      'D': 'D', 'D#': 'Eb', 'Eb': 'Eb',
      'E': 'E',
      'F': 'F', 'F#': 'F#', 'Gb': 'F#',
      'G': 'G', 'G#': 'Ab', 'Ab': 'Ab',
      'A': 'A', 'A#': 'Bb', 'Bb': 'Bb',
      'B': 'B'
    };
    return keyMap[key] || key;
  }

  // Parse custom chord definitions from page text (e.g., "C/B: x2x010" or "Eadd#11 = 022100")
  function parseCustomChordDefinitions(text) {
    // Match patterns like "ChordName: 6chars" or "ChordName = 6chars" or "ChordName - 6chars"
    // where 6chars is digits and x's representing fret positions
    // Chord names can include: root (A-G), accidentals (#/b), modifiers (letters/numbers), slash bass (/X)
    const regex = /([A-G][#b]?[a-zA-Z0-9#]*(?:\/[A-G][#b]?)?)\s*[:=\-–—]\s*([0-9xX]{6})\b/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const chordName = match[1].trim();
      const fretString = match[2].toLowerCase();

      // Convert fret string to array of fret numbers (-1 for x)
      const frets = [];
      for (const char of fretString) {
        if (char === 'x') {
          frets.push(-1);
        } else {
          frets.push(parseInt(char, 10));
        }
      }

      // Store as a custom chord position
      customChords[chordName] = {
        positions: [{
          frets: frets,
          fingers: [0, 0, 0, 0, 0, 0], // No finger info available
          baseFret: 1,
          barres: []
        }]
      };
    }
  }

  // Normalize bass note for slash chords (database uses specific enharmonic spellings)
  function normalizeSlashBass(bassNote) {
    // The database uses these specific spellings for slash chord bass notes
    const bassMap = {
      'C': 'C', 'C#': 'C#', 'Db': 'C#',
      'D': 'D', 'D#': 'D#', 'Eb': 'D#',
      'E': 'E',
      'F': 'F', 'F#': 'F#', 'Gb': 'F#',
      'G': 'G', 'G#': 'G#', 'Ab': 'G#',
      'A': 'A', 'A#': 'Bb', 'Bb': 'Bb',
      'B': 'B'
    };
    return bassMap[bassNote] || bassNote;
  }

  // Parse a chord name like "Am7", "Cmaj7", "F#m", "Gsus4", "C/B", "Am/G" into key and suffix
  function parseChordName(chordName) {
    // Match root note (with optional sharp/flat) and suffix
    const match = chordName.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return null;

    let [, root, suffix] = match;
    root = normalizeChordKey(root);

    // Normalize suffix
    if (!suffix || suffix === '') {
      suffix = 'major';
    } else if (suffix === 'm' || suffix === 'min') {
      suffix = 'minor';
    } else if (suffix.match(/^m\/[A-G][#b]?$/)) {
      // Minor slash chord like "Am/G" -> suffix is "m/G"
      const bassNote = suffix.substring(2);
      const normalizedBass = normalizeSlashBass(bassNote);
      suffix = 'm/' + normalizedBass;
    } else if (suffix.match(/^\/[A-G][#b]?$/)) {
      // Major slash chord like "C/B" -> suffix is "/B"
      const bassNote = suffix.substring(1);
      const normalizedBass = normalizeSlashBass(bassNote);
      suffix = '/' + normalizedBass;
    } else if (suffix.startsWith('m') && !suffix.startsWith('maj')) {
      // m7, m9, etc. -> check the database suffixes
      const minorSuffix = 'm' + suffix.substring(1);
      if (chordMap[root] && chordMap[root][minorSuffix]) {
        suffix = minorSuffix;
      }
    }

    return { root, suffix };
  }

  // Get chord data from the database or custom definitions
  function getChordData(chordName) {
    const parsed = parseChordName(chordName);

    // Try database first (has finger numbering)
    if (parsed) {
      const { root, suffix } = parsed;

      if (chordMap[root]) {
        // Try exact match first
        if (chordMap[root][suffix]) {
          return { key: root, suffix, positions: chordMap[root][suffix] };
        }

        // Try common suffix variations
        const suffixVariations = {
          '': 'major',
          'M': 'major',
          'maj': 'major',
          'm': 'minor',
          'min': 'minor',
          '7': '7',
          'maj7': 'maj7',
          'M7': 'maj7',
          'm7': 'm7',
          'min7': 'm7',
          'dim': 'dim',
          'aug': 'aug',
          'sus2': 'sus2',
          'sus4': 'sus4',
          'sus': 'sus4',
          'add9': 'add9',
          '9': '9',
          '11': '11',
          '13': '13',
          '6': '6',
          'm6': 'm6',
          'dim7': 'dim7',
        };

        const normalizedSuffix = suffixVariations[suffix] || suffix;
        if (chordMap[root][normalizedSuffix]) {
          return { key: root, suffix: normalizedSuffix, positions: chordMap[root][normalizedSuffix] };
        }
      }
    }

    // Fall back to custom chords scraped from page (e.g., "C/B: x2x010")
    if (customChords[chordName]) {
      return { key: chordName, suffix: '', positions: customChords[chordName].positions };
    }

    return null;
  }

  // Convert chords-db position format to SVGuitar format
  function convertToSVGuitarFormat(position) {
    const fingers = [];
    const barres = [];

    // Process frets and fingers
    for (let string = 0; string < position.frets.length; string++) {
      const fret = position.frets[string];
      const finger = position.fingers ? position.fingers[string] : 0;

      if (fret === -1 || fret === 'x') {
        // Muted string
        fingers.push([6 - string, 'x']);
      } else if (fret === 0) {
        // Open string - don't add to fingers, it's shown automatically
      } else {
        // Fretted note - use finger number as text if available
        const fingerText = finger > 0 ? String(finger) : '';
        fingers.push([6 - string, fret, fingerText]);
      }
    }

    // Process barres
    if (position.barres && position.barres.length > 0) {
      for (const barreFret of position.barres) {
        // Find the strings covered by this barre
        let fromString = 6;
        let toString = 1;

        for (let string = 0; string < position.frets.length; string++) {
          if (position.frets[string] === barreFret) {
            const svgString = 6 - string;
            fromString = Math.min(fromString, svgString);
            toString = Math.max(toString, svgString);
          }
        }

        if (fromString < toString) {
          barres.push({
            fromString: toString,
            toString: fromString,
            fret: barreFret,
          });
        }
      }
    }

    return {
      fingers,
      barres,
      position: position.baseFret || 1,
    };
  }

  // Create and show chord popup
  function showChordPopup(chordName, targetElement) {
    // Remove any existing popup
    hideChordPopup();

    const chordData = getChordData(chordName);
    if (!chordData) return;

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'ugf-chord-popup';
    popup.id = 'ugf-chord-popup';

    // Create header with chord name and close button
    const header = document.createElement('div');
    header.className = 'ugf-chord-header';
    header.innerHTML = `
      <span class="ugf-chord-name">${chordData.key}${chordData.suffix === 'major' ? '' : chordData.suffix}</span>
      <button class="ugf-chord-close">&times;</button>
    `;
    popup.appendChild(header);

    // Create position tabs if multiple positions
    if (chordData.positions.length > 1) {
      const tabs = document.createElement('div');
      tabs.className = 'ugf-chord-tabs';
      for (let i = 0; i < Math.min(chordData.positions.length, 4); i++) {
        const tab = document.createElement('button');
        tab.className = 'ugf-chord-tab' + (i === 0 ? ' active' : '');
        tab.textContent = `Pos ${i + 1}`;
        tab.dataset.position = i;
        tabs.appendChild(tab);
      }
      popup.appendChild(tabs);
    }

    // Create diagram container
    const diagramContainer = document.createElement('div');
    diagramContainer.className = 'ugf-chord-diagram';
    popup.appendChild(diagramContainer);

    // Add popup to container
    ugfContainer.appendChild(popup);
    activeChordPopup = popup;

    // Render first position
    renderChordDiagram(diagramContainer, chordData.positions[0]);

    // Position the popup near the chord
    positionPopup(popup, targetElement);

    // Add event listeners
    popup.querySelector('.ugf-chord-close').addEventListener('click', (e) => {
      e.stopPropagation();
      hideChordPopup();
    });

    // Tab switching
    const tabs = popup.querySelectorAll('.ugf-chord-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const posIndex = parseInt(tab.dataset.position);
        diagramContainer.innerHTML = '';
        renderChordDiagram(diagramContainer, chordData.positions[posIndex]);
      });
    });

    // Click outside to close
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 0);
  }

  function handleOutsideClick(e) {
    if (activeChordPopup && !activeChordPopup.contains(e.target)) {
      hideChordPopup();
    }
  }

  function hideChordPopup() {
    if (activeChordPopup) {
      activeChordPopup.remove();
      activeChordPopup = null;
      document.removeEventListener('click', handleOutsideClick);
    }
  }

  function positionPopup(popup, targetElement) {
    const targetRect = targetElement.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();

    // Position above or below the chord, centered
    let top = targetRect.bottom + 8;
    let left = targetRect.left + (targetRect.width / 2) - (popupRect.width / 2);

    // Keep within viewport
    if (top + popupRect.height > window.innerHeight - 20) {
      top = targetRect.top - popupRect.height - 8;
    }
    if (left < 10) left = 10;
    if (left + popupRect.width > window.innerWidth - 10) {
      left = window.innerWidth - popupRect.width - 10;
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  function renderChordDiagram(container, position) {
    const svgData = convertToSVGuitarFormat(position);

    const chart = new SVGuitarChord(container)
      .configure({
        strings: 6,
        frets: 4,
        position: svgData.position,
        tuning: [],
        fretLabelPosition: 'right',
        fretLabelFontSize: 32,
        fingerSize: 0.7,
        fingerColor: '#4fc3f7',
        fingerTextColor: '#000',
        fingerTextSize: 28,
        strokeWidth: 2,
        nutWidth: 6,
        color: '#e0e0e0',
        backgroundColor: 'transparent',
        fretColor: '#555',
        stringColor: '#888',
        titleFontSize: 0,
        sidePadding: 0.15,
        fretMarkers: [],
        showFretMarkers: false,
      })
      .chord({
        fingers: svgData.fingers,
        barres: svgData.barres,
      })
      .draw();
  }

  function extractSongData() {
    // Get song title
    const titleEl = document.querySelector('h1');
    const title = titleEl ? titleEl.textContent.replace('Chords', '').replace('Tab', '').trim() : 'Unknown';

    // Get artist name
    const artistLink = document.querySelector('a[href*="/artist/"]');
    const artist = artistLink ? artistLink.textContent.trim() : 'Unknown';

    // Get other versions from the "More Versions" section
    const versions = extractVersions();

    // Get the pre element containing chords and lyrics
    // Find any pre element that contains chord spans (data-name attribute)
    let preEl = null;
    const allPres = document.querySelectorAll('pre');
    for (const pre of allPres) {
      if (pre.querySelector('span[data-name]')) {
        preEl = pre;
        break;
      }
    }

    if (!preEl) {
      console.log('[UGF] No pre element with chords found');
      return null;
    }

    // Clone the pre element to preserve the original formatting
    const preClone = preEl.cloneNode(true);

    // Parse custom chord definitions from the page (e.g., "C/B: x2x010")
    parseCustomChordDefinitions(preEl.textContent);

    // Process the content to split into sections for column layout
    const content = preClone.innerHTML;

    // Split by section headers [Verse], [Chorus], {Verse}, {Chorus}, etc.
    // Only match headers with simple text (letters, numbers, spaces) - not HTML
    const sectionRegex = /[\[{]([A-Za-z0-9 ]+)[\]}]/g;
    const sections = [];

    // Check if there are any section headers
    const firstMatch = content.match(sectionRegex);

    // Helper to trim only leading/trailing newlines, preserving horizontal spacing
    const trimNewlines = (str) => str.replace(/^\n+/, '').replace(/\n+$/, '');

    if (!firstMatch) {
      // No section headers - split on double line breaks (blank lines)
      const chunks = content.split(/\n\s*\n/);
      for (const chunk of chunks) {
        const trimmed = trimNewlines(chunk);
        if (trimmed) {
          sections.push({ title: '', content: trimmed });
        }
      }
      // If still just one big chunk, use it as-is
      if (sections.length === 0) {
        sections.push({ title: '', content: trimNewlines(content) });
      }
    } else {
      // Find content before first section (intro/chord definitions)
      const firstSectionIndex = content.indexOf(firstMatch[0]);
      if (firstSectionIndex > 0) {
        const introContent = trimNewlines(content.substring(0, firstSectionIndex));
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
        const sectionContent = parts[i + 1] ? trimNewlines(parts[i + 1]) : '';
        sections.push({ title: sectionTitle, content: sectionContent });
      }
    }

    return { title, artist, sections, versions };
  }

  function extractVersions() {
    const versions = [];

    // Find all anchor tags that contain a rating meter - these are version links
    const versionLinks = document.querySelectorAll('a:has([role="meter"][aria-label="Rating"])');

    for (const link of versionLinks) {
      const href = link.getAttribute('href');
      if (!href) continue;

      // Get the version name from the first span child (before the meter)
      const nameSpan = link.querySelector(':scope > span');
      const name = nameSpan ? nameSpan.textContent.trim() : 'Unknown';

      // Skip the official version (it's a pro/paid link)
      if (name.toLowerCase() === 'official') continue;

      const isCurrent = link.hasAttribute('data-current') || link.getAttribute('aria-current') === 'page';

      // Get the rating from the meter element's aria-valuenow
      const meter = link.querySelector('[role="meter"][aria-label="Rating"]');
      const rating = meter ? meter.getAttribute('aria-valuenow') : '';

      // Get the votes count - it's in a span with text like "(3.1K)"
      let votes = '';
      if (meter) {
        const spans = meter.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent.trim();
          const match = text.match(/^\(([\d.,]+K?)\)$/);
          if (match) {
            votes = match[1];
            break;
          }
        }
      }

      versions.push({
        href,
        name,
        rating,
        votes,
        isCurrent
      });
    }

    return versions;
  }

  function buildVersionDropdown(versions) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ugf-version-dropdown';

    // Find current version for the button label
    const currentVersion = versions.find(v => v.isCurrent);
    const currentLabel = currentVersion ? currentVersion.name : 'Version';

    // Build rating display for button
    let ratingHtml = '';
    if (currentVersion && currentVersion.rating) {
      ratingHtml = `<span class="ugf-btn-rating">★ ${currentVersion.rating}</span>`;
      if (currentVersion.votes) {
        ratingHtml += `<span class="ugf-btn-votes">(${currentVersion.votes})</span>`;
      }
    }

    // Create dropdown button
    const button = document.createElement('button');
    button.className = 'ugf-version-btn';
    button.innerHTML = `
      <span>${currentLabel}</span>
      ${ratingHtml}
      <svg viewBox="0 0 20 20" class="ugf-dropdown-arrow">
        <path fill-rule="evenodd" d="M16.5 7.393 10 14 3.5 7.393 4.87 6 10 11.214 15.13 6z" clip-rule="evenodd"></path>
      </svg>
    `;

    // Create dropdown menu
    const menu = document.createElement('div');
    menu.className = 'ugf-version-menu';

    for (const version of versions) {
      const item = document.createElement('a');
      item.className = 'ugf-version-item' + (version.isCurrent ? ' ugf-version-current' : '');
      item.href = version.href;

      item.innerHTML = `
        <span class="ugf-version-name">${version.name}</span>
        <span class="ugf-version-rating">${version.rating ? '★ ' + version.rating : ''}</span>
        <span class="ugf-version-votes">${version.votes ? '(' + version.votes + ')' : ''}</span>
      `;

      menu.appendChild(item);
    }

    wrapper.appendChild(button);
    wrapper.appendChild(menu);

    // Toggle dropdown on click
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      wrapper.classList.toggle('ugf-dropdown-open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      wrapper.classList.remove('ugf-dropdown-open');
    });

    return wrapper;
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

    // Controls row (toggle button + version dropdown)
    const controlsRow = document.createElement('div');
    controlsRow.className = 'ugf-controls';

    // Toggle button - switches between views
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ugf-toggle-btn';
    toggleBtn.textContent = 'Original';
    toggleBtn.addEventListener('click', toggleView);
    controlsRow.appendChild(toggleBtn);

    // Add version dropdown if there are other versions
    if (songData.versions && songData.versions.length > 1) {
      const versionDropdown = buildVersionDropdown(songData.versions);
      controlsRow.appendChild(versionDropdown);
    }

    container.appendChild(controlsRow);

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

    // Add click handlers to chord spans
    container.querySelectorAll('span[data-name]').forEach(chordSpan => {
      chordSpan.classList.add('ugf-chord-clickable');
      chordSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        const chordName = chordSpan.getAttribute('data-name') || chordSpan.textContent.trim();
        showChordPopup(chordName, chordSpan);
      });
    });

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

      #ugf-root .ugf-controls {
        position: fixed;
        top: 1rem;
        right: 1rem;
        display: flex;
        gap: 0.5rem;
        align-items: flex-start;
        z-index: 100000;
      }

      #ugf-root .ugf-version-dropdown {
        position: relative;
        display: inline-block;
      }

      #ugf-root .ugf-version-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: #2a2a2a;
        color: #ccc;
        border: 1px solid #444;
        padding: 0.4rem 0.8rem;
        font-family: inherit;
        font-size: 0.8rem;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      #ugf-root .ugf-version-btn:hover {
        background: #333;
        color: #fff;
        border-color: #555;
      }

      #ugf-root .ugf-dropdown-arrow {
        width: 12px;
        height: 12px;
        fill: currentColor;
        transition: transform 0.2s ease;
      }

      #ugf-root .ugf-dropdown-open .ugf-dropdown-arrow {
        transform: rotate(180deg);
      }

      #ugf-root .ugf-version-menu {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 0.25rem;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 4px;
        max-height: 300px;
        overflow-y: auto;
        z-index: 100001;
        display: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      }

      #ugf-root .ugf-version-menu {
        display: none;
      }

      #ugf-root .ugf-dropdown-open .ugf-version-menu {
        display: grid;
        grid-template-columns: auto auto auto;
      }

      #ugf-root .ugf-version-item {
        display: contents;
      }

      #ugf-root .ugf-version-item > span {
        padding: 0.5rem 0.5rem;
        text-decoration: none;
        font-size: 0.8rem;
        transition: background 0.15s ease;
        white-space: nowrap;
      }

      #ugf-root .ugf-version-item:hover > span {
        background: #3a3a3a;
      }

      #ugf-root .ugf-version-item.ugf-version-current > span {
        background: #333;
      }

      #ugf-root .ugf-version-name {
        padding-left: 0.75rem;
        color: #ccc;
      }

      #ugf-root .ugf-version-item:hover > .ugf-version-name {
        color: #fff;
      }

      #ugf-root .ugf-version-item.ugf-version-current > .ugf-version-name {
        color: #4fc3f7;
      }

      #ugf-root .ugf-version-rating {
        color: #ffd700;
        text-align: right;
      }

      #ugf-root .ugf-version-votes {
        color: #666;
        font-size: 0.75rem;
        padding-right: 0.75rem;
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

      #ugf-root .ugf-chord-clickable {
        cursor: pointer;
        transition: all 0.15s ease;
        border-radius: 2px;
      }

      #ugf-root .ugf-chord-clickable:hover {
        background: rgba(79, 195, 247, 0.2);
        text-decoration: underline;
      }

      #ugf-root .ugf-toggle-btn {
        background: #333;
        color: #888;
        border: 1px solid #444;
        padding: 0.4rem 0.8rem;
        font-family: inherit;
        font-size: 0.8rem;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      #ugf-root .ugf-btn-rating {
        color: #ffd700;
        margin-left: 0.4rem;
      }

      #ugf-root .ugf-btn-votes {
        color: #666;
        font-size: 0.75rem;
        margin-left: 0.2rem;
      }

      #ugf-root .ugf-toggle-btn:hover {
        background: #444;
        color: #fff;
        border-color: #555;
      }

      /* Chord popup styles */
      #ugf-root .ugf-chord-popup {
        position: fixed;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        z-index: 100002;
        min-width: 180px;
        overflow: hidden;
      }

      #ugf-root .ugf-chord-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0.75rem;
        background: #333;
        border-bottom: 1px solid #444;
      }

      #ugf-root .ugf-chord-name {
        font-weight: 600;
        color: #4fc3f7;
        font-size: 1rem;
      }

      #ugf-root .ugf-chord-close {
        background: none;
        border: none;
        color: #888;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }

      #ugf-root .ugf-chord-close:hover {
        color: #fff;
      }

      #ugf-root .ugf-chord-tabs {
        display: flex;
        gap: 2px;
        padding: 0.5rem;
        background: #252525;
        border-bottom: 1px solid #444;
      }

      #ugf-root .ugf-chord-tab {
        flex: 1;
        background: #333;
        border: none;
        color: #888;
        padding: 0.3rem 0.5rem;
        font-size: 0.7rem;
        cursor: pointer;
        border-radius: 3px;
        transition: all 0.15s ease;
      }

      #ugf-root .ugf-chord-tab:hover {
        background: #444;
        color: #ccc;
      }

      #ugf-root .ugf-chord-tab.active {
        background: #4fc3f7;
        color: #000;
      }

      #ugf-root .ugf-chord-diagram {
        padding: 0.5rem;
        display: flex;
        justify-content: center;
      }

      #ugf-root .ugf-chord-diagram svg {
        width: 140px;
        height: auto;
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

    // Click "Show all" button to expand the versions list
    // Find it by looking for a button containing "Show all" text near the versions section
    const buttons = document.querySelectorAll('button[aria-expanded="false"]');
    for (const btn of buttons) {
      if (btn.textContent.trim().toLowerCase().includes('show all')) {
        btn.click();
        break;
      }
    }

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
