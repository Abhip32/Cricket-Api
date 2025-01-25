const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const teamFlagsPath = path.join(__dirname, '..', 'team_flags.json');
const teamFlags = JSON.parse(fs.readFileSync(teamFlagsPath, 'utf8'));
const lowerCaseTeamFlags = Object.fromEntries(
  Object.entries(teamFlags).map(([key, value]) => [key.toLowerCase(), value])
);
function mapCategory(category) {
  if (category === 'bowling') {
      return 'bowlers';
  } else if (category === 'batting') {
      return 'batsmen';
  } else if (category === 'all-rounder') {
      return 'allrounders';
  } else if (category === 'teams') {
      return 'teams'; // No change needed
  } else {
      return category; // Return the original category if it doesn't match
  }
}


const fetchRankingsData = async (url) => {
  try {
    // Extract the last part of the URL (e.g., "all-rounder")
    const urlParts = url.split("/");
    const category = mapCategory(urlParts[urlParts.length - 1]);

    // Map categories to the correct ng-show conditions for all formats
    const tabIdMap = {
      test: `"'${category}-tests' == act_rank_format"`,
      odi: `"'${category}-odis' == act_rank_format"`,
      t20: `"'${category}-t20s' == act_rank_format"`,
    };
    // Fetch HTML content
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const rankingsData = {
      test: [],
      odi: [],
      t20: [],
    };

    // Scrape data for each format based on ng-show conditions
    for (const [format, ngShowCondition] of Object.entries(tabIdMap)) {
      $(`.cb-col.cb-col-100[ng-show=${ngShowCondition}]`).find('.cb-col.cb-col-100.cb-font-14.cb-lst-itm.text-center').each(function () {
        const rank = $(this).find('.cb-col.cb-col-16.cb-rank-tbl.cb-font-16').text().trim();
        const name = $(this).find('.text-hvr-underline.text-bold.cb-font-16').text().trim();
        const country = $(this).find('.cb-font-12.text-gray').text().trim();
        const rating = $(this).find('.cb-col.cb-col-17.rank-tbl.pull-right').text().trim();
        const photo = $(this).find('.cb-col.cb-col-50 img').attr('src');
        const finalPhoto = photo ? photo.replace('50x50', '200x200') : "https://static.cricbuzz.com/a/img/v1/50x50/i1/c182026/default.jpg";

        rankingsData[format].push({ rank, name, country, rating, photo: finalPhoto });
      });
    }

    return rankingsData;
  } catch (error) {
    console.error('Error fetching rankings data:', error.message);
    return {
      test: [],
      odi: [],
      t20: [],
    };
  }
};

const rankingsController = {
  getBattingRankings: async (req, res) => {
    const url = 'https://www.cricbuzz.com/cricket-stats/icc-rankings/men/batting';
    const battingRankingsData = await fetchRankingsData(url);
    res.json(battingRankingsData);
  },

  getBowlingRankings: async (req, res) => {
    const url = 'https://www.cricbuzz.com/cricket-stats/icc-rankings/men/bowling';
    const bowlingRankingsData = await fetchRankingsData(url);
    res.json(bowlingRankingsData);
  },

  getAllrounderRankings: async (req, res) => {
    const url = 'https://www.cricbuzz.com/cricket-stats/icc-rankings/men/all-rounder';
    const allrounderRankingsData = await fetchRankingsData(url);
    res.json(allrounderRankingsData);
  },

  getTeamsRankings : async (req, res) => {
    try {
      const response = await axios.get('https://www.cricbuzz.com/cricket-stats/icc-rankings/men/teams');
      const html = response.data;
      const $ = cheerio.load(html);
  
      const tabIdMap = {
        test: `"'teams-tests' == act_rank_format"`,
        odi: `"'teams-odis' == act_rank_format"`,
        t20: `"'teams-t20s' == act_rank_format"`,
      };
  
      const rankingsData = {
        test: [],
        odi: [],
        t20: [],
      };
  
      // Scrape data for each format based on ng-show conditions
      for (const [format, ngShowCondition] of Object.entries(tabIdMap)) {
        $(`.cb-col.cb-col-100[ng-show=${ngShowCondition}]`).find('.cb-col.cb-col-100.cb-font-14.cb-brdr-thin-btm.text-center').each(function () {
          const rank = $(this).find('.cb-col.cb-col-20.cb-lst-itm-sm').text().trim();
          const country = $(this).find('.cb-col.cb-col-50.cb-lst-itm-sm.text-left').text().trim();
          const lowercasecountry=country.toLowerCase();
          const rating = $(this).find('.cb-col.cb-col-14').text().trim();
          const photo = lowerCaseTeamFlags[lowercasecountry] || teamFlags["Default"];
  
          rankingsData[format].push({ rank, country, rating, photo });
        });
      }
  
      res.status(200).json(rankingsData);
    } catch (error) {
      console.error('Error fetching cricket data:', error);
      res.status(500).json({ error: 'Failed to fetch team rankings' });
    }
  }
};

module.exports = rankingsController;