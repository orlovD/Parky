var fs = require('fs');

eval(fs.readFileSync('server_logic.js')+'');


module.exports = function(app, passport) {

// normal routes ===============================================================

    // show the home page (will also have our login links)
    app.get('/', function(req, res) {
		if (req.isAuthenticated()){
			res.render('getParkingList.ejs', {user : req.user});
		}
		else{
			res.render('index.ejs');
		}
    });

    // // PROFILE SECTION =========================
    // app.get('/profile', isLoggedIn, function(req, res) {
		// console.log(req.body.NewLat + "," + req.body.NewLong)
		// if((req.body.NewLat != undefined) && (req.body.NewLong != undefined))
			// req.user.SetLocation(new Location(req.body.NewLat, req.body.NewLong));
		// console.log("logged in user: %j", req.user);
		
        // res.render('profile.ejs', {
            // user : req.user,
			// message : ""
        // });		
    // });
	
	app.get('/getParkingList', isLoggedIn, function(req, res) {
        res.render('getParkingList.ejs', {
            user : req.user,
			message : ""
        });		
    });
	
	app.post('/getParkingList', isLoggedIn, function(req, res) {
		if((req.body.Lat != undefined) && (req.body.Long != undefined)){
      var chosen_id = req.body.chosen_id;
      if(!req.body.chosen_id){
        chosen_id = -1;
      }
			var lat = parseFloat(req.body.Lat);
			var lng = parseFloat(req.body.Long);
			var loc = new Location(lat, lng);
			console.log("Post //getParkingList parameters:\nLocation: %j\nUser: %j", loc, req.user);
			getParkingList(req.user, loc, chosen_id, function(response){
				console.log("get parking list %j", response);
				sendResponse(req.user, res, response);
			});
		}
    });
	
	app.post('/addParking', isLoggedIn, function(req, res) {
		if((req.body.Lat != undefined) && (req.body.Long != undefined)){
			var Lat = parseFloat(req.body.Lat);
			var Long = parseFloat(req.body.Long);
			var location = new Location(Lat, Long);
			console.log("Post //addParking parameters:\nLocation: %j\nUser: %j", location, req.user);
			addParkingToDB(req.user, location);
      sendResponse(req.user, res, null);
		}
    });
	
	app.post('/updateParkingStatus', isLoggedIn, function(req, res) {
		if((req.body.isOccupied != undefined) && (req.body.parking_id != undefined)){
			var parking_id = parseFloat(req.body.parking_id);
			var isOccupied = req.body.isOccupied;
			console.log("Post //updateParkingStatus parameters:\nparking_id: %d\nisOccupied: %j", parking_id, isOccupied);
			DBgetParkingByParkingId(parking_id, function(parking_response){
				if(parking_response.error)
					console.log('error updating parking status from routes: %s', parking_response.error);
				else{
					parkedStatus(req.user, parking_response.object_data, (isOccupied=='true'), function(points){
						console.log("updateParkingStatus points: %j", points);
						sendResponse(req.user, res, {score: points});
					});
				}
			});
		}
    });
	
	app.post('/chooseParking', isLoggedIn, function(req, res) {
		if((req.body.Lat != undefined) && (req.body.Long != undefined)&&(req.body.parking_id != undefined)){
			var Lat = parseFloat(req.body.Lat);
			var Long = parseFloat(req.body.Long);
			var parking_id = parseFloat(req.body.parking_id);
			var location = new Location(Lat, Long);
			console.log("Post //chooseParking parameters:\nLocation: %j\nParking id: %d", location, parking_id);
			req.user.location = location;
      DBGetChosenParking(req.user, function(id){
          req.user.ChosenParkingSpace=id;
			    choseParking(req.user, parking_id);
      });

      sendResponse(req.user, res, null);
		}
    });
	
	app.post('/cancelPark', isLoggedIn, function(req, res) {
		if(req.body.parking_id != undefined){
			var parking_id = parseFloat(req.body.parking_id);
			console.log("Post //cancelPark parameters:\nParking id: %d", parking_id);
			cancelParking(req.user, req.body.parking_id);
      sendResponse(req.user, res, null);
		}
    });

    // LOGOUT ==============================
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });


function sendResponse(user, res, obj){
  getMessages(user.id, function(mess){
    console.log("return message: "+ mess);
    ret = {object: obj,
          message: mess};
    res.send(ret);
  
  });
}
// =============================================================================
// AUTHENTICATE (FIRST LOGIN) ==================================================
// =============================================================================

    // locally --------------------------------
        // LOGIN ===============================
        // show the login form
        app.get('/login', function(req, res) {
			if (req.isAuthenticated()){
				res.render('getParkingList.ejs', {user : req.user});
			}
			else{
				res.render('login.ejs', { message: req.flash('loginMessage') });
			}
        });

        // process the login form
        app.post('/login', passport.authenticate('local-login', {
            successRedirect : '/getParkingList', // redirect to the secure profile section
            failureRedirect : '/login', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));

        // SIGNUP =================================
        // show the signup form
        app.get('/signup', function(req, res) {
			if (req.isAuthenticated()){
				res.render('getParkingList.ejs', {user : req.user});
			}
			else{
				res.render('signup.ejs', { message: req.flash('signupMessage') });
			}
        });

        // process the signup form
    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect : '/getParkingList', // redirect to the secure profile section
        failureRedirect : '/signup', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
    }));
	
	app.post('/profile', isLoggedIn, function(req, res) {
		console.log( "111user id:" + req.user.id);
		if((req.body.NewLat != undefined) && (req.body.NewLong != undefined)){
			req.user.location = new Location(req.body.NewLat, req.body.NewLong);
			
			req.user.SetLocation(req.body.NewLat, req.body.NewLong, req.user.id, function(update_response){
				console.log( "update response error: %s",  update_response.error);
				res.render('getParkingList.ejs', { 
					user : req.user,
					message: update_response.error
				});
			});
		}
		else{
			res.render('profile.ejs', {
				user : req.user
			});	
		}		
    });
	
	

};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
	console.log("isLoggedIn");
    if (req.isAuthenticated()){
		console.log("true");
		return next();
	}
     
    res.redirect('/');
}
