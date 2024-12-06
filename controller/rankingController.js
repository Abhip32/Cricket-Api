const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const teamFlagsPath = path.join(__dirname, '..', 'team_flags.json');
const teamFlags = JSON.parse(fs.readFileSync(teamFlagsPath, 'utf8'));

const fetchRankingsData = async (url) => {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const rankingsData = [];
    $('.cb-col.cb-col-100.cb-font-14.cb-lst-itm.text-center', html).each(function () {
      const index = [];
      $(this).find('.cb-col.cb-col-16.cb-rank-tbl.cb-font-16').each(function () {
        index.push($(this).text().trim());
      });

      const ranks = [];
      $(this).find('.text-hvr-underline.text-bold.cb-font-16').each(function () {
        ranks.push($(this).text().trim());
      });

      const cun = [];
      $(this).find('.cb-font-12.text-gray').each(function () {
        cun.push($(this).text().trim());
      });

      const rat = [];
      $(this).find('.cb-col.cb-col-17.cb-rank-tbl.pull-right').each(function () {
        rat.push($(this).text().trim());
      });

      const photo = [];
      $(this).find('.cb-col.cb-col-50').each(function () {
        const imgSrc = $(this).find('img').attr('src');
        const imgSource = $(this).find('img').attr('source');
        const imgURL = imgSrc || imgSource;
        if (imgURL && !photo.includes(imgURL)) {
          photo.push( imgURL);
        }
      });

      rankingsData.push({ index, ranks, country: cun, ratings: rat, photo });
    });

    return rankingsData;
  } catch (error) {
    console.log(error);
    return [];
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

  getTeamsRankings: async (req, res) => {
    try {
      const response = await axios.get('https://www.cricbuzz.com/cricket-stats/icc-rankings/men/teams');
      const html = response.data;
      const $ = cheerio.load(html);

      const arr4 = $('.cb-col.cb-col-100.cb-font-14.cb-brdr-thin-btm.text-center', html).map(function () {
        const index = $(this).find('.cb-col.cb-col-20.cb-lst-itm-sm').map(function () {
          return $(this).text().trim();
        }).get();

        const countryName = $(this).find('.cb-col.cb-col-50.cb-lst-itm-sm.text-left').map(function () {
          return $(this).text().trim().toLowerCase();
        }).get();

        const ratings = $(this).find('.cb-col.cb-col-14').map(function () {
          return $(this).text().trim();
        }).get();

        const formattedCountryName = countryName[0].toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        const flag = teamFlags[formattedCountryName] || teamFlags['Default'];

        return { 
          index, 
          country: countryName, 
          ratings,
          flag
        };
      }).get();

      res.status(200).send(arr4);
    } catch (error) {
      console.error('Error fetching cricket data:', error);
      return []; // Return an empty array or handle the error as needed.
    }
  }
};

module.exports = rankingsController;
