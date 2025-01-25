const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');



const newsController = {
  getNews: async (req, res) => {
    try {
      const newsItems = await fetchNewsData('https://www.cricbuzz.com/cricket-news/latest-news')
  
      const top5News = newsItems.slice(0, 5);
      res.status(200).json(top5News);
    } catch (error) {
      console.log(error);
    }
  },
  
  getNewsPlus: async (req, res) => {
    try {
  
      const newsItems =await fetchNewsData('https://www.cricbuzz.com/cricket-news/editorial/cb-plus')
  
      res.status(200).json(newsItems);
    } catch (error) {
      console.log(error);
    }
  },
  
  getSpotlight: async (req, res) => {
    try {
      const newsItems =await fetchNewsData('https://www.cricbuzz.com/cricket-news/editorial/spotlight')
  
      res.status(200).json(newsItems);
    } catch (error) {
      console.log(error);
    }
  },
  
  getOpinions: async (req, res) => {
    try {
      const newsItems =await fetchNewsData('https://www.cricbuzz.com/cricket-news/editorial/editorial-list')
  
  
      res.status(200).json(newsItems);
    } catch (error) {
      console.log(error);
    }
  },
    
  getSpecials :async (req, res) => {
    const url = 'https://www.cricbuzz.com/cricket-news/editorial/specials';
    const specialsData = await fetchNewsData(url);
    res.status(200).json(specialsData);
  },
  
  getStats : async (req, res) => {
    const url = 'https://www.cricbuzz.com/cricket-news/editorial/stats-analysis';
    const statsData = await fetchNewsData(url);
    res.status(200).json(statsData);
  },
  
    getInterviews : async (req, res) => {
    const url = 'https://www.cricbuzz.com/cricket-news/editorial/interviews';
    const interviewsData = await fetchNewsData(url);
    res.status(200).json(interviewsData);
  }
}


const fetchNewsData = async (url) => {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const newsData = [];
    const newsItems = $('.cb-col.cb-col-100.cb-lst-itm.cb-pos-rel.cb-lst-itm-lg', html);
    newsItems.each(function () {
      const news_link = $(this).find('a').attr('href').trim();
      const news_img = $(this).find('img')?.attr('src')?.replace('205x152','500x500');
      const news_headline = $(this).find('.cb-nws-hdln-ancr.text-hvr-underline').text().trim();
      const news_content= $(this).find('.cb-nws-intr').text().trim();
      const news_title = $(this).find('.cb-nws-time').first().text().trim();

      newsData.push({ news_title, news_link,news_img, news_headline, news_content });
    });

    return newsData;
  } catch (error) {
    console.log(error);
    return [];
  }
};


module.exports = newsController;