const axios = require('axios');
const cheerio = require('cheerio');


const parseInningsData = (inningsData) => {
    let inningsBat = [];
    let inningsBowl = [];
    let breakPointInnings = 0;

    for (let i = 0; i < inningsData.length; i += 8) {
        if (inningsData[i].includes("Bowler") || inningsData[i].includes("Extras") || inningsData[i].includes(" Yet to Bat ")) {
            break;
        } else {
            inningsBat.push([
                inningsData[i],
                inningsData[i + 1],
                inningsData[i + 2],
                inningsData[i + 3],
                inningsData[i + 4],
                inningsData[i + 5],
                inningsData[i + 6],
                inningsData[i + 7],
            ]);
        }
    }

    inningsData = inningsData.filter((item) => item.trim() !== "");

    for (let i = 0; i < inningsData.length; i++) {
        if (inningsData[i] === "Bowler") {
            breakPointInnings = i;
            break;
        }
    }

    for (let i = breakPointInnings; i < inningsData.length; i += 8) {
        inningsBowl.push([
            inningsData[i],
            inningsData[i + 1],
            inningsData[i + 2],
            inningsData[i + 3],
            inningsData[i + 4],
            inningsData[i + 5],
            inningsData[i + 6],
            inningsData[i + 7],
        ]);
    }

    return {batting: inningsBat, bowling: inningsBowl};
}


const scoreCardController = {
    getScoreCard: async (req, res) => {
        try {
            const url = req.params.url;
            const id = req.params.id;
            const tour = req.params.tour;
            const scorecard = req.params.scorecard;
            const match = req.params.match;

            const links = [`https://www.cricketworld.com/${url}/${tour}/${match}/${scorecard}/${id}`];
            const response = await axios.get(links[0]);
            const html = response.data;
            const $ = cheerio.load(html);

            if (scorecard == "scorecard") {

                let headings = [];
                let battingData = [];
                let bowlingData = [];
                let mainData = [];
                let extras = [];


                $('div.accordion.inning-scorecard').each((index, element) => {
                    const teamLogo = $(element).find('.team-logo img').attr('src');
                    const inningHeading = $(element).find('.inning-name .hide-mobile').text();
                    const scores = $(element).find('.scores_full').text();

                    headings.push({teamLogo: teamLogo, inningHeading: inningHeading, scores: scores});

                    $(element).find('.table1 tr').each((index, element) => {
                        if (index === 0) 
                            return;
                         // Skip the header row
                        const rowData = $(element).find('td').map((i, el) => $(el).text().trim()).get();
                        if (rowData.length >= 7) {
                            battingData.push(rowData);
                        } else if (rowData.length >= 6) {
                            bowlingData.push(rowData);
                        }
                        if (rowData.length == 2) {
                            extras.push(rowData);
                        }

                    });
                    const fow = $(element).find('.fows').text().trim();

                    mainData.push([{
                            headings: headings,
                            battingData: battingData,
                            bowlingData: bowlingData,
                            extras: extras,
                            fow: fow
                        }]);
                    headings = [];
                    battingData = [];
                    bowlingData = [];
                    extras = [];

                });

                res.send(mainData)

            } else if (scorecard == "commentary") {
              let headings=[];
              let comm=[];
              let Innings=[];
              let numericData = [];

              $('div.accordions.innings-container').each((index, element) => {
                const teamLogo = $(element).find('.team-logo img').attr('src');
                const inningHeading = $(element).find('.inning-name .hide-mobile').text();
                const scores = $(element).find('.scores_full').text();
              
                headings.push({ teamLogo: teamLogo, inningHeading: inningHeading, scores: scores });
              
                $(element).find('.comment').each((subIndex, subElement) => {
                  const score = $(subElement).find('.score').text();
                  const runs = $(subElement).find('.ovb').text().trim();
                  const text = $(subElement).find('.text').text().trim();
                  if(score != "")
                  {
                    comm.push({ score: score, runs: runs, text: text });
                  }
                  else
                  {
                    const endoverDiv1 = $(subElement).find('.col-xs-12:eq(0) .endover').text();
                    const batsmanDivs = $(subElement).find('.col-xs-12:eq(0) .batsman');
                    const batsmanData = batsmanDivs.toArray().map((element) => $(element).text());

                    // Extracting data from the second col-xs-12 element
                    const endoverDiv2 = $(subElement).find('.col-xs-12:eq(1) .endover').text();
                    const bowlerDivs = $(subElement).find('.col-xs-12:eq(1) .bowler');
                    const bowlerData = bowlerDivs.toArray().map((element) => $(element).text());

                    comm.push({batsmanData,bowlerData,endoverDiv1,endoverDiv2})
                    const runs = endoverDiv1.substring(endoverDiv1.indexOf('(') + 1, endoverDiv1.indexOf(')'));
                    if(runs != "")
                    {
                      numericData.push(runs);
                    }
                  }
                });
                Innings.push({headings: headings,comm:comm})
                headings=[]
                comm=[]
              });
              
              res.send({numericData,Innings});
              
            }
            else if(scorecard == 'players')
            {
              const teamA=[];
              const teamB=[];

            // Scraping team A players
            $('#teama-players ul.list1 li a').each((index, element) => {
              const playerName = $(element).find('.player-name').text();

              teamA.push({ name: playerName});
            });

            // Scraping team B players
            $('#teamb-players ul.list1 li a').each((index, element) => {
              const playerName = $(element).find('.player-name').text();

              teamB.push({ name: playerName});
            });
            
            res.send({teamA: teamA, teamB: teamB})
            }
            


        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    }
};

module.exports = scoreCardController;
