// popup.js
// Allow uploading and previewing multiple images in the popup

const imageInput = document.getElementById('imageInput');
const previewContainer = document.getElementById('previewContainer');

// Store all selected images with metadata
let allImages = [];

// Load images from chrome.storage.local on popup open
document.addEventListener('DOMContentLoaded', () => {
  console.log('[FindThePieces] Popup loaded');
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['findThePiecesImages'], (result) => {
      console.log('[FindThePieces] Storage get result:', result);
      if (result.findThePiecesImages) {
        // Parse date strings back to Date objects and ensure puzzle field exists
        allImages = result.findThePiecesImages.map(img => ({
          ...img,
          date: img.date ? new Date(img.date) : new Date(),
          puzzle: typeof img.puzzle === 'boolean' ? img.puzzle : false
        }));
        console.log('[FindThePieces] Images loaded:', allImages);
        renderPreviews();
      } else {
        console.log('[FindThePieces] No images found in storage');
      }
    });
  } else {
    console.warn('[FindThePieces] chrome.storage.local not available');
  }
});

imageInput.addEventListener('change', (event) => {
  const files = Array.from(event.target.files);
  let newImages = [];
  let filesProcessed = 0;
  files.forEach((file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function(e) {
        newImages.push({
          src: e.target.result,
          name: file.name,
          date: new Date(),
          puzzle: false
        });
        filesProcessed++;
        if (filesProcessed === files.length) {
          allImages = allImages.concat(newImages);
          saveImages();
          renderPreviews();
        }
      };
      reader.readAsDataURL(file);
    } else {
      filesProcessed++;
      if (filesProcessed === files.length) {
        allImages = allImages.concat(newImages);
        saveImages();
        renderPreviews();
      }
    }
  });
  // Reset input so the same file can be selected again if needed
  imageInput.value = '';
});

function saveImages() {
  if (chrome && chrome.storage && chrome.storage.local) {
    // Store date as string for serialization
    const toStore = allImages.map(img => ({ ...img, date: img.date.toISOString() }));
    chrome.storage.local.set({ findThePiecesImages: toStore }, () => {
      console.log('[FindThePieces] Images saved:', toStore);
    });
  } else {
    console.warn('[FindThePieces] chrome.storage.local not available for save');
  }
}

function renderPreviews() {
  previewContainer.innerHTML = '';
  console.log('[FindThePieces] Rendering previews:', allImages);
  allImages.forEach((imgObj, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-wrapper';

    const img = document.createElement('img');
    img.src = imgObj.src;
    img.alt = 'Preview';
    img.className = 'preview-image';

    // Lateral info + toggle container
    const side = document.createElement('div');
    side.className = 'preview-side';

    const info = document.createElement('div');
    info.className = 'preview-info';
    const dateStr = new Date(imgObj.date).toLocaleString();
    info.innerHTML = `<span class="img-name">${imgObj.name}</span><span class="img-date">${dateStr}</span>`;

    // Puzzle mode toggle (checkbox)
    const puzzleDiv = document.createElement('div');
    puzzleDiv.className = 'puzzle-toggle';
    const puzzleLabel = document.createElement('label');
    puzzleLabel.innerText = 'Puzzle mode';
    puzzleLabel.htmlFor = `puzzle-check-${idx}`;
    const puzzleCheck = document.createElement('input');
    puzzleCheck.type = 'checkbox';
    puzzleCheck.id = `puzzle-check-${idx}`;
    puzzleCheck.className = 'puzzle-checkbox';
    puzzleCheck.checked = !!imgObj.puzzle;
    puzzleCheck.addEventListener('change', (e) => {
      allImages[idx].puzzle = puzzleCheck.checked;
      saveImages();
    });
    puzzleLabel.prepend(puzzleCheck);
    puzzleDiv.appendChild(puzzleLabel);

    side.appendChild(info);
    side.appendChild(puzzleDiv);

    wrapper.appendChild(img);

    // Full image popup (hidden by default, shown on hover)
    const fullImg = document.createElement('img');
    fullImg.src = imgObj.src;
    fullImg.alt = 'Full preview';
    fullImg.className = 'full-image-popup';
    wrapper.appendChild(fullImg);

    wrapper.appendChild(side);
    previewContainer.appendChild(wrapper);
  });
}
