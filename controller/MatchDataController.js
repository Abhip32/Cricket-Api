const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');


const MatchDataController = {

  
  getLiveMatches: async (req, res) => {
    try {
      const response = await axios.get('https://www.cricbuzz.com/cricket-match/live-scores');
      const html = response.data;
      const $ = cheerio.load(html);
  
      // Load team flags from JSON file
      const teamFlagsPath = path.join(__dirname, '..', 'team_flags.json');
      const teamFlags = JSON.parse(fs.readFileSync(teamFlagsPath, 'utf8'));
  
      const matchDetails = [];
  
      $('.cb-mtch-lst').each((index, element) => {
        const match = {};
        
        // Get match header info
        const header = $(element).find('.cb-col-100.cb-col.cb-schdl.cb-billing-plans-text');
        match.title = header.find('.text-hvr-underline').text().trim();
        match.series = header.closest('.cb-col.cb-col-100.cb-plyr-tbody').find('.cb-lv-grn-strip a').text().trim();
        
        // Extract match info and time
        const matchInfo = header.find('.text-gray').text().trim();
        const timeMatch = matchInfo.match(/(\d{1,2}:\d{2} [APM]{2})/);
        match.matchInfo = matchInfo;
        match.time = timeMatch ? timeMatch[0] : '';
  
        // Extract team names from title
        const teams = match.title.split(' vs ');
        const teamAName = teams[0].trim();
        const teamBName = teams[1]?.replace(',', '').trim();
  
        // Get match scores
        const scoreBlock = $(element).find('.cb-scr-wll-chvrn');
        const batTexts = scoreBlock.find('.cb-hmscg-bat-txt');
        const bwlText = scoreBlock.find('.cb-hmscg-bwl-txt');
        
        // Handle both cases: two bat-txt elements or bat-txt + bwl-txt
        if (batTexts.length === 2) {
          // Case 1: Both teams are in bat-txt
          match.teamA = $(batTexts[0]).find('.cb-hmscg-tm-nm').text().trim();
          match.teamB = $(batTexts[1]).find('.cb-hmscg-tm-nm').text().trim();
          match.scoreA = $(batTexts[0]).find('.cb-ovr-flo').eq(1).text().trim();
          match.scoreB = $(batTexts[1]).find('.cb-ovr-flo').eq(1).text().trim();
        } else {

          const firstElement = batTexts.length > 0 && bwlText.length > 0 
          ? (batTexts[0].startIndex < bwlText[0].startIndex ? batTexts : bwlText)
          : (batTexts.length > 0 ? batTexts : bwlText);
        
        const secondElement = firstElement === batTexts ? bwlText : batTexts;
          // Case 2: Teams split between bat-txt and bwl-txt
          match.teamA = firstElement.find('.cb-hmscg-tm-nm').text().trim();
          match.teamB = secondElement.find('.cb-hmscg-tm-nm').text().trim();
          match.scoreA = firstElement.find('.cb-ovr-flo').eq(1).text().trim();
          match.scoreB = secondElement.find('.cb-ovr-flo').eq(1).text().trim();
        }
        
        // Get match status/result
        match.status = scoreBlock.find('.cb-text-live').text() || 
                       scoreBlock.find('.cb-text-complete').text() ||
                       scoreBlock.find('.cb-text-preview').text()||
                       $(element).find('.cb-lv-scrs-well.cb-lv-scrs-well-preview').text().trim();
  
        // Add flags to match details using full team names
        match.flagA = teamFlags[teamAName] || teamFlags["Default"];;
        match.flagB = teamFlags[teamBName] || teamFlags["Default"];;
  
        // Get match links
        const links = $(element).find('nav a');
        match.links = {};
        links.each((i, link) => {
          const text = $(link).text().toLowerCase()?.replace(/\s+/g, '');
          const href = 'https://www.cricbuzz.com' + $(link).attr('href');
          match.links[text] = href;
        });
  
        if(match.title) { // Only add if match has a title
          matchDetails.push(match);
        }
      });
  
      res.status(200).send(matchDetails);
    } catch (error) {
      console.error('Error fetching live matches:', error);
      res.status(500).send({ error: 'Failed to fetch live matches' });
    }
  },


  getRecentMatches : async (req, res) => {
    try {
      const response = await axios.get('https://www.cricbuzz.com/cricket-match/live-scores/recent-matches');
      const html = response.data;
      const $ = cheerio.load(html);
  
      // Load team flags from JSON file
      const teamFlagsPath = path.join(__dirname, '..', 'team_flags.json');
      const teamFlags = JSON.parse(fs.readFileSync(teamFlagsPath, 'utf8'));
  
      const matchDetails = [];
  
      $('.cb-mtch-lst').each((index, element) => {
        const match = {};
        
        // Get match header info
        const header = $(element).find('.cb-col-100.cb-col.cb-schdl.cb-billing-plans-text');
        match.title = header.find('.text-hvr-underline').text().trim();
        match.series = header.closest('.cb-col.cb-col-100.cb-plyr-tbody').find('.cb-lv-grn-strip a').text().trim();
        
        // Extract match info and time
        const matchInfo = header.find('.text-gray').text().trim();
        const timeMatch = matchInfo.match(/(\d{1,2}:\d{2} [APM]{2})/);
        match.matchInfo = matchInfo;
        match.time = timeMatch ? timeMatch[0] : '';

        // Extract team names from title
        const teams = match.title.split(' vs ');
        const teamAName = teams[0].trim();
        const teamBName = teams[1]?.replace(',', '').trim();
  
        // Get match scores
        const scoreBlock = $(element).find('.cb-scr-wll-chvrn');
        const batTexts = scoreBlock.find('.cb-hmscg-bat-txt');
        const bwlText = scoreBlock.find('.cb-hmscg-bwl-txt');
        
        // Handle both cases: two bat-txt elements or bat-txt + bwl-txt
        if (batTexts.length === 2) {
          // Case 1: Both teams are in bat-txt
          match.teamA = $(batTexts[0]).find('.cb-hmscg-tm-nm').text().trim();
          match.teamB = $(batTexts[1]).find('.cb-hmscg-tm-nm').text().trim();
          match.scoreA = $(batTexts[0]).find('.cb-ovr-flo').eq(1).text().trim();
          match.scoreB = $(batTexts[1]).find('.cb-ovr-flo').eq(1).text().trim();
        } else {
          // Case 2: Teams split between bat-txt and bwl-txt
          const firstElement = batTexts.length > 0 && bwlText.length > 0 
          ? (batTexts[0].startIndex < bwlText[0].startIndex ? batTexts : bwlText)
          : (batTexts.length > 0 ? batTexts : bwlText);
        
        const secondElement = firstElement === batTexts ? bwlText : batTexts;
          // Case 2: Teams split between bat-txt and bwl-txt
          match.teamA = firstElement.find('.cb-hmscg-tm-nm').text().trim();
          match.teamB = secondElement.find('.cb-hmscg-tm-nm').text().trim();
          match.scoreA = firstElement.find('.cb-ovr-flo').eq(1).text().trim();
          match.scoreB = secondElement.find('.cb-ovr-flo').eq(1).text().trim();
        }
        
        // Get match status/result
        match.status = scoreBlock.find('.cb-text-live').text() || 
                       scoreBlock.find('.cb-text-complete').text() ||
                       scoreBlock.find('.cb-text-preview').text();
  
        // Add flags to match details using full team names
        match.flagA = teamFlags[teamAName] || teamFlags["Default"];;
        match.flagB = teamFlags[teamBName] || teamFlags["Default"];;
  
        // Get match links
        const links = $(element).find('nav a');
        match.links = {};
        links.each((i, link) => {
          const text = $(link).text().toLowerCase()?.replace(/\s+/g, '');
          const href = 'https://www.cricbuzz.com' + $(link).attr('href');
          match.links[text] = href;
        });
  
        if(match.title) { // Only add if match has a title
          matchDetails.push(match);
        }
      });
  
      res.status(200).send(matchDetails);
    } catch (error) {
      console.error('Error fetching live matches:', error);
      res.status(500).send({ error: 'Failed to fetch live matches' });
    }

    
  },

  getUpcomingMatches : async (req, res) => {
    try {
      const response = await axios.get('https://www.cricbuzz.com/cricket-match/live-scores/upcoming-matches');
      const html = response.data;
      const $ = cheerio.load(html);
  
      // Load team flags from JSON file
      const teamFlagsPath = path.join(__dirname, '..', 'team_flags.json');
      const teamFlags = JSON.parse(fs.readFileSync(teamFlagsPath, 'utf8'));
  
      const matchDetails = [];
  
      $('.cb-mtch-lst').each((index, element) => {
        const match = {};
        
        // Get match header info
        const header = $(element).find('.cb-col-100.cb-col.cb-schdl.cb-billing-plans-text');
        match.title = header.find('.text-hvr-underline').text().trim();
        match.series = header.closest('.cb-col.cb-col-100.cb-plyr-tbody').find('.cb-lv-grn-strip a').text().trim();
        
        // Extract match info and time
        const matchInfo = header.find('.text-gray').text().trim();
        const timeMatch = matchInfo.match(/(\d{1,2}:\d{2} [APM]{2})/);
        match.matchInfo = matchInfo;
        match.time = timeMatch ? timeMatch[0] : '';

        // Extract team names from title
        const teams = match.title.split(' vs ');
        const teamAName = teams[0].trim();
        const teamBName = teams[1]?.replace(',', '').trim();
  
        // Get match scores
        const scoreBlock = $(element).find('.cb-scr-wll-chvrn');
        const batTexts = scoreBlock.find('.cb-hmscg-bat-txt');
        const bwlText = scoreBlock.find('.cb-hmscg-bwl-txt');
        
        // Handle both cases: two bat-txt elements or bat-txt + bwl-txt
        if (batTexts.length === 2) {
          // Case 1: Both teams are in bat-txt
          match.teamA = $(batTexts[0]).find('.cb-hmscg-tm-nm').text().trim();
          match.teamB = $(batTexts[1]).find('.cb-hmscg-tm-nm').text().trim();
          match.scoreA = $(batTexts[0]).find('.cb-ovr-flo').eq(1).text().trim();
          match.scoreB = $(batTexts[1]).find('.cb-ovr-flo').eq(1).text().trim();
        } else {
          // Case 2: Teams split between bat-txt and bwl-txt
          const firstElement = batTexts.length > 0 && bwlText.length > 0 
          ? (batTexts[0].startIndex < bwlText[0].startIndex ? batTexts : bwlText)
          : (batTexts.length > 0 ? batTexts : bwlText);
        
        const secondElement = firstElement === batTexts ? bwlText : batTexts;
          // Case 2: Teams split between bat-txt and bwl-txt
          match.teamA = firstElement.find('.cb-hmscg-tm-nm').text().trim();
          match.teamB = secondElement.find('.cb-hmscg-tm-nm').text().trim();
          match.scoreA = firstElement.find('.cb-ovr-flo').eq(1).text().trim();
          match.scoreB = secondElement.find('.cb-ovr-flo').eq(1).text().trim();
        }
        
        // Get match status/result
        match.status = scoreBlock.find('.cb-text-live').text() || 
                       scoreBlock.find('.cb-text-complete').text() ||
                       scoreBlock.find('.cb-text-preview').text();
  
        // Add flags to match details using full team names
        match.flagA = teamFlags[teamAName] || teamFlags["Default"];;
        match.flagB = teamFlags[teamBName] || teamFlags["Default"];;
  
        // Get match links
        const links = $(element).find('nav a');
        match.links = {};
        links.each((i, link) => {
          const text = $(link).text().toLowerCase()?.replace(/\s+/g, '');
          const href = 'https://www.cricbuzz.com' + $(link).attr('href');
          match.links[text] = href;
        });
  
        if(match.title) { // Only add if match has a title
          matchDetails.push(match);
        }
      });
  
      res.status(200).send(matchDetails);
    } catch (error) {
      console.error('Error fetching live matches:', error);
      res.status(500).send({ error: 'Failed to fetch live matches' });
    }
    
  }



};

module.exports = MatchDataController;
