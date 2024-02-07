const axios = require('axios');
const cheerio = require('cheerio');

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

  getPhotos: async (req, res) => {
    const page=req.params.page;
    let tab='';
    if(page == 1 || page ==0)
    { 
        tab=''
    }
    else
    {
      tab='&p='+page
    }
    try {
      const response = await axios.get('https://www.cricketworld.com/cricket-photos/'+tab);
      const html = response.data;
      const $ = cheerio.load(html);

      const photos = [];
      
      $('.col-md-2.col-xs-12', html).each(function () {
        const img = "	https:" + $(this).find('a').attr('href').trim();
        const title = $(this).find('.text').text().trim();

        if(!img.includes('undefined'))
        {
            photos.push({
                img: img.replace(/\t/g, '').replace(/\\/g,''),
                title: title
              });
        }
      });


      res.status(200).json(photos);
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
  
}

module.exports=newsController;