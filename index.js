const PORT=process.env.PORT || 8000;
const express = require('express');
const cors = require("cors");


const app = express();
app.use(cors());

app.get('/',(req,res)=>{
    res.json("Cricket API Made by Abhip32!")
})


app.use(require("./routes/newsRoute"))
app.use(require("./routes/MatchDataRoute"));
app.use(require("./routes/SchduleRoute"));
app.use(require("./routes/rankingRoutes"));
app.use(require("./routes/ScoreCardRoute"));

app.listen(PORT, ()=>console.log('listening on port :'+PORT))
