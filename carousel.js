const prevBtn = document.querySelector('.carousel-btn.prev');
const nextBtn = document.querySelector('.carousel-btn.next');
const container = document.querySelector('.carousel-container');

// Get card width dynamically
const card = container.querySelector('.card');
const cardWidth = card.offsetWidth + 20; // card width + gap

prevBtn.addEventListener('click', () => {
  container.scrollBy({ left: -cardWidth, behavior: 'smooth' });
});

nextBtn.addEventListener('click', () => {
  container.scrollBy({ left: cardWidth, behavior: 'smooth' });
});

