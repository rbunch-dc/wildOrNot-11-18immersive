// Dum,Dum,Dum... no generator!!
// First, well, this is an Express app. Maybe we should
// get... Express
const express = require('express');
// Make an express app
let app = express();
// put our helmet on!
const bcrypt = require('bcrypt-nodejs');
const expressSession = require('express-session');
const helmet = require('helmet');
const config = require('./config');
// app.use means, add some middleware!
// middelware = any function that has access to req and res
app.use(helmet());

const sessionOptions = {
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true,
//   cookie: { secure: true }
};

app.use(expressSession(sessionOptions));

// Set up Mysql Connection
const mysql = require('mysql');
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

// Define some middleware, if the user is logged in, 
// then send the user data over to the view
app.use('*',(req, res, next)=>{
    // console.log("Middleware is working!");
    if(req.session.loggedIn){
        // res.locals is the variable that gets sent to the view
        res.locals.name = req.session.name;
        res.locals.id = req.session.id;
        res.locals.email = req.session.email;
        res.locals.loggedIn = true;
    }else{
        res.locals.name = "";
        res.locals.id = "";
        res.locals.email = "";
        res.locals.loggedIn = false;
    }
    next();
})


app.get('/',(req, res, next)=>{
    // check to see if the user is loggedIn
    // if not: goodbye.
    if(!req.session.loggedIn){
        res.redirect('/login?msg=mustLogin');
    }else{
        // we want all rows in animals
        // that don't have an id in the votes table
        // a perfect use case for a subquery!
        // subquery, is a query inside a query
        // we are going to get a list of all votes this use has
        // then we are going to take that list, and check it against 
        // the list of animals
        const animalQuery = `SELECT * FROM animals WHERE id NOT IN(
            SELECT aid FROM votes WHERE uid = ?
        );`;
        connection.query(animalQuery,[req.session.uid],(error,results)=>{
            if(error){throw error}
            
            // see if there is anything in the query string for msg
            let msg;
            if(req.query.msg == 'regSuccess'){
                msg = 'You have successfully registered!';
                console.log(msg);
            }else if(req.query.msg == 'loginSuccess'){
                msg = 'You have successfully logged in!';
            }

            // results is an array of all rows in animals.
            // grab a random one
            if(results.length === 0){
                // user has voted on all animals.
                res.render('index',{
                    animal: null,
                    msg: `You have voted on all the animals! Please upload a new one, 
                    or check out the <a href="/standings">standings</a> page.`
                });
            }else{
                const rand = Math.floor(Math.random() * results.length);
                res.render('index',{
                    animal: results[rand],
                    msg
                });    
            }
        })
    };
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
    const insertQuery = `INSERT INTO votes (id,aid,value,uid)
        VALUES 
    (DEFAULT,?,?,?);`;
    connection.query(insertQuery,[aid,value,req.session.uid],(error,results)=>{
        if (error) {throw error;}
        res.redirect('/');
    })    
})

app.get('/register',(req, res)=>{
    let msg;
    if(req.query.msg == 'register'){
        msg = 'This email adress is already registered.';
    }
    res.render('register',{msg})
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
            // this is a new user! Insert them!
            const insertUserQuery = `INSERT INTO users (name, email, hash)
                VALUES
            (?,?,?)`;
            connection.query(insertUserQuery,[req.body.name, req.body.email, hashedPass],(error2, results2)=>{
                if(error2){throw error2;}
                res.redirect('/?msg=regSuccess');
            })
        }
    })
})

app.get('/login', (req, res, next)=>{
    let msg;
    if(req.query.msg == 'noUser'){
        msg = '<h2 class="text-danger">This email is not registered in our system. Please try again or register!</h2>'
    }else if(req.query.msg == 'badPass'){
        msg = '<h2 class="text-warning">This password is not associated with this email. Please enter again</h2>'
    }
	res.render('login',{msg});
});

app.post('/loginProcess',(req, res, next)=>{
    // res.json(req.body);
    const email =  req.body.email;
    // this is the English version of the password the user submitted
    const password = req.body.password;
    // we now need to get the hashed version from the DB, and compare!
    const checkPasswordQuery = `SELECT * FROM users WHERE email = ?`;
    connection.query(checkPasswordQuery,[email],(error, results)=>{
        if(error){throw error;}
        // possiblities:
        // 1. No match. I.e., the user isnt not in the database.
        if(results.length == 0 ){
            // we dont care what password they gave us. Send them back to /login
            res.redirect('/login?msg=noUser');
        }else{
            // User exists...
            // 2. We found the user, but password doesnt match
            const passwordsMatch = bcrypt.compareSync(password,results[0].hash);
            if(!passwordsMatch){
                // goodbye.
                res.redirect('/login?msg=badPass');
            }else{
                // 3. We found the user and the password matchs
                // these are the droids we're looking for!!
                // -NOTE: every single http request (route) is a completely
                // new request. 
                // Cookies: Stores data in the browser, with a key on the server
                // every single page request the entire cookie is sent to the server
                // Sessions: Stores data on the server, with a key (cookie) on the browser
                console.log(results[0].id)
                req.session.name = results[0].name;
                req.session.email = results[0].email;
                // id is a reserved keyword in session. Don't mess with it.
                // change id --> uid
                req.session.uid = results[0].id;
                req.session.loggedIn = true;
                res.redirect('/?msg=loginSuccess');
                // response is set. HTTP disconnects.
                // we are done
            }
        }
    })
});

app.get('/logout',(req, res, next)=>{
    // delete all session varibles for this user
    req.session.destroy();
    res.redirect('/login?msg=loggedOut')
})

console.log("App is listening on port 8902");
app.listen(8902);