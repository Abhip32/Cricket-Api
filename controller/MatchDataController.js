const axios = require('axios');
const cheerio = require('cheerio');



const MatchDataController = {
  getLiveMatches: async (req, res) => {
    try {
      const response = await axios.get('https://www.cricketlineguru.com/live-scores');
      const html = response.data;
      const $ = cheerio.load(html);
  
      const matches = $('.card.ng-star-inserted');
      const matchDetails = [];
  
      matches.each((index, element) => {
        const match = {};
  
        const status = $(element).find('.text-right').text().trim();
        const description = $(element).find('.top-left').text();
        const link=$(element).find('.top-left').find('a').attr('href');
        const time= $(element).find('.time_top').text().trim();
        const teamA = $(element).find('.team_name').first().text();
        const flagA = $(element).find('.user-img').first().attr('src');
        const flagB = $(element).find('.user-img').last().attr('src');
        const teamB = $(element).find('.team_name').last().text();
        const scoreA = $(element).find('.full-content').first().text().trim();
        const scoreB = $(element).find('.full-content').last().text().trim();
        const result =$(element).find('.bot-message').text().trim();

        match.status = status === ''? result:status;
        match.description = description;
        match.overview = 'https://www.cricketlineguru.com'+link;
        match.fixtures = 'https://www.cricketlineguru.com'+link.replace('overview','fixtures');
        match.news = 'https://www.cricketlineguru.com'+link.replace('overview','news');
        match.videos = 'https://www.cricketlineguru.com'+link.replace('overview','videos');
        match.news = 'https://www.cricketlineguru.com'+link.replace('overview','news');
        match.venues='https://www.cricketlineguru.com'+link.replace('overview','venues');
        match.time=time;
        match.teamA = teamA;
        match.teamB = teamB;
        match.flagA = flagA;
        match.flagB = flagB;
        match.scoreA=scoreA;
        match.scoreB = scoreB;
        

        matchDetails.push(match);

      });
  
      res.status(200).send(matchDetails);
    } catch (error) {
      console.log(error);
    }
  },


  getRecentMatches : async (req, res) => {
    try {
      const response = await axios.get('https://www.cricketlineguru.com/cricket-schedule/recent/all');
      const html = response.data;
      const $ = cheerio.load(html);

      const matchDetails = [];

$('tr.ng-star-inserted').each((index, row) => {
  const date=$(row).find('.purple_text').text();
    $(row).find('td.ng-star-inserted').each((index, cell) => {
        $(cell).find('div.ng-star-inserted').each((index, div) => { // Changed variable name from cell to div
            const $element = $(div); // Changed variable name from cell to div
            
            const $match = $element.find('.match');
            const $current = $element.find('.current');
            
            const match = {
                linkCommentary:  $match.find('a').attr('href'),
                linkScoreCard:  $match.find('a').attr('href')?.replace('commentary', 'match-scorecard'),
                linkInfo:  $match.find('a').attr('href')?.replace('commentary', 'info'),
                linkSquad:  $match.find('a').attr('href')?.replace('commentary', 'squad'),
                title: $match.find('a').first().text(),
                details: $match.find('.match span').last().text(),
                teamA: $current.first().find('.name').text(),
                scoreA: $current.first().find('.score').text(),
                flagA: $current.first().find('img').attr('src'),
                info: $element.find('p.info').first().text(), // Changed $element instead of $element.find
                teamB: $current.first().next().find('.name').text(),
                scoreB: $current.first().next().find('.score').text(),
                flagB: $current.first().next().find('img').attr('src'),
                date:date
            };
            
            if(match.linkCommentary !== 'https://www.cricketlineguru.comundefined')
            {
              matchDetails.push(match);
            }
        });
    });
});

        res.status(200).send(matchDetails);
      
    } catch (error) {
      console.log(error);
    }
    
  },

  getUpcomingMatches:async (req,res)=>{
    try {
      const response = await axios.get('https://www.cricketlineguru.com/cricket-schedule/upcoming/all');
      const html = response.data;
      const $ = cheerio.load(html);

      const matchDetails = [];

$('tr.ng-star-inserted').each((index, row) => {
  const date=$(row).find('.purple_text').text();
    $(row).find('td.ng-star-inserted').each((index, cell) => {
        $(cell).find('div.ng-star-inserted').each((index, div) => { // Changed variable name from cell to div
            const $element = $(div); // Changed variable name from cell to div
            
            const $match = $element.find('.match');
            const $current = $element.find('.current');
            
            const match = {
                linkCommentary:  $match.find('a').attr('href'),
                linkScoreCard:  $match.find('a').attr('href')?.replace('commentary', 'match-scorecard'),
                linkInfo:  $match.find('a').attr('href')?.replace('commentary', 'info'),
                linkSquad:  $match.find('a').attr('href')?.replace('commentary', 'squad'),
                title: $match.find('a').first().text(),
                details: $match.find('.match span').last().text(),
                teamA: $current.first().find('.name').text(),
                scoreA: $current.first().find('.score').text(),
                flagA: $current.first().find('img').attr('src'),
                info: $element.find('p.info').first().text(), // Changed $element instead of $element.find
                teamB: $current.first().next().find('.name').text(),
                scoreB: $current.first().next().find('.score').text(),
                flagB: $current.first().next().find('img').attr('src'),
                date:date
            };
            
            if(match.linkCommentary !== 'https://www.cricketlineguru.comundefined')
            {
              matchDetails.push(match);
            }
        });
    });
});

      
      res.status(200).send(matchDetails);
    } catch (error) {
      console.log(error);
    }
  },


};

module.exports = MatchDataController;
