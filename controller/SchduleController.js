const axios = require('axios');
const cheerio = require('cheerio');

const scheduleController = {
  getSchedule: async (req, res) => {
    try {
      const response = await axios.get('https://www.cricbuzz.com/cricket-schedule/series');
      const html = response.data;
      const $ = cheerio.load(html);
      const matches = [];

      $('.cb-col-100.cb-col .cb-sch-lst-itm', html).each(function () {
        const tour = $(this).find('span.text-black').text().trim();
        const duration = $(this).find('div.text-gray.cb-font-12').text().trim();

        let month = '';
        const monthSm = duration.slice(0, 3);
        const monthsMapping = {
          Jan: 'January',
          Feb: 'February',
          Mar: 'March',
          Apr: 'April',
          May: 'May',
          Jun: 'June',
          Jul: 'July',
          Aug: 'August',
          Sep: 'September',
          Oct: 'October',
          Nov: 'November',
          Dec: 'December',
        };
        if (monthsMapping.hasOwnProperty(monthSm)) {
          month = monthsMapping[monthSm];
        }

        matches.push({
          month,
          tour,
          duration,
        });
      });

      res.json(matches);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },
};

module.exports = scheduleController;
