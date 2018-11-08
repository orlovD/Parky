// config/passport.js
				
// load all the things we need
var LocalStrategy   = require('passport-local').Strategy;
var bcrypt   = require('bcrypt-nodejs');
var mysql = require('mysql');
var DB = require("../DB_logic");
var fs = require('fs');

// file is included here:
eval(fs.readFileSync('DB_logic.js')+'');

function handleDisconnect() {
  var connection = mysql.createConnection({
    host     : 'localhost',
    port	   : '3306',
    user     : 'root',
    password : 'root12',//
    database : 'parky',
    insecureAuth : true
  });

  connection.connect(function(err, conn) {
    if(err) {
         console.log('MySQL connection error: ', err);
         process.exit(1);
    }
  });

  connection.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}
  
// expose this function to our app using module.exports
module.exports = function(passport) {

	// =========================================================================
    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
		console.log("serializing %j", user);
		done(null, user.id);
    });

    // used to deserialize the user
    passport.deserializeUser(function(id, done) {
		DBgetUserByID(id, null, function(res){
			var err;
			if(res == null)
				err = "deserializeUser failed";
			done(err, res);
		});
    });
	

 	// =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
	// by default, if there was no name, it would just be called 'local'

    passport.use('local-signup', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, email, password, done) {
		// find a user whose email is the same as the forms email
		// we are checking to see if the user trying to login already exists
		if (email)
            email = email.toLowerCase(); // Use lower-case emails to avoid case-sensitive email matching
		register(req.body.name, req.body.username, password, email, function(register_response){
			console.log("register-response: %s", register_response.error);
			if(register_response.error != null){
				return done(null, false, req.flash('signupMessage', register_response.error));
			}			
			else
				return done(null, register_response.user);
		});		
    }));

    // =========================================================================
    // LOCAL LOGIN =============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'

    passport.use('local-login', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, email, password, done) { // callback with email and password from our form
		login(null, password, email, function(login_response){
			//if error - flash message to the user
			if(login_response.user == null)
				return done(null, false, req.flash('loginMessage', login_response.error)); // req.flash is the way to set flashdata using connect-flash
			else
				return done(null, login_response.user);
				
		});
    }));

};