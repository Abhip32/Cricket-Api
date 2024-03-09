const axios = require('axios');
const cheerio = require('cheerio');



const scoreCardController = {
    getScoreCard: async (req, res) => {
        try {
            const init=req.params.init;
            const id=req.params.id;
            const type=req.params.type;
            const match=req.params.match;
            const matchData={};
            const tablesData=[];
            url="https://www.cricketlineguru.com/"+init+"/"+id+"/"+type+"/"+match;
            const response = await axios.get(url);
            const html = response.data;
            const $ = cheerio.load(html);

            if(type === "match-scorecard")
            {
                $('table').each(function(index, table) {
                    var rowData = [];
                    $(table).find('td').each(function() {
                        rowData.push($(this).text());
                    });
                    tablesData.push(rowData);
                });
                const headings=[];
                $('.mat-expansion-panel-header-title').each(function(index, element) {
                    headings.push($(element).text());
                });
    
                matchData.tables=tablesData;
                matchData.headings=headings;
                res.status(200).send(matchData)
            }

            else if(type === 'info'){
                matchData.series = $('div.row.label-info').find('div.col-sm-7').eq(0).text().trim();
                matchData.matchs = $('div.row.label-info').find('div.col-sm-7').eq(1).text().trim();
                matchData.dateAndTime = $('div.row.label-info').find('div.col-sm-7').eq(2).text().trim();
                matchData.toss = $('div.row.label-info').find('div.col-sm-7').eq(3).text().trim();
                matchData.umpires = $('div.row.label-info').find('div.col-sm-7').eq(4).text().trim();
                matchData.thirdUmpire = $('div.row.label-info').find('div.col-sm-7').eq(5).text().trim();
                matchData.matchReferee = $('div.row.label-info').find('div.col-sm-7').eq(6).text().trim();
     
                matchData.venueStadium = $('div.heading').eq(1).next().next().text().trim();
                matchData.flagA=$('.first-info').find('img').attr('src');
                matchData.teamA=$('.first-info').find('.team-info').text();

                matchData.flagB=$('.second-info').find('img').attr('src');
                matchData.teamB=$('.second-info').find('.team-info').text();

                matchData.venueWeather = $('div.heading').eq(2).next().next().text().trim();
                matchData.temperature = $('div.heading').eq(2).next().next().next().next().text().trim();
                matchData.rainForecast = $('div.heading').eq(2).next().next().next().next().next().next().text().trim();
           

                res.status(200).send(matchData)
            }

            else if(type==='commentary')
            {
                const commentary=[];
                $('.row').each((index, data) =>{
                    const result={};
                    result.ball=$(data).find('.col-md-3.col-xs-3.custom_ballswidth').find('.run_rate').text();
                    result.output=$(data).find('.col-md-3.col-xs-3.custom_ballswidth').find('.ball_bg').text();
                    result.text=$(data).find('.col-md-9.col-xs-9').text();
                    if($(data).find('.col-md-9.col-xs-9').text() !== '')
                    {
                        commentary.push(result);
                    }
                })
                matchData.commentary=commentary.slice(1);
                res.status(200).send(matchData);
            }
            else if(type=='squad')
            {
                const teams = [];

$('.mat-expansion-panel').each((index, element) => {
    const teamName = $(element).find('.mat-expansion-panel-header-title').text().trim();
    const players = [];

    $(element).find('.flex').each((index, playerElement) => {
        const playerName = $(playerElement).find('.playerdesc a').text().trim();
        const playerRole = $(playerElement).find('.playerdesc span').last().text().trim();
        const playerImage = $(playerElement).find('.playerimg img').attr('src');

        players.push({ playerName, playerRole, playerImage });
    });

    teams.push({ teamName, players });
});
matchData.squads = teams;
res.status(200).send(matchData);
            }
            
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    },
};

module.exports = scoreCardController;
