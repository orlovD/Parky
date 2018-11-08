// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var app      = express();
var port     = process.env.PORT || 80;
var passport = require('passport');
var flash    = require('connect-flash');
var mysql = require('mysql');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');
var SessionStore = require('express-mysql-session');

// configuration ===============================================================

require('./config/passport')(passport); // pass passport for configuration

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs'); // set up ejs for templating

var connection = mysql.createConnection({
  host     : 'localhost',
  port	   : '3306',
  user     : 'root',
  password : 'root12',//
  database : 'parky',
  insecureAuth : true
});

var sessionStore = new SessionStore({}/* session store options */, connection);
app.use( express.static( "public" ) );
// required for passport
app.use(session({ key: 'session_cookie_name',
                  secret: 'secretcookie',
                  store: sessionStore,
                })); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

// launch ======================================================================


app.listen(port);
////delete all from the db  to start
// connection.query("delete from users",function(err,rows){
	// if(err)
		// console.log(err);
	// else
		// console.log(rows);
// });

console.log('The magic happens on port ' + port);
