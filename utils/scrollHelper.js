async function autoScroll(page) {
  return await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0;
      const documentHeight = document.body.scrollHeight;
      const viewportHeight = window.innerHeight;
      
      // Add timeout safety
      const timeout = setTimeout(() => {
        clearInterval(timer);
        resolve(); // Resolve instead of reject to prevent errors
      }, 30000); // 30 second timeout

      // Function to generate a random distance to scroll
      const getRandomScrollDistance = () => Math.floor(Math.random() * 300) * 100; // Reduced max distance to 400px
      const getRandomDelay = () => Math.floor(Math.random() * 100) + 100; // Adjusted to 100-200ms

      const timer = setInterval(() => {
        const distance = getRandomScrollDistance();
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= documentHeight - viewportHeight) {
          clearTimeout(timeout);
          clearInterval(timer);
          resolve();
        }
      }, getRandomDelay());
    });
  });
}

module.exports = { autoScroll };