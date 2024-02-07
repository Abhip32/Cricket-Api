const flagController ={
    getFlag : async (req,res)=>{
    let team=req.params.flag
    let url=flagController.flagData(team)
    console.log(url)
    res.status(200).json({message:"success",data:url})
    },

    flagData:(team)=>{
        if(team =='Ireland'||team =='Ireland Women'||team=='Ireland Under-19s'||team=='Ireland Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313149.logo.png"
        }
        else if(team =='India'||team =='India Women'||team=='India Under-19s'||team=='India Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313128.logo.png"
        }
        else if(team =='England'||team =='England Women'||team=='England Under-19s'||team=='England Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313114.logo.png"
        }
        else if(team =='New Zealand'|| team=='New Zealand Women'||team=='New Zealand Under-19s'||team=='New Zealand Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/340500/340505.png"
        }
        else if(team =='Bangladesh'|| team=='Bangladesh Women'||team=='Bangladesh Under-19s'||team=='Bangladesh Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/341400/341456.png"
        }
        
        else if(team =='West Indies'|| team=='West Indies Women'||team=='West Indies Under-19s'||team=='West Indies Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317600/317615.png"
        }
        else if(team =='Australia'||team =='Australia Women'||team=='Australia Under-19s'||team=='Australia Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/340400/340493.png"
        }
        else if(team =='Sri Lanka'|| team=='Sri Lanka Women'||team=='Sri Lanka Under-19s'||team=='Sri Lanka Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/340000/340047.png"
        }
        else if(team =='Zimbabwe'|| team =='Zimbabwe Women'||team=='Zimbabwe Under-19s'||team=='Zimbabwe Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/340500/340503.png"
        }
        else if(team =='Pakistan'|| team =='Pakistan Women'||team=='Pakistan Under-19s'||team=='Pakistan Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313129.logo.png"
        }
        else if(team =='South Africa'|| team=='South Africa Women'||team=='South Aftrica Under-19s'||team=='South Africa Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313125.logo.png"
        }
        else if(team =='Afghanistan'|| team =='Afghanistan Women'||team=='Afghanistan Under-19s'||team=='Afghanistan Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/321000/321005.png"
        }
        else if(team =='Namibia'|| team =='Namibia Women'||team=='Namibia Under-19s'||team=='Namibia Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313148.logo.png"
        }
        else if(team =='Nepal'|| team =='Nepal Women'||team=='Nepal Under-19s'||team=='Nepal Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/319900/319958.png"
        }
        else if(team =='Netherlands'|| team =='Netherlands Women'||team=='Netherlands Under-19s'||team=='Netherlands Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313136.logo.png"
        }
        else if(team =='Oman'|| team =='Oman Women'||team=='Oman Under-19s'||team=='Oman Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313157.logo.png"
        }
        else if(team =='Papua New Guinea'|| team =='Papua New Guinea Women'||team=='Papua New Guinea Under-19s'||team=='Papua New Guinea Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313141.logo.png"
        }
        else if(team =='Scotland'|| team =='Scotland Women'||team=='Scotland Under-19s'||team=='Scotland Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313150.logo.png"
        }
        else if(team =='United Arab Emirates'|| team =='United Arab Emirates Women'||team=='United Arab Emirates Under-19s'||team=='Unites Arab Emirates Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313147.logo.png"
        }
        else if(team =='United States of America'|| team =='United States of America Women'||team=='United States of America Under-19s'||team=='United States of America Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313133.logo.png"
        }
        else if(team =='Hungary'|| team =='Hungary Women'||team=='Hungary Under-19s'||team=='Hungary Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313186.logo.png"
        }
        else if(team =='Portugal'||team =='Portugal Women'||team=='Portugal Under-19s'||team=='Portugal Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313203.logo.png"
        }
    else if(team =='Spain'||team =='Spain Women'||team=='Spain Under-19s'||team=='Spain Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313211.logo.png"
        }
    else if(team =='Gibraltar'||team =='Gibraltar Women'||team=='Gibraltar Under-19s'||team=='Gibrartal Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313139.logo.png"
        }
    else if(team =='Israel'||team =='Israel Women'||team=='Israel Under-19s'||team=='Israel Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313143.logo.png"
        }
    else if(team =='Malta'||team =='Malta Women'||team=='Malta Under-19s'||team=='Malta Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313165.logo.png"
        }
    else if(team =='Belgium'||team =='Belgium Women'||team=='Belgium Under-19s'||team=='Belgium Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313162.logo.png"
        }
    else if(team =='Denmark'||team =='Denmark Women'||team=='Denmark Under-19s'||team=='Denmark Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313135.logo.png"
        }
    else if(team =='Malaysia'||team =='Malaysia Women'||team=='Malaysia Under-19s'||team=='Malaysia Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313137.logo.png"
        }
    else if(team =='Singapore'||team =='Singapore Women'||team=='Singapore Under-19s'||team=='Singapore Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313144.logo.png"
        }
    else if(team =='Germany'||team =='Germany Women'||team=='Germany Under-19s'||team=='Germany Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313286.logo.png"
        }
    else if(team =='Bhutan'||team =='Bhutan Women'||team=='Bhutan Under-19s'||team=='Bhutan Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313171.logo.png"
        }
    else if(team =='Maldives'||team =='Maldives Women'||team=='Maldives Under-19s'||team=='Maldives Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313194.logo.png"
        }
    else if(team =='Thailand'||team =='Thailand Women'||team=='Thailand Under-19s'||team=='Thailand Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313217.logo.png"
        }
    else if(team =='Canada'||team =='Canada Women'||team=='Canada Under-19s'||team=='Canada Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313138.logo.png"
        }
    else if(team =='Jersey'||team =='Jersey Women'||team=='Jersy Under-19s'||team=='Jersy Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313384.logo.png"
        }
        else if(team =='Italy'||team =='Italy Women'||team=='Italy Under-19s'||team=='Italy Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313151.logo.png"
        }
        else if(team =='Hongkong'||team =='Hongkong Women'||team=='Hongkong Under-19s'||team=='Hongkong Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313140.logo.png"
        }
        else if(team =='Bermuda'||team =='Bermuda Women'||team=='Bermuda Under-19s'||team=='Bermuda Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313134.logo.png"
        }
        else if(team =='Kenya'||team =='Kenya Women'||team=='Kenya Under-19s'||team=='Kenya Under-19s Women')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313146.logo.png"
        }
        else if(team =='Uganda'||team =='Uganda'||team=='Uganda'||team=='Uganda')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313154.logo.png"
        }
        else if(team=='Surrey')
        {
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313277.logo.png"
        }
        else if(team=='Hampshire')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313267.logo.png"
        }
        else if(team=='Lancashire')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313271.logo.png"
        }
        else if(team=='Yorkshire')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313281.logo.png"
        }
        else if(team=='Warwickshire')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313279.logo.png"
        }
        else if(team=='Essex')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313263.logo.png"
        }
        else if(team=='Kent')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313268.logo.png"
        }
        else if(team=='Northamptonshire')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/337600/337638.png"
        }
        else if(team=='Somerset')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313276.logo.png"
        }
        else if(team=='Gloucestershire')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313265.logo.png"
        }
        else if(team =='Nottinghamshire')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313275.logo.png"
        }
        else if(team =='Middlesex')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313273.logo.png"
        }
        else if(team=='Glammorgan')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313264.logo.png"
        }
        else if(team=='Derbyshire')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313254.logo.png"
        }
        else if(team=='Worcestershire')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313280.logo.png"
        }
        else if(team=='Dhuram')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313255.logo.png"
        }
        else if(team=='Sussex')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313278.logo.png"
        }
        else if(team=='Leicestershire')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313272.logo.png"
        }
        else if(team =='Madhya Pradesh')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313313.logo.png"
        }
        else if(team =='Kerala')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313310.logo.png"
        }
        else if(team =='Gujarat')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317200/317261.png"
        }
        else if(team =='Meghalaya')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/327900/327931.png"
        }
        else if(team =='Bengal')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313297.logo.png"
        }
        else if(team =='Hyderabad (India)')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313305.logo.png"
        }
        else if(team =='Baroda')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313296.logo.png"
        }
        else if(team =='Chandigarh')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313300.logo.png"
        }
        else if(team =='Karnataka')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313311.logo.png"
        }
        else if(team =='Railways')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/327900/327910.jpg"
        }
        else if(team =='Jammu & Kashmir')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317300/317303.png"
        }
        else if(team =='Puducherry')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313500/313571.logo.png"
        }
        else if(team =='Mumbai')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317100/317125.png"
        }
        else if(team =='Saurashtra')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313316.logo.png"
        }
        else if(team =='Odisha')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317200/317265.png"
        }
        else if(team =='Goa')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313302.logo.png"
        }
        else if(team =='Uttarakhand')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317300/317352.png"
        }
        else if(team =='Andhra')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313294.logo.png"
        }
        else if(team =='Services')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/327900/327915.jpg"
        }
        else if(team =='Rajasthan')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313315.logo.png"
        }
        else if(team =='Punjab')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317200/317262.png"
        }
        else if(team =='Haryana')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313304.logo.png"
        }
        else if(team =='Himachal Pradesh')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313303.logo.png"
        }
        else if(team =='Tripura')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313319.logo.png"
        }
        else if(team =='Uttar Pradesh')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313320.logo.png"
        }
        else if(team =='Vidarbha')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313321.logo.png"
        }
        else if(team =='Maharashtra')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313312.logo.png"
        }
        else if(team =='Assam')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313295.logo.png"
        }
        else if(team =='Jharkhand')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317200/317266.png"
        }
        else if(team =='Chhattisgarh')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317200/317260.png"
        }
        else if(team =='Tamil Nadu')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313318.logo.png"
        }
        else if(team =='Delhi')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313301.logo.png"
        }
        else if(team =='Nagaland')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317300/317355.png"
        }
        else if(team =='Manipur')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313314.logo.png"
        }
        else if(team =='Sikkim')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313300/313317.logo.png"
        }
        else if(team =='Arunachal Pradesh')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317300/317354.jpg"
        }
        else if(team =='Bihar')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313200/313298.logo.png"
        }
        else if(team =='Mizoram')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317300/317353.png"
        }
        else if(team =='Delhi Capitals')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313400/313422.logo.png"
        }
        else if(team =='Chennai Super Kings')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313400/313421.logo.png"
        }
        else if(team =='Royal Challengers Banglore')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313400/313418.logo.png"
        }
        else if(team =='Kolkata Knight Riders')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313400/313419.logo.png"
        }
        else if(team =='Mumbai Indians')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317900/317995.png"
        }
        else if(team =='Punjab Kings')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317000/317003.png"
        }
        else if(team =='Rajasthan Royals')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313400/313423.logo.png"
        }
        else if(team =='Sunrisers Hydrabad')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313400/313480.logo.png"
        }
        else if(team =='Lucknow Super Giants')
        {                                                   
            url="https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/333800/333885.png"
        }
        else if(team =='Gujrat Titans')
        {                                                   
            url=" https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/334700/334707.png"
        }
        else
        {
            url="https://t3.ftcdn.net/jpg/04/03/35/36/360_F_403353601_UMYFS9tYvnPDm0KJMg26u2qmR0sPZONu.jpg"
        }

        return url;
}}

module.exports =flagController