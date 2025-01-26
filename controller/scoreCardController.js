const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const formatUrl =(url) => {
    return "https://cricbuzz.com"+url+"/"
}

const scoreCardController = {
    getScoreCard: async (req, res) => {
        try {
            const url = formatUrl(req.query.url)
    
            const response = await axios.get(url);
            const $ = cheerio.load(response.data);
            
            const matchData = {
                matchStatus: $('.cb-scrcrd-status').text().trim(),
                innings: []
            };

            // Process each innings
            $('div[id^="innings_"]').each((inningIndex, inningElement) => {
                const inning = {
                    header: $(inningElement).find('.cb-scrd-hdr-rw').text().trim(),
                    batting: [],
                    extras: {},
                    total: {},
                    fallOfWickets: [],
                    bowling: []
                };

                // Process batting
                $(inningElement).find('.cb-scrd-itms').each((i, element) => {
                    const cols = $(element).find('.cb-col');
                    
                    // Skip if this is extras or total row
                    if ($(element).find('.cb-col-60').length === 0) {
                        const batter = {
                            name: $(element).find('.cb-col-25 a').text().trim(),
                            dismissal: $(element).find('.cb-col-33 span').text().trim(),
                            runs: $(element).find('.cb-col-8.text-right.text-bold').first().text().trim(),
                            balls: $(cols).eq(3).text().trim(),
                            fours: $(cols).eq(4).text().trim(),
                            sixes: $(cols).eq(5).text().trim(),
                            strikeRate: $(cols).eq(6).text().trim()
                        };
                        if (batter.name!="" && batter.dismissal!="")
                        {
                            inning.batting.push(batter);
                        }
     
                    }
                });

                // Process extras
                const extrasRow = $(inningElement).find('.cb-scrd-itms').filter((i, el) => 
                    $(el).text().includes('Extras')).first();
                if (extrasRow.length) {
                    inning.extras = {
                        total: extrasRow.find('.text-bold').text().trim(),
                        details: extrasRow.find('.cb-col-32').text().trim()
                    };
                }

                // Process total
                const totalRow = $(inningElement).find('.cb-scrd-itms').filter((i, el) => 
                    $(el).text().includes('Total')).first();
                if (totalRow.length) {
                    inning.total = {
                        runs: totalRow.find('.text-bold').text().trim(),
                        details: totalRow.find('.cb-col-32').text().trim()
                    };
                }

                // Process fall of wickets
                const fowText = $(inningElement).find('.cb-col-rt.cb-font-13').text();
                inning.fallOfWickets = fowText.split(',').map(fow => fow.trim());

                // Process bowling
                $(inningElement).find('.cb-ltst-wgt-hdr').find('.cb-scrd-itms').each((i, element) => {
                    const bowler = {
                        name: $(element).find('.cb-col-38 a').text().trim(),
                        overs: $(element).find('.cb-col-8').eq(0).text().trim(),
                        maidens: $(element).find('.cb-col-8').eq(1).text().trim(),
                        runs: $(element).find('.cb-col-10').first().text().trim(),
                        wickets: $(element).find('.cb-col-8.text-bold').text().trim(),
                        noBalls: $(element).find('.cb-col-8').eq(4).text().trim(),
                        wides: $(element).find('.cb-col-8').eq(5).text().trim(),
                        economy: $(element).find('.cb-col-10').last().text().trim()
                    };
                    if (bowler.name !== "" && bowler.name !== undefined){
                    inning.bowling.push(bowler);}
                });

                matchData.innings.push(inning);
            });

            // Process match info
            const matchInfo = {
                details: {}
            };
            
            $('.cb-mtch-info-itm').each((i, element) => {
                const label = $(element).find('.cb-col-27').text().trim();
                const value = $(element).find('.cb-col-73').text().trim();
                matchInfo.details[label] = value;
            });

            // Fetch news data
            const newsUrl = url.replace('live-cricket-scorecard', 'cricket-match-news');
            const newsResponse = await axios.get(newsUrl);
            const news$ = cheerio.load(newsResponse.data);

            // Process news
            const news = [];
            news$('#match-news-list .cb-lst-itm').each((i, element) => {
                const imageData = news$(element).find('.cb-col-33 img');
                const contentData = news$(element).find('.cb-nws-lst-rt');
                
                // Skip if it's an ad (checking for native_news_list parent)
                if (!news$(element).parent().attr('id')?.includes('native_news')) {
                    const newsItem = {
                        image: {
                            url: imageData.attr('src') || '',
                            alt: imageData.attr('alt') || '',
                            title: imageData.attr('title') || ''
                        },
                        category: contentData.find('.cb-nws-time').first().text().trim(),
                        headline: contentData.find('.cb-nws-hdln a').text().trim(),
                        link: contentData.find('.cb-nws-hdln a').attr('href') || '',
                        summary: contentData.find('.cb-nws-intr').text().trim(),
                        date: contentData.find('.cb-nws-time').last().text().trim()
                    };
                    
                    news.push(newsItem);
                }
            });

            matchData.news = news;

            matchData.matchInfo = matchInfo;

            res.status(200).json(matchData);
        } catch (error) {
            console.error('Error scraping scorecard:', error);
            res.status(500).send('Internal Server Error');
        }
    },

    getSquads: async (req, res) => {
        try {
            const url = formatUrl(req.query.url)
            const squadsUrl = url.replace('live-cricket-scorecard', 'cricket-match-squads');
            const squadsResponse = await axios.get(squadsUrl);
            const squads$ = cheerio.load(squadsResponse.data);
            const team1= squads$('.cb-team1').text().trim()
            const flag1= squads$('.cb-team1 img').attr('src') || ''
            const team2= squads$('.cb-team2').text().trim()
            const flag2= squads$('.cb-team2 img').attr('src') || ''
            const squads = {
                team1: {name:team1,flag:flag1,players:[]},
                team2: {name:team2,flag:flag2,players:[]}
            };

            squads$('.cb-play11-lft-col .cb-player-card-left').each((i, element) => {
                const player = {
                    name: squads$(element).find('.cb-player-name-left div').clone().children().remove().end().text().trim(),
                    role: squads$(element).find('.cb-font-12.text-gray').text().trim(),
                    image: squads$(element).find('.cb-plyr-img-left').attr('src') || ''
                };

                if (player.name!="" && player.role!="")
                {
                    squads.team1.players.push(player);
                }
            });

            // Process team 2 players
            squads$('.cb-play11-rt-col .cb-player-card-right').each((i, element) => {
                const player = {
                    name: squads$(element).find('.cb-player-name-right div').clone().children().remove().end().text().trim(),
                    role: squads$(element).find('.cb-font-12.text-gray').text().trim(),
                    image: squads$(element).find('.cb-plyr-img-right').attr('src') || ''
                };
                if (player.name!="" && player.role!="")
                {
                    squads.team2.players.push(player);
                }
            });

            res.status(200).json(squads);
        } catch (error) {
            console.error('Error scraping squads:', error);
            res.status(500).send('Internal Server Error');
        }
    },

    getCommentary: async (req, res) => {
        try {
            const url = formatUrl(req.query.url)
            const commentaryUrl = url.replace('live-cricket-scorecard', 'live-cricket-scores');
            const commentaryResponse = await axios.get(commentaryUrl);
            const commentary$ = cheerio.load(commentaryResponse.data);

            const commentary = [];
            commentary$('.cb-col.cb-col-100').each((i, element) => {
                const over = commentary$(element).find('.cb-ovr-num').text().trim();
                const commentaryText = commentary$(element).find('.cb-com-ln').text().trim();
                
                if (commentaryText && !commentaryText.includes('Plugin:') && over.length<10) {
                    commentary.push({
                        over,
                        text: commentaryText
                    });
                }
            });

            res.status(200).json(commentary);
        } catch (error) {
            console.error('Error scraping commentary:', error);
            res.status(500).send('Internal Server Error');
        }
    },

    getNews: async (req, res) => {
        try {
            const url = formatUrl(req.query.url)
            const newsUrl = url.replace('live-cricket-scorecard', 'cricket-match-news');
            const newsResponse = await axios.get(newsUrl);
            const news$ = cheerio.load(newsResponse.data);

            const news = [];
            news$('#match-news-list .cb-lst-itm').each((i, element) => {
                const imageData = news$(element).find('.cb-col-33 img');
                const contentData = news$(element).find('.cb-nws-lst-rt');
                
                // Skip if it's an ad (checking for native_news_list parent)
                if (!news$(element).parent().attr('id')?.includes('native_news')) {
                    const newsItem = {
                        image: {
                            url: imageData.attr('src') || '',
                            alt: imageData.attr('alt') || '',
                            title: imageData.attr('title') || ''
                        },
                        category: contentData.find('.cb-nws-time').first().text().trim(),
                        headline: contentData.find('.cb-nws-hdln a').text().trim(),
                        link: contentData.find('.cb-nws-hdln a').attr('href') || '',
                        summary: contentData.find('.cb-nws-intr').text().trim(),
                        date: contentData.find('.cb-nws-time').last().text().trim()
                    };
                    
                    news.push(newsItem);
                }
            });

            res.status(200).json(news);
        } catch (error) {
            console.error('Error scraping news:', error);
            res.status(500).send('Internal Server Error');
        }
    },

    getMiniScorecard: async (req, res) => {
        try {
            const url = formatUrl(req.query.url.replace('live-cricket-scorecard', 'live-cricket-scores'))
            const response = await axios.get(url);
            const $ = cheerio.load(response.data);
            const teamFlagsPath = path.join(__dirname, '..', 'team_flags.json');
            const teamFlags = JSON.parse(fs.readFileSync(teamFlagsPath, 'utf8'));

            const matchTitle = $('.cb-nav-hdr.cb-font-18').text().trim();
            const [team1, team2] = matchTitle.split(' vs ').map(team => {
                const teamName = team.split(',')[0].trim();
                const flag=teamFlags[teamName] || teamFlags["Default"];
                
                return {
                    name: teamName,
                    flag:flag
                };
            });
    
            const seriesName = $('.cb-nav-subhdr.cb-font-12 .text-gray').first().text().trim();
            const venue = $('.cb-nav-subhdr.cb-font-12 [itemprop="name"]').text().trim();
            const location = $('.cb-nav-subhdr.cb-font-12 [itemprop="addressLocality"]').text().trim();
            const dateTime = $('.cb-nav-subhdr.cb-font-12 [itemprop="startDate"]').text().trim();
    
            const matchInfo = {
                title: matchTitle,
                series: seriesName,
                venue: `${venue}${location ? ', ' + location : ''}`,
                dateTime,
                teams: {
                    team1,
                    team2
                }
            };

            const miniScorecard = {
                matchInfo,
                batting: {
                    team: '',
                    score: '',
                    currentBatsmen: []
                },
                bowling: {
                    team: '',
                    score: '',
                    currentBowlers: []
                },             
                recentBalls: ''
            };

            // Check if match is complete
            const isComplete = $('.cb-min-comp').length > 0;

            if (isComplete) {
                // Get scores for completed match
                $('.cb-min-tm').each((i, element) => {
                    const score = $(element).text().trim();
                    if (i === 0) {
                        miniScorecard.bowling.score = score;
                        
                    } else if (i === 1) {
                        miniScorecard.batting.score = score;
                    }
                });

                //Get player of the match
                $('.cb-mom-itm').each((i, element) => {
                    const type = $(element).find('.cb-text-gray').text().trim();
                    const playerName = $(element).find('.cb-link-undrln').text().trim();
                    const playerLink = $(element).find('.cb-link-undrln').attr('href');

                    if (type.includes('PLAYER OF THE MATCH')) {
                        miniScorecard.playerOfTheMatch={
                            name: playerName,
                            link: playerLink
                        };
                    } else if (type.includes('PLAYER OF THE SERIES')) {
                        miniScorecard.playerOfTheSeries.push={
                            name: playerName,
                            link: playerLink
                        };
                    }
                });
            } else {
                // Get batting team score
                const battingScore = $('.cb-min-bat-rw').first().text().trim();
                const [battingTeam, score] = battingScore.split(' ').filter(Boolean);
                miniScorecard.batting.team = battingTeam;
                miniScorecard.batting.score = score;

                const bowlingScore = $('.cb-text-gray.cb-font-16').first().text().trim();
                const [bowlingTeam, scoreb] = bowlingScore.split(' ').filter(Boolean);
                miniScorecard.bowling.team = bowlingTeam;
                miniScorecard.bowling.score = scoreb;


                // Get current batsmen
                $('.cb-min-inf').first().find('.cb-min-itm-rw').each((i, element) => {
                    const name = $(element).find('.cb-text-link').text().trim();
                    const runs = $(element).find('.ab').eq(0).text().trim();
                    const balls = $(element).find('.ab').eq(1).text().trim();
                    const fours = $(element).find('.ab').eq(2).text().trim();
                    const sixes = $(element).find('.ab').eq(3).text().trim();
                    const strikeRate = $(element).find('.text-right').last().text().trim();
                    const isOnStrike = $(element).find('span').text().includes('*');

                    if (name) {
                        miniScorecard.batting.currentBatsmen.push({
                            name,
                            runs,
                            balls,
                            fours,
                            sixes,
                            strikeRate,
                            isOnStrike
                        });
                    }
                });

                // Get current bowlers
                $('.cb-min-inf').last().find('.cb-min-itm-rw').each((i, element) => {
                    const name = $(element).find('.cb-text-link').text().trim();
                    const overs = $(element).find('.text-right').eq(0).text().trim();
                    const maidens = $(element).find('.text-right').eq(1).text().trim();
                    const runs = $(element).find('.text-right').eq(2).text().trim();
                    const wickets = $(element).find('.text-right').eq(3).text().trim();
                    const economy = $(element).find('.text-right').last().text().trim();
                    const isBowlingNow = $(element).find('span').text().includes('*');

                    if (name) {
                        miniScorecard.bowling.currentBowlers.push({
                            name,
                            overs,
                            maidens,
                            runs,
                            wickets,
                            economy,
                            isBowlingNow
                        });
                    }
                });

              

                // Get recent balls
                miniScorecard.recentBalls = $('.cb-min-rcnt span').last().text().trim();
                  $('.cb-mom-itm').each((i, element) => {
                    const type = $(element).find('.cb-text-gray').text().trim();
                    const playerName = $(element).find('.cb-link-undrln').text().trim();
                    const playerLink = $(element).find('.cb-link-undrln').attr('href');

                    if (type.includes('PLAYER OF THE MATCH')) {
                        miniScorecard.playerOfTheMatch.push({
                            name: playerName,
                            link: playerLink
                        });
                    } else if (type.includes('PLAYER OF THE SERIES')) {
                        miniScorecard.playerOfTheSeries.push({
                            name: playerName,
                            link: playerLink
                        });
                    }
                });
                // Get toss
                const toss = $('.cb-min-itm-rw').last().text().trim();
                miniScorecard.toss = toss.includes('Toss') ? toss.split('Toss: ')[1] : '';

            }

            res.status(200).json(miniScorecard);
        } catch (error) {
            console.error('Error fetching mini scorecard:', error);
            res.status(500).send('Internal Server Error');
        }
    }
};

module.exports = scoreCardController;
