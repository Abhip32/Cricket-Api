const axios = require('axios');
const cheerio = require('cheerio');

const MatchDataController = {
  getLiveMatches: async (req, res) => {
    try {
      const [liveResponse, completedResponse, upcomingResponse] = await Promise.all([
        axios.get('https://www.cricketworld.com/cricket/live'),
        axios.get('https://www.cricketworld.com/cricket/completed'),
        axios.get('https://www.cricketworld.com/cricket/upcoming')
      ]);

      const liveMatches = parseMatches(liveResponse.data);
      const completedMatches = parseMatches(completedResponse.data);
      const upcomingMatches = parseMatches(upcomingResponse.data);

      res.status(200).send({ liveMatches, completedMatches, upcomingMatches });
    } catch (error) {
      console.log(error);
      res.status(500).send('Internal Server Error');
    }
  },
};

function parseMatches(html) {
  const $ = cheerio.load(html);
  const matches = $('.matches-table.fixtures.rt .match-row');
  const matchDetails = [];

  matches.each((index, element) => {
    const match = {
      teamA: $(element).find('.teama .teamName').text(),
      flagA: $(element).find('.teama .teamLogo img').attr('src'),
      flagB: $(element).find('.teamb .teamLogo img').attr('src'),
      teamB: $(element).find('.teamb .teamName').text(),
      scoreA: $(element).find('.teama .teamaScore').text().replace(/\n/g, ''),
      scoreB: $(element).find('.teamb .teamaScore').text().replace(/\n/g, ''),
      status: $(element).find('.status.status-1').text(),
      day: $(element).find('.day').text(),
      title: $(element).find('.title').text(),
      subtitle: $(element).find('.subtitle').text(),
      progress: $(element).find('.column-action').text().replace(/\n/g, ''),
      link: $(element).attr('href')
    };
    matchDetails.push(match);
  });

  return matchDetails;
}

module.exports = MatchDataController;
