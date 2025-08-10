// popup.js
// Allow uploading and previewing multiple images in the popup

const imageInput = document.getElementById('imageInput');
const previewContainer = document.getElementById('previewContainer');

// Store all selected images with metadata
let allImages = [];

imageInput.addEventListener('change', (event) => {
  const files = Array.from(event.target.files);
  files.forEach((file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function(e) {
        allImages.push({
          src: e.target.result,
          name: file.name,
          date: new Date()
        });
        renderPreviews();
      };
      reader.readAsDataURL(file);
    }
  });
  // Reset input so the same file can be selected again if needed
  imageInput.value = '';
});

function renderPreviews() {
  previewContainer.innerHTML = '';
  allImages.forEach((imgObj) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-wrapper';

    const img = document.createElement('img');
    img.src = imgObj.src;
    img.alt = 'Preview';
    img.className = 'preview-image';

    const info = document.createElement('div');
    info.className = 'preview-info';
    const dateStr = imgObj.date.toLocaleString();
    info.innerHTML = `<span class="img-name">${imgObj.name}</span><span class="img-date">${dateStr}</span>`;

    wrapper.appendChild(img);
    wrapper.appendChild(info);
    previewContainer.appendChild(wrapper);
  });
}
