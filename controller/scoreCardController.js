const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { getBrowser } = require('../utils/browserManager');
const { autoScroll } = require('../utils/scrollHelper');
const { setupPage } = require('../utils/puppeteerHelper');


const scoreCardController = {
    getScoreCard: async (req, res) => {
        try {
            const scoreCardUrl = req.query.url;
            // Convert full-scorecard URL to playing-xi URL
            const playingXIUrl = scoreCardUrl.replace('full-scorecard', 'match-playing-xi');
            console.log(playingXIUrl);
            const browser = await getBrowser();
            
            // Fetch scorecard data
            const scorecardPage = await setupPage(browser, scoreCardUrl);
            const scorecardHtml = await scorecardPage.content();
            await scorecardPage.close();
            
            // Fetch playing XI data
            const playingXIPage = await setupPage(browser, playingXIUrl);
            const playingXIHtml = await playingXIPage.content();
            await autoScroll(playingXIPage);
            await playingXIPage.close();
            
            // Load both HTML contents
            const $scorecard = cheerio.load(scorecardHtml);
            const $playingXI = cheerio.load(playingXIHtml);
            
            const matchData = {
                innings: [],
                playingXI: {
                    team1: {
                        name: '',
                        players: []
                    },
                    team2: {
                        name: '',
                        players: []
                    }
                }
            };

            // Extract playing XI data
            $playingXI('.ds-rounded-xl').first().find('.ds-w-full.ds-table').each((index, table) => {
                const teamHeader = $playingXI(table).find('thead th').eq(1).text().trim();
                const currentTeam = index === 0 ? 'team1' : 'team2';
                
                matchData.playingXI[currentTeam].name = teamHeader;
                
                $playingXI(table).find('tbody tr').each((_, tr) => {
                    const playerName = $playingXI(tr).find('td').eq(1).find('a').text().trim();
                    const playerRole = $playingXI(tr).find('td').eq(1).find('p').text().trim();
                    const isWicketkeeper = playerName.includes('†');
                    const isCaptain = playerName.includes('(c)');
                    
                    if (playerName) {
                        const player = {
                            name: playerName.replace('†', '').replace('(c)', '').trim(),
                            role: playerRole || '',
                            isWicketkeeper: isWicketkeeper,
                            isCaptain: isCaptain
                        };
                        
                        matchData.playingXI[currentTeam].players.push(player);
                    }
                });
            });

            // Process each innings table pair (batting + bowling)
            $scorecard('.ds-rounded-lg').each((inningIndex, inningSection) => {
                const inningData = {
                    batting: {
                        players: [],
                        extras: {},
                        total: {},
                        fow: ''
                    },
                    bowling: []
                };

                // Get batting data
                $scorecard(inningSection).find('.ci-scorecard-table').each((_, table) => {
                    // Get batting rows
                    $scorecard(table).find('tbody tr').each((_, tr) => {
                        if ($scorecard(tr).hasClass('ds-hidden')) return;
                        
                        const firstCol = $scorecard(tr).find('td').first().text().trim();
                        
                        // Handle regular batting rows
                        if ($scorecard(tr).find('td').length > 2 && !firstCol.includes('Extras') && !firstCol.includes('TOTAL')) {
                            const player = {
                                name: $scorecard(tr).find('td a').first().text().trim(),
                                status: $scorecard(tr).find('td').eq(1).text().trim(),
                                runs: $scorecard(tr).find('td').eq(2).text().trim(),
                                balls: $scorecard(tr).find('td').eq(3).text().trim(),
                                minutes: $scorecard(tr).find('td').eq(4).text().trim(),
                                fours: $scorecard(tr).find('td').eq(5).text().trim(),
                                sixes: $scorecard(tr).find('td').eq(6).text().trim(),
                                strikeRate: $scorecard(tr).find('td').eq(7).text().trim()
                            };
                            if (player.name) {
                                inningData.batting.players.push(player);
                            }
                        }
                        
                        // Handle extras
                        if (firstCol === 'Extras') {
                            inningData.batting.extras = {
                                details: $scorecard(tr).find('td').eq(1).text().trim(),
                                runs: $scorecard(tr).find('td').eq(2).text().trim()
                            };
                        }
                        
                        // Handle total
                        if (firstCol === 'Total') {
                            inningData.batting.total = {
                                overs: $scorecard(tr).find('td').eq(1).text().trim(),
                                runs: $scorecard(tr).find('td').eq(2).text().trim(),
                                runRate: $scorecard(tr).find('td').eq(1).text().trim().match(/RR: ([\d.]+)/)?.[1] || ''
                            };
                        }
                    });

                    // Get fall of wickets
                    const fowText = $scorecard(table).find('td[colspan] strong:contains("Fall of wickets:")').parent().text().trim();
                    if (fowText) {
                        inningData.batting.fow = fowText;
                    }
                });

                // Get bowling data
                $scorecard(inningSection).find('table').not('.ci-scorecard-table').each((_, table) => {
                    $scorecard(table).find('tbody tr').each((_, tr) => {
                        if ($scorecard(tr).hasClass('ds-hidden')) return;
                        
                        const bowler = {
                            name: $scorecard(tr).find('td a').first().text().trim(),
                            overs: $scorecard(tr).find('td').eq(1).text().trim(),
                            maidens: $scorecard(tr).find('td').eq(2).text().trim(),
                            runs: $scorecard(tr).find('td').eq(3).text().trim(),
                            wickets: $scorecard(tr).find('td').eq(4).text().trim(),
                            economy: $scorecard(tr).find('td').eq(5).text().trim(),
                            wides: $scorecard(tr).find('td').eq(9).text().trim(),
                            noBalls: $scorecard(tr).find('td').eq(10).text().trim()
                        };
                        
                        if (bowler.name) {
                            inningData.bowling.push(bowler);
                        }
                    });
                });

                if (inningData.batting.players.length > 0 || inningData.bowling.length > 0) {
                    matchData.innings.push(inningData);
                }
            });

            // Add match details
            const matchDetails = {
                venue: $scorecard('a[href*="/cricket-grounds"]').find('span').text().trim() || $scorecard('a[href*="/cricket-grounds"]').text().trim(),
                toss: $scorecard('td:contains("Toss")').next().text().trim(),
                series: $scorecard('td:contains("Series")').next().find('a').map((_, el) => $scorecard(el).text().trim()).get(),
                season: $scorecard('td:contains("Season")').next().text().trim(),
                matchNumber: $scorecard('td:contains("Match number")').next().text().trim(),
                hoursOfPlay: $scorecard('td:contains("Hours of play")').next().text().trim(),
                matchDays: $scorecard('td:contains("Match days")').next().text().trim(),
                umpires: $scorecard('td:contains("Umpires")').next().find('a').map((_, el) => $scorecard(el).text().trim()).get(),
                tvUmpire: $scorecard('td:contains("TV Umpire")').next().find('a').text().trim(),
                reserveUmpire: $scorecard('td:contains("Reserve Umpire")').next().find('a').text().trim(),
                matchReferee: $scorecard('td:contains("Match Referee")').next().find('a').text().trim()
            };


            const resultHeader = $scorecard('strong.ds-uppercase.ds-text-tight-m').first().text().trim(); // Match result header
            const matchDetail = $scorecard('div.ds-text-tight-m.ds-font-regular.ds-text-typo-mid3').text().trim(); // Match details
            const teams = [];
            const scores = [];
    
            // Extract team names and scores
            $scorecard('div.ci-team-score').each((index, element) => {
                const teamName = $scorecard(element).find('.ds-text-tight-l').first().text().trim();
                const teamScore = $scorecard(element).find('.ds-text-compact-m').first().text().trim();
                const teamFlag = $scorecard(element).find('img').data('src') || $scorecard(element).find('img').attr('src')

        
                if(teamName && teamScore){
                    teams.push({ name: teamName, score: teamScore, flag: teamFlag });}
            });
    
            const status = $scorecard('p.ds-text-tight-s.ds-font-medium.ds-truncate.ds-text-typo').text().trim(); // Match winner
    
  

            summary={
                "teams_data":teams,
                "status":status,
                "matchDetail":matchDetail,
                "state":resultHeader
            }

            // Combine all data
            const finalData = {
                summary,
                innings: matchData.innings,
                matchDetails,
                playingXI: matchData.playingXI
            };

            res.status(200).json(finalData);

        } catch (error) {
            console.error('Error fetching scorecard:', error);
            res.status(500).send('Internal Server Error');
        }
    }
};

module.exports = scoreCardController;
