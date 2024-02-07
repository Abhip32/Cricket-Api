const axios = require('axios');
const cheerio = require('cheerio');
const flagController = require('./flagController');



const MatchDataController = {
  getLiveMatches: async (req, res) => {
    try {
      const response = await axios.get('https://www.cricketworld.com/cricket/live');
      const html = response.data;
      const $ = cheerio.load(html);

      const photos = [];
      
      const matches = $('.matches-table.fixtures.rt .match-row');
      const matchDetails = [];
      
      matches.each((index, element) => {
        const match = {};
      
        const teamA = $(element).find('.teama .teamName').text();
        const flagA = $(element).find('.teama .teamLogo img').attr('src');
        const flagB = $(element).find('.teamb .teamLogo img').attr('src');
        const teamB = $(element).find('.teamb .teamName').text();
        const scoreA= $(element).find('.teama .teamaScore').text();
        const scoreB= $(element).find('.teamb .teamaScore').text();
        const status = $(element).find('.status.status-1').text();
        const day= $(element).find('.day').text();
        const title= $(element).find('.title').text();
        const subtitle = $(element).find('.subtitle').text();
        const progress = $(element).find('.column-action').text();
        const Link= $(element).attr('href');
        
      
        match.teamA = teamA;
        match.teamB = teamB;
        match.flagA = flagA;
        match.flagB = flagB;
        match.scoreA= scoreA.replace(/\n/g, '');;
        match.scoreB = scoreB.replace(/\n/g, '');;
        match.status = status;
        match.day= day;
        match.title = title;
        match.subtitle=subtitle;
        match.progress= progress.replace(/\n/g, '');;
        match.link=Link;
      
        matchDetails.push(match);
      });    


res.send(matchDetails);

    } catch (error) {
      console.log(error);
    }
  },


  getRecentMatches : async (req, res) => {
    try {
      const response = await axios.get('https://www.cricketworld.com/cricket/completed');
      const html = response.data;
      const $ = cheerio.load(html);

      const photos = [];
      
      const matches = $('.matches-table.fixtures.rt .match-row');
      const matchDetails = [];
      
      matches.each((index, element) => {
        const match = {};
      
        const teamA = $(element).find('.teama .teamName').text();
        const flagA = $(element).find('.teama .teamLogo img').attr('src');
        const flagB = $(element).find('.teamb .teamLogo img').attr('src');
        const teamB = $(element).find('.teamb .teamName').text();
        const scoreA= $(element).find('.teama .teamaScore').text();
        const scoreB= $(element).find('.teamb .teamaScore').text();
        const status = $(element).find('.status.status-1').text();
        const day= $(element).find('.day').text();
        const title= $(element).find('.title').text();
        const subtitle = $(element).find('.subtitle').text();
        const progress = $(element).find('.column-action').text();
        const Link= $(element).attr('href');
      
        match.teamA = teamA;
        match.teamB = teamB;
        match.flagA = flagA;
        match.flagB = flagB;
        match.scoreA= scoreA.replace(/\n/g, '');;
        match.scoreB = scoreB.replace(/\n/g, '');;
        match.status = status;
        match.day= day;
        match.title = title;
        match.subtitle=subtitle;
        match.progress= progress.replace(/\n/g, '');;
        match.link=Link;
      
        matchDetails.push(match);
      });

        res.send(matchDetails);
      
    } catch (error) {
      console.log(error);
    }
    
  },

  getUpcomingMatches:async (req,res)=>{
    try {
      const response = await axios.get('https://www.cricketworld.com/cricket/upcoming');
      const html = response.data;
      const $ = cheerio.load(html);

      const photos = [];
      
      const matches = $('.matches-table.fixtures.rt .match-row');
      const matchDetails = [];
      
      matches.each((index, element) => {
        const match = {};
      
        const teamA = $(element).find('.teama .teamName').text();
        const flagA = $(element).find('.teama .teamLogo img').attr('src');
        const flagB = $(element).find('.teamb .teamLogo img').attr('src');
        const teamB = $(element).find('.teamb .teamName').text();
        const scoreA= $(element).find('.teama .teamaScore').text();
        const scoreB= $(element).find('.teamb .teamaScore').text();
        const status = $(element).find('.status.status-1').text();
        const day= $(element).find('.day').text();
        const title= $(element).find('.title').text();
        const subtitle = $(element).find('.subtitle').text();
        const progress = $(element).find('.column-action').text();
        const Link= $(element).attr('href');
      
        match.teamA = teamA;
        match.teamB = teamB;
        match.flagA = flagA;
        match.flagB = flagB;
        match.scoreA= scoreA.replace(/\n/g, '');;
        match.scoreB = scoreB.replace(/\n/g, '');;
        match.status = status;
        match.day= day;
        match.title = title;
        match.subtitle=subtitle;
        match.progress= progress.replace(/\n/g, '');;
        match.link=Link;
      
        matchDetails.push(match);
      });
      
      res.send(matchDetails);
    } catch (error) {
      console.log(error);
    }
  },


};

module.exports = MatchDataController;
