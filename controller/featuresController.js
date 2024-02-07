const axios = require('axios');
const cheerio   = require('cheerio');

const featuresController ={
    onThisDay:async (req,res)=>{
    try {
        const response = await axios.get('https://www.cricketworld.com/features/on-this-day/');
        const html = response.data;
        const $ = cheerio.load(html);
        let data = [];

        $('.col-md-12col.img-left.link').each((index, element) => {
            const imgSrc = "https:" + $(element).find('img').attr('data-src');
            const newsTitle = $(element).find('h2 a').text();
            const newsDescription = $(element).find('p').text();

            data.push({
                imgSrc,
                newsTitle,
                newsDescription
            });
        });

        res.send(data);
      } catch (error) {
        console.log(error);
        return [];
    }
    },

    ICCnews:async (req,res)=>{
      try {
        const response = await axios.get('https://www.cricketworld.com/icc-news/');
        const html = response.data;
        const $ = cheerio.load(html);
        let mainNews = [];
        let moreNews = [];

        $('.col-md-12col.img-left.link').each((index, element) => {
          const title = $(element).find('h2 a').text();
          const imageUrl = "https:" + $(element).find('img').attr('data-src');
          const link = "https://www.cricketworld.com" + $(element).find('a').attr('href');
          const description = $(element).find('p').text();
      
          mainNews.push({
              title,
              imageUrl,
              link,
              description
          });
      });

        $('.col.link.img-top').each((index, element) => {
            const title = $(element).find('h2 a').text();
            const Image = "https:" + $(element).find('img').attr('data-src');
            const link = "https://www.cricketworld.com" + $(element).find('a').attr('href');
              
            moreNews.push({ title, Image, link });
        });
        
        res.send({ mainNews, moreNews });
    } catch (error) {
        console.log(error);
        return { mainNews: [], moreNews: [] };
    }
    },

    Stats_Facts:async(req,res)=>{
            try {
                const response = await axios.get('https://www.cricketworld.com/cricket-stats-and-facts/');
                const html = response.data;
                const $ = cheerio.load(html);
                let mainNews=[]
                let moreNews=[]
              
    
                $('.col-md-12col.img-left.link').each((index, element) => {
                  const title = $(element).find('h2 a').text();
                  const Image = "https:"+$(element).find('img').attr('data-src');
                  const link = "https://www.cricketworld.com"+$(element).find('a').attr('href');
                  const description = $(element).find('p').text();
                
                  mainNews.push({ title,Image, link, description });
                });
    
                $('.col.link.img-top').each((index, element) => {
                    const title = $(element).find('h2 a').text();
                    const Image = "https:"+$(element).find('img').attr('data-src');
                    const link = "https://www.cricketworld.com"+$(element).find('a').attr('href')
                  
                    moreNews.push({ title, Image,link });
                  });
                res.send({mainNews:mainNews,moreNews:moreNews});
          
              } catch (error) {
                console.log(error);
              }
        },

        POTM:async(req,res)=>{
            try {
                const response = await axios.get('https://www.cricketworld.com/player-of-the-week/');
                const html = response.data;
                const $ = cheerio.load(html);
                const playerOfTheWeek = [];

                $('.col.link.img-top').each((index, element) => {
                  const title = $(element).find('h2 a').text().trim();
                  const imageSrc = "https:"+$(element).find('img').attr('data-src');
                  const description = $(element).find('p').text().trim();
              
                  playerOfTheWeek.push({
                    title,
                    imageSrc,
                    description,
                  });
                });
            
                res.send({playerOfTheWeek});
              } catch (error) {
                console.log(error);
              }
        }
    
}

module.exports = featuresController