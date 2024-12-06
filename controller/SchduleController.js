const axios = require('axios');
const cheerio = require('cheerio');

const scheduleController = {
  getSchedule: async (req, res) => {
    try {
      const response = await axios.get('https://www.cricbuzz.com/cricket-schedule/series/all');
      const html = response.data;
      const $ = cheerio.load(html);
      const matchesByMonth = {};

      $('.cb-sch-lst-itm', html).each(function () {
        const tour = $(this).find('span.text-black').text().trim();
        const duration = $(this).find('div.text-gray.cb-font-12').text().trim();
        const month = $(this).closest('.cb-col-100.cb-col').find('.cb-mnth').text().trim();

        if (!matchesByMonth[month]) {
          matchesByMonth[month] = [];
        }

        matchesByMonth[month].push({
          tour,
          duration,
        });
      });

      res.json(matchesByMonth);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },
};

module.exports = scheduleController;
