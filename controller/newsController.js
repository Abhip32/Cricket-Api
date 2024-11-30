const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { getBrowser } = require('../utils/browserManager');
const { autoScroll } = require('../utils/scrollHelper');


const newsController = {
  getNews: async (req, res) => {
    try {
      const browser = await getBrowser();
      const page = await browser.newPage();

      // Block unnecessary resources except images and scripts
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media') {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Set viewport and user agent
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      await page.goto('https://www.espncricinfo.com/cricket-news', {
        waitUntil: 'networkidle2',
        timeout: 0
      });

      // Scroll to load all content
      await autoScroll(page);
      await page.waitForSelector('img[src*="hscicdn"]', { timeout: 5000 }).catch(() => { });
      // Get page content after scrolling
      const content = await page.content();
      const $ = cheerio.load(content);

      const newsItems = [];
      $('.ds-border-b.ds-border-line').each((i, element) => {
        const headline = $(element).find('.ds-text-title-s').text().trim();
        const link = $(element).find('a').attr('href');
        
        const image = $(element).find('img').attr('src')?.replace('f_auto,t_ds_square_w_160,q_50/', '');
        
        const timeElement = $(element).find('.ds-text-compact-xs').first().text().trim();
        const authorElement = $(element).find('.ds-text-compact-xs').last().text().trim();
        const timeAndAuthor = `${timeElement} • ${authorElement}`;

        newsItems.push({
          headline,
          link,
          image,
          timeAndAuthor
        });
      });

      await browser.close();
      res.status(200).json(newsItems);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: 'Failed to fetch news' });
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
  },
  getNewsS: async (req, res) => {
    try {
      const response = await axios.get('https://www.cricketlineguru.com/cricket-news');
      const html = response.data;
      const $ = cheerio.load(html);

      const news = $('div.item.small-card');
      const newsItems = [];
      news.each((index, element) => {
        const data = {};
        data.image = $(element).find('figure').find('img').attr('src');
        data.text = $(element).find('.card-text').find('a').text();
        data.info = $(element).find('.info.ng-star-inserted').text();
        data.content = $(element).find('.content.ng-star-inserted').text();
        newsItems.push(data);

      })


      res.status(200).json(newsItems);
    } catch (error) {
      console.log(error);
    }
  },

  getVideos: async (req, res) => {
    try {
      const response = await axios.get('https://www.cricketlineguru.com/cricket-videos');
      const html = response.data;
      const $ = cheerio.load(html);

      const news = $('div.item.small-card');
      const newsItems = [];
      news.each((index, element) => {
        const data = {};
        data.image = $(element).find('figure').find('img').attr('src');
        data.link = $(element).find('figure').find('a').attr('href');
        data.text = $(element).find('.card-text').find('a').text();
        data.info = $(element).find('.info.ng-star-inserted').text();
        data.content = $(element).find('.content.ng-star-inserted').text();
        newsItems.push(data);

      })


      res.status(200).json(newsItems);
    } catch (error) {
      console.log(error);
    }
  },
  getPlayer: async (req, res) => {
    const name = req.params.name;
    const modifiedName = name.toLowerCase().replace(/ /g, '_');
    const query = 'https://www.cricketlineguru.com/cricket-players/' + modifiedName + '/details'
    console.log(query);
    try {
      const response = await axios.get(query);
      const html = response.data;
      const $ = cheerio.load(html);
      const data = {};
      data.name = $('.clg-col.clg-col-80.clg-player-name-wrap').find('h1').text();
      data.image = $('.clg-col.clg-col-20.clg-col-rt').find('img').attr('src');

      var tablesData = [];
      var test=[]
      var odi=[];
      var t20=[];
      var ipl=[];
    $('table').each(function(index, table) {
        var rowData = [];
        $(table).find('td').each(function() {
            rowData.push($(this).text());
        });
        tablesData.push(rowData);
    });

data.tablesData=tablesData;
const carrer={}
$('.clg-col.clg-col-40.text-bold.clg-lst-itm-sm-ci').each(function(index, element) {
  var heading = $(this).text().trim();
  var value = $(this).next('.clg-col.clg-col-60.clg-lst-itm-sm-ci').text().trim();
  
  carrer[heading] = value;
});
data.carrer=carrer;

const personal={}
// Personal Information
$('.clg-hm-rght').find('.clg-col.clg-col-40.text-bold.clg-lst-itm-sm').each(function(index, element) {
  var key = $(this).text().trim();
  var value = $(this).next('.clg-col.clg-col-60.clg-lst-itm-sm').text().trim();
  personal[key] = value;
});


data.personal=personal;
data.about=$('.clg-col.clg-col-100.clg-ttl-vts p').text().trim();

      res.status(200).json(data);
    } catch (error) {
      console.log(error);
    }


  }
}


const fetchNewsData = async (url) => {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const newsData = [];
    const newsItems = $('.cb-col.cb-col-100.cb-lst-itm.cb-pos-rel.cb-lst-itm-lg', html).slice(0, 5);
    newsItems.each(function () {
      const nlink = [];
      let i = 0;
      $(this).find('a').each(function () {
        if (i === 0) {
          nlink.push($(this).attr('href').trim());
          i++;
        }
      });

      const nimg = [];
      $(this).find('img').each(function () {
        let text = $(this).attr('src');
        const text1 = text.replace("205x152", "595x396");
        nimg.push(text1);
      });

      const nhead = [];
      $(this).find('.cb-nws-hdln-ancr.text-hvr-underline').each(function () {
        nhead.push($(this).text().trim());
      });

      const ninter = [];
      $(this).find('.cb-nws-intr').each(function () {
        ninter.push($(this).text().trim());
      });

      const tit = [];
      $(this).find('.cb-nws-time').each(function () {
        tit.push($(this).text().trim());
      });

      newsData.push({ tit: tit, Links: nlink, Images: nimg, Headline: nhead, Content: ninter });
    });

    return newsData;
  } catch (error) {
    console.log(error);
    return [];
  }

  
};


module.exports = newsController;