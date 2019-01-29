// Dum,Dum,Dum... no generator!!
// First, well, this is an Express app. Maybe we should
// get... Express
const express = require('express');
// Make an express app
let app = express();
// put our helmet on!
const bcrypt = require('bcrypt-nodejs');
const helmet = require('helmet');
// app.use means, add some middleware!
// middelware = any function that has access to req and res
app.use(helmet());

// Set up Mysql Connection
const mysql = require('mysql');
const config = require('./config');
let connection = mysql.createConnection(config.db);
// we have a connection, let's connect!
connection.connect();

// add ejs, so we can render!
app.set('views','views');
app.set('view engine','ejs');
// set up our public folder
app.use(express.static('public'));

// we need the body parser and urlencode middleware
// so we can get data from post requests!
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.get('/',(req, res, next)=>{
    const animalQuery = `SELECT * FROM animals;`;
    connection.query(animalQuery,(error,results)=>{
        if(error){throw error}
        // resuilts is an array of all rows in animals.
        // grab a random one
        const rand = Math.floor(Math.random() * results.length);
        res.render('index',{animal: results[rand]});
    });
});

app.get('/standings',(req,res,next)=>{
    // this is a specific SQL query to only get the data
    // that you want to JS
    const selectQuery = `SELECT SUM(IF(value='domestic',1,-1)) AS domesticCount, MAX(animals.species) as species FROM votes 
    INNER JOIN animals ON votes.aid = animals.id
    GROUP BY animals.species;` 

    // const giveMeAllTheDataAndJSWillFIgureItOut = `
    //     SELECT * FROM votes 
    //     INNER JOIN animals ON votes.aid = animals.id
    // `
    connection.query(selectQuery,(error,results)=>{
        if(error){throw error;}
        res.render('standings',{results});
    })
});

// espn wildcard example:
// http://www.espn.com/nfl/team/_/name/ne/new-england-patriots
// app.get('/nfl/team/_/name/:city/:team',(req, res)=>{
    // query db, get the info from team WHERE team = req.params.city
// })

// add a new route to handle the votes
// /vote/wild/1
// /vote/domestic/3
// /vote/up/ninja
// /vote/up -- NOT
// /vote/wild/3/ha -- NOT
app.get('/vote/:value/:id',(req, res)=>{
    const value = req.params.value;
    const aid  = req.params.id;
    const insertQuery = `INSERT INTO votes (id,aid,value)
        VALUES 
    (DEFAULT,?,?);`;
    connection.query(insertQuery,[aid,value],(error,results)=>{
        if (error) {throw error;}
        res.redirect('/');
    })    
})

app.get('/register',(req, res)=>{
    res.render('register',{})
})

app.post('/registerProcess',(req, res, next)=>{
    // res.json(req.body);
    const hashedPass = bcrypt.hashSync(req.body.password);
    // const match = bcrypt.compareSync('x','$2a$10$/AIQo3.ojIKlv8hF2Zzo/uKuktqWO9skd8kun2YECFHl2WhnsZuW2');
    // const match2 = bcrypt.compareSync('x','$2a$10$us61i0sFyjFXDz2kwdnpyuxnfHvsB2t6l9GvJzHMKdhuYm0a3WQWG');
    // res.json({match,match2});
    // Before we insert a new user into the users table, we need
    // to make sure this email isn't already in the db
    const checkUserQuery = `SELECT * FROM users WHERE email = ?`;
    connection.query(checkUserQuery,[req.body.email],(error,results)=>{
        if(error){throw error;}
        if(results.length != 0){
            // our query returned a row, that means this email is already registered
            res.redirect('/register?msg=register');
        }else{

        }
    })

})

console.log("App is listening on port 8902");
app.listen(8902);