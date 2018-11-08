var mysql = require('mysql');


const deltaLat = 0.005; //constant for setting delta in latitude around the given point
const deltaLong = 0.005; //constant for setting delta in longitude around the given point
const rank1 = 100;
const rank2 = 1000;
const rank3 = 5000;
const maxParkings = 5;
var connection = mysql.createConnection({
  host     : 'localhost',
  port	   : '3306',
  user     : 'root',
  password : 'root12',//
  database : 'parky',
  insecureAuth : true
});


//connection.connect();

connection.connect(function(err, conn) {
    if(err) {
         console.log('MySQL connection error: ', err);
         process.exit(1);
    }

});



//scheduler
var later = require('later');
var hour = 1*3600*1000; //1 hour to ms
var day = 24*hour; //24 hours to ms



//==============================================================================
//Dmitry:
//==============================================================================



//SCHEDULED JOBS - for later pkg execute "npm install later" in cmd

// set later to use local time
later.date.localTime();
//create schedules
//every day on 00:00
var everyDay = later.parse.recur().on(0).hour();
//every hour on 00 minutes
var everyHour = later.parse.recur().on(0).minute();
//every minute on 00 seconds
var everyMinute = later.parse.recur().on(0).second();

//run jobs
//empty table user_and_helping_users every day at midnight
var deleteAll = later.setInterval(function(){
	EmptyTable("users_and_helping_users");
	}	, everyDay);
	
var updateFalse = later.setInterval(function(){
	UpdateTable("users", "number_of_false_parkings_for_today", 0);
	}	, everyDay);
 
//empty table user_and_helping_users every day at midnight
var deleteOld = later.setInterval(function(){
	DeleteOld("parking_lots", "time_established", hour);
	}	, everyHour);



//delete entries from table specified by name
function EmptyTable(table_name){
	connection.query('DELETE FROM ' +table_name+ '', function(err, rows, fields) {
		//query succed
		if (!err) {	  
			console.log('Table ' +table_name+ ' is empty now.');
		}
		else {
			console.log('Error while performing Query. ', err);
		}
	});
}



function UpdateTable(table_name, column_name, value){
	connection.query('UPDATE ' +table_name+ ' SET ' + column_name +'='+ value, function(err, rows, fields) {
		//query succed
		if (!err) {	  
			console.log('Table ' +table_name+ ' is empty now.');
		}
		else {
			console.log('Error while performing Query. ', err);
		}
	});
}

//delete entries that older than a look_back_time from table specified by name
function DeleteOld(table_name, column_name, look_back_time){
	var current_time_ms = new Date().getTime();//get current system time in milliseconds since 1970/01/01
	var time_diff = current_time_ms - look_back_time;//time to look back since current time
	connection.query('DELETE FROM ' +table_name+ ' WHERE ' +column_name+ ' < ' +time_diff+'', function(err, rows, fields) {
		//query succed
		if (!err) {	  
			console.log('Old entries are deleted from table ' +table_name+'.');
		}
		else {
			console.log('Error while performing Query. ', err);
		}
	});
}

//delete entries that older than a look_back_time from table specified by name
function DeleteOldParking(look_back_time){
  var table_name = "parking_lots";
  var column_name = "time_established";
	var current_time_ms = new Date().getTime();//get current system time in milliseconds since 1970/01/01
	var time_diff = current_time_ms - look_back_time;//time to look back since current time
	connection.query('SELECT creating_user_id FROM ' +table_name+ ' WHERE ' +column_name+ ' < ' +time_diff+' ORDER BY creating_user_id', function(err1, rows1, fields1) {

		//query succed
		if (!err1) {	  
        var user_id = rows1[0].creating_user_id;
       var user_count = 0; 
     for(var i = 0; i< rows1.length; i++){
       if(user_id != rows1[i].creating_user_id){
         DBgetUserByID(user_id, null, function(user){
           if(user_count > 5-user.NumberOfFalseParkingForToday){
             user_count=5-user.NumberOfFalseParkingForToday;
           }
           for(var j=0; j< user_count; j++){
             DBIncreaseNumberOfFalseParkings(user);
           }
           DBUpdateScore(user, user_count*2);
           setMessage(user.id, "You got " + user_count*2 + " points!");
         });
         user_id = rows1[i].creating_user_id;
         user_count = 1; 
       }
       user_count++; 
     }
		  connection.query('DELETE FROM ' +table_name+ ' WHERE ' +column_name+ ' < ' +time_diff+'', function(err, rows, fields) {
		    //query succed
		    if (!err) {	  
			    console.log('Old entries are deleted from table ' +table_name+'.');
		    }
		    else {
			    console.log('Error while performing Query. ', err);
		    }
	    });
		}
		else {
			console.log('Error while performing Query. ', err);
		}
	});
   

}

//BRIEF: get list of helped users in last 24 hours since current system time
//GET: user_id
//RETURN: calls response with list of helped users in last 24 hours since current system time
//ERROR: calls response with null 
function DBgetHelpedUsersIds(user_id, response){
	var helped_users = [];
	var current_time = new Date();//get current system time in ms
	var current_time_ms = new Date().getTime();//get current system time in milliseconds since 1970/01/01

	//console.log('curr_time= ' +current_time);
	//console.log('curr_time_ms= ' +current_time_ms);
	
	var time_ms = 24*3600*1000;//24 hours in milliseconds
	var time_diff = current_time_ms - time_ms;//time to look back since current time
	//console.log('Time diff is: ', time_diff);
	//get ids of helped users in last 24 hours
	connection.query('SELECT helped_user_id FROM users_and_helping_users WHERE helping_user_id ="' +user_id+ '" AND time_helped > "' +time_diff+ '"', function(err, rows, fields) {
		if (!err) {	  
			//user found in DB
			if(rows.length > 0) {
				var id;
				for (var i in rows) {	
					id = rows[i].helped_user_id;
					//console.log('ID= ' + id);
					helped_users.push(id);
				}
				//console.log('Performing Query - Success...', rows, helped_users);
				response(helped_users);
			}
			//user not found in DB
			else {
				helped_users = null;
				console.log('There are no users helped by user with id ' +user_id+ ' exist.');//, rows, helped_users);
				response(helped_users);
			}
		}
		else {
			console.log('Error while performing Query 5. ', err);
			response(null);
		}
	});
}

//BRIEF: receives user_id [+location] and returns user
//GET: user_id and location of user/null
//RETURN: calls response with user or null if not found
//ERROR: calls response with null 
function DBgetUserByID(user_id, location, response){
	//get user data
	connection.query('SELECT * FROM users WHERE user_id ="' +user_id+ '"', function(err, rows, fields) {
		if (!err) {	  
			//user found in DB
			if(rows.length > 0) {
				//initialize list of users helped by current user
				DBgetHelpedUsersIds(user_id, function(UsersHelpedTodayIds){ //function that will run after DBgetUserByID is finished
					//console.log('TEST******* ' + UsersHelpedTodayIds);	
					var user;					
					user = new User(rows[0].name, rows[0].password);
					user.username = rows[0].username;
					user.email = rows[0].email;
					user.id = rows[0].user_id;
					user.Score = rows[0].score;
					user.NumberOfFalseParkingForToday = rows[0].number_of_false_parkings_for_today;
					user.UsersHelpedTodayIds = UsersHelpedTodayIds;
					user.ChosenParkingSpace = rows[0].chosen_parking_lot_id;
          user.Rank = rows[0].rank;
					console.log("row: %j", rows[0]);
					DBGetLocation(user_id, function(get_response){
							if(get_response.error == null){
								user.Location = get_response.object_data;
							}
						}
					);

					//console.log('Performing Query - Success...');///, rows, user);
					response(user);
				
				}); //all the code below will run BEFORE the DBgetUserByID returns
			}
			//user not found in DB
			else {
				user = null;
				// console.log('User Id is not found in DB. ', rows, user);
				response(user);
			}
		}
		else {
			console.log('Error while performing Query 6. ', err);
			response(null);
		}
	});
}


//BRIEF: receives user details, get it from the DB and call response with the user
//GET: username password and email 
//RETURN: calls response with login_response: {error:null, user:user}
//ERROR: calls response with login_response: {error: string, user: null}
function login(username, pass, email, response){
  var result;
  var user = new User(0,0);
  var login_response;
  //get user_id
  
  connection.query('SELECT * FROM users WHERE email = "' +email+ '"', function(err, rows, fields) {
    if (err)
			response(new Login(null, err));	
    else if(rows.length == 0)
      response(new Login(null, "User doesn't exist"));	
    else{
      connection.query('SELECT * FROM users WHERE email = "' +email+ '" AND password = "' +pass+ '"', function(err, rows, fields) {
        if (err)
          response(new Login(null, err));	
        else if(rows.length == 0)
          response(new Login(null, "Wrong Password"));	
        else
  				DBgetUserByID(rows[0].user_id, null, function(user){ response(new Login(user, null)); }	);
      });    
    }    
  });
}


//BRIEF: receives user details, 
// 		 if not username and email doesn't exist - save it in DB and call response with the user
//GET: username password and email 
//RETURN: calls response with register_response: {error:null, user:user}
//ERROR: calls response with register_response: {error: string, user: null}
function register(name, username, pass, email, response){
	var result;
	//var user = new User(0,0);
	var login_response;
	//check if user or email already in DB
   console.log("register: username:%s email:%s password:%s", username, email, pass);
  console.log('register: SELECT * FROM users WHERE username = "' +username+ '" OR email = "' +email+ '"');
	connection.query('SELECT * FROM users WHERE username = "' +username+ '" OR email = "' +email+ '"', function(err, rows, fields) {
		//username already in DB
		if (rows.length > 0) {
      console.log("found one: %j", rows[0]);
			result = "User " +username+ " or/and email " +email+ " already exist/s in DB!";
			user = null;
			//create and return register response
			register_response = new Register(user, result);		
			// console.log(register_response);	
			response(register_response);	
		}
		//username and email are not in DB
		else {
      console.log("found none");
			//add new user into DB if not exists
			connection.query('INSERT INTO users (username, name, password, email) SELECT * FROM (SELECT "' +username+ '","' +name+ '","' +pass+ '","' +email+ '") AS tmp WHERE NOT EXISTS (SELECT username FROM users WHERE username = "' + username + '") LIMIT 1', function(err, rows, fields) {
				//user added into DB
				if (!err) {
          console.log("user " +username+ " inserted into the database");
          result = null;
					// console.log(result);
					//get user object
					login(username, pass, email, function(login_response){
            console.log("register-login-next: user: %j", login_response.user);
						user = login_response.user;
						//create and return register response
						register_response = new Register(user, result);	
						response(register_response);	
					}); 			 
				}
				//error in query
        else {
            console.log("error code: %s", err.code);
            if(err.code == "ER_DUP_FIELDNAME")
                result = "Error: same fields inserted. please enter fields which are different"
            else
                result = JSON.stringify(err);
            console.log("error code: %s", err.code);
            user = null;
            //create and return register response
            register_response = new Register(user, result); 
            response(register_response);    
        }  
			}); 
		}
	});	
}

//receives time interval to look back from current time in milliseconds, like: 1 day is 24*3600*1000=86400000ms
//it is substracted from current system time and parking with time_established > current_time_ms - establishedBefore are returned
function getParkingListFromDB(location, establishedBefore, user, response) {
	var parking_list = [];
			
	//console.log('Location: ' + location);
	
	var latitude = location.Lat;
	var longitude = location.Long;
	
	var latPlus = latitude + deltaLat;
	var longPlus = longitude + deltaLong;
	var latMinus = latitude - deltaLat;
	var longMinus = longitude - deltaLong;

	var current_time_ms = new Date().getTime();//get current system time in milliseconds since 1970/01/01

	//console.log('curr_time_ms= ' +current_time_ms);
	var time_diff = current_time_ms - establishedBefore;//time to look back since current time

	//get parking list
	connection.query('SELECT D.* FROM (SELECT C.* FROM (SELECT B.* FROM (SELECT A.* FROM (SELECT * FROM parking_lots WHERE latitude <= "' +latPlus+ '") A WHERE longitude <= "'  +longPlus+ '") B WHERE latitude >= "' +latMinus+ '") C WHERE longitude >= "' +longMinus+ '") D WHERE (time_established < "' +time_diff+ '" OR creating_user_id="'+user.id+'")', function(err, rows, fields) {	
		if (!err) {
			// console.log('Number of appropriate parking lots are: ', rows.length);
			//parking_list = rows;
	
		
			//parking found in DB
			if(rows.length > 0) {
				var Id;
				var Latitude;
				var Longitude;
				var CreatingUserId;
				var NumberOfUsersOnTheWay;
				var TimeEstablished;
				//objects
				var ParkingLocation;
				var ParkingLot;
				//initialize user object from DB
				for (var i in rows) {	
					Id = rows[i].parking_lot_id;
					Latitude = rows[i].latitude;
					Longitude = rows[i].longitude;
					CreatingUserId = rows[i].creating_user_id;
					NumberOfUsersOnTheWay = rows[i].number_of_users_on_the_way;
					TimeEstablished = rows[i].time_established;
					//initialize objects
					ParkingLot = new ParkingSpace(new Location(Latitude, Longitude), CreatingUserId, TimeEstablished);
					ParkingLot.UsersOnTheWay = NumberOfUsersOnTheWay;
					ParkingLot.id = Id;
					//add parking to the array
					parking_list.push(ParkingLot);
				}
				//console.log('Performing Query - Success...');
				console.log('number of appropriate parking lots are: '+parking_list.length);
				response(parking_list);
			}
			else {
				parking_list = null;
				// console.log('No appropriate parking lots found: ', parking_list);
				response(parking_list);
			}
		}
		else {
			parking_list = null;
		//	console.log('Error while performing Query. ', err);
			response(parking_list);
		}
	});	
}


//return list of users around location
function DBgetAllUsers(location, response){	
	var user_list = [];
		
	///console.log('Location: ' + location);
	
	var latitude = location.Lat;
	var longitude = location.Long;
	
	var latPlus = latitude + deltaLat;
	var longPlus = longitude + deltaLong;
	var latMinus = latitude - deltaLat;
	var longMinus = longitude - deltaLong;

	var id;
	var latitude;
	var longitude;
	var UserLocation;
	var user;
	
	//get user_id list
	connection.query('SELECT C.* FROM (SELECT B.* FROM (SELECT A.* FROM (SELECT * FROM users_looking_for_parkings WHERE latitude <= "' +latPlus+ '") A WHERE longitude <= "'  +longPlus+ '") B WHERE latitude >= "' +latMinus+ '") C WHERE longitude >= "' +longMinus+ '"', function(err, rows, fields) {
		if (!err) {
			//users are found
			console.log("Number of users found: " +rows.length);
			if(rows.length > 0) {	
				
				for (var i in rows) {
					id = rows[i].user_id;
					latitude = rows[i].latitude;
					longitude = rows[i].longitude;				
					UserLocation = new Location(latitude, longitude);
					//create new user object
					DBgetUserByID(id, UserLocation, function(user){ //function that will run after DBgetUserByID is finished
						user_list.push(user);
						//console.log('Appropriate users are: ', user_list);
						response(user_list);	
					}); //all the code below will run BEFORE the DBgetUserByID returns					
				}	
			}
			//no users found			
			else {
				user_list = [];
				console.log('No appropriate users found: ', user_list);
				response(user_list);
			}
		}
		//error in query
		else {
			user_list = [];
			console.log('Error while performing Query 7. ', err);
			response(user_list);
		}
	});	
}


//return list of users around location
function DBGetLocation(user_id, response){	
	console.log("dbgetlocation");
	connection.query('SELECT * FROM users_looking_for_parkings WHERE user_id = "' +user_id+ '"', function(err, rows, fields) {
		var get_response;
		console.log("dbgetlocation2");
		if (!err) {
			if(rows.length > 0) {	
				get_response = new Response(new Location( rows[0].latitude, rows[0].longitude), null);
			}
			//no users found			
			else {
				get_response = new Response(null, 'No appropriate user found');
			}
		}
		//error in query
		else {
			console.log("error finding location");
			get_response = new Response(null, JSON.stringify(err));
		}
		console.log('get_response: %j', get_response);
		response(get_response);
	});	
}

function DBSetLocation(latitude, longtitude, user_id, response){		
	//get user_id list
	console.log("SET Location");
	var update_response;
	var queryCommand
	var start_time_of_looking_ms = new Date().getTime();//get current system time in milliseconds since 1970/01/01
	
	connection.query('SELECT * FROM users_looking_for_parkings', function(err, rows, fields) {
		console.log("SET Location2");
		if(rows.length > 0)
			queryCommand = 'UPDATE users_looking_for_parkings SET latitude = "'+ latitude + '", longtitude = "' + longtitude +'" WHERE user_id = "' + user_id + '"';
		else
			queryCommand = 'INSERT INTO users_looking_for_parkings (user_id, latitude, longitude, start_time_of_looking) VALUES ("' +user_id+ '","' +latitude+ '","' +longtitude + '","' +start_time_of_looking_ms+ '")';
		console.log("SET Location3");
		console.log("query: "+ queryCommand);
		connection.query(queryCommand, function(err, rows, fields) {
			console.log("set data: err: %j, rows: %j, fields: %j", err, rows, fields);
			if (!err) {
				update_response = new Response(null, null);
			}
			else {
				update_response = new Response(null, JSON.stringify(err));
			}
			console.log("set Location response: " + response);
			response(update_response);
		});	
	});
}


function addParkingToDB(user, location){
	var user_id;
	user_id = user.id;
    var latitude;
    latitude = location.Lat;
    var longitude;
    longitude = location.Long;
    
    var parkings_of_user;
	//default
	if (user_id === undefined) {
        return;
    } 
	console.log("latitude " + latitude + ", longitude " + longitude);
	var time_established_ms;
	time_established_ms = new Date().getTime();//get current system time in milliseconds since 1970/01/01
    //check if there is no parkings at given location
    connection.query('SELECT A.* FROM (SELECT * FROM parking_lots WHERE latitude <= "' +(latitude + 0.00001)+ '" AND latitude >= "' +(latitude - 0.00001)+ '") A WHERE longitude <= "' +(longitude + 0.00001)+ '" AND longitude >= "' +(longitude - 0.00001)+ '"', function(err, rows, fields) {
        if (!err) { 
            //console.log(rows);
            //if parking at given location is found
            if(rows.length > 0) {
                console.log('Error: parking already exists at given location.'); 
                setMessage(user.id, "There is a parking lot in this location.");
            }
            //if no parking found at given location is found
            else {
                //check how many parking has given user
                connection.query('SELECT COUNT(creating_user_id) AS parkings_of_user FROM parking_lots WHERE creating_user_id = "' +user_id+ '"', function(err, rows, fields) {
                    if (!err) {
                        //console.log(rows);
                        for (var i in rows) {
                            parkings_of_user = rows[i].parkings_of_user;
                        }
                        console.log('Number of parkings of current user is :', parkings_of_user);
                        //check if parkings_of_user > than maxParkings
                        if (parkings_of_user >= maxParkings) {
                            console.log('Error: current user has too many parkings.');
                            setMessage(user.id, "User cannot insert more than 5 parking at once");
                        } 
                        //user doesnt have too much parkings
                        else {
	//add new parking lot into table
	connection.query('INSERT INTO parking_lots (creating_user_id, latitude, longitude, time_established) VALUES ("' +user_id+ '","' +location.Lat+ '","' +location.Long+ '","' +time_established_ms+ '")', function(err, rows, fields) {
		if (!err) {	
			console.log('Parking lot at location "' + location.Lat, location.Long + '" is added into table parking lots');
      if(user.NumberOfFalseParkingForToday <5){
        setMessage(user.id, "You got 2 points!");
        DBUpdateScore(user.id, rank_occopaid_creator);
      }
		}
		else {
			console.log('Error while performing Query 8. ', err);  
		}
	});	
}
                    }
                    else {
                        console.log('Error while performing Query. ', err);  
                    }
                }); 
            }
        }
        else {
            console.log('Error while performing Query. ', err);  
        }
    }); 
}

//remove parking from table
//if isLooking == false, remove user from looking table
//if true, change user.parking = null;
function DBUpdateParkedStatus(user, parking_id, isLooking){
	var user_id;
	user_id = user.id;
	//default
	if (user_id === undefined) {
		return;
    } 
	if (parking_id === undefined) {
        return;
    } 
    console.log("parking_id: " + parking_id);
	//delete parking lot from parking_lots table
	connection.query('DELETE FROM parking_lots WHERE parking_lot_id =' + parking_id, function(err, rows, fields) {
	  if (!err) {
		console.log('Parking lot "' + parking_id + '"is removed from table');
	  }
	  else {
		  console.log('Error while performing REMOVE Query 9. ', err);  
	  }
	});	
	//if user still looking for parking
	if (!isLooking) {
		//delete user from users_looking_for_parkings table
		connection.query('DELETE FROM users_looking_for_parkings WHERE user_id =' + user_id, function(err, rows, fields) {
			if (!err) {
				console.log('User  "' + user_id + '"is removed from table');
			}
			else {
				console.log('Error while performing Query 10. ', err);  
			}
		});	
	}
	//if user isn't looking for parking
	else {
		//update user's parking lot to NULL
		connection.query('UPDATE users_looking_for_parkings SET chosen_parking_lot_id = null', function(err, rows, fields) {
			if (!err) {
				user.ChosenParkingSpace = null;
				console.log('Parking chosen by user "' + user_id + '" was taken');
			}
			else {
				console.log('Error while performing Query 11. ', err); 
			}
		});	
	}
}

//add ids of helping and helped users into table users_and_helping_users
//set time of help as current date (00:00:00)
function addHelpingUser(helping_user_id, helped_user_id){
	var time_helped;
	time_helped_ms = new Date().getTime();//get current system time in milliseconds since 1970/01/01
	//console.log(time_helped_ms);
	//var current_time_ms = new Date().getTime();//get current system time in milliseconds since 1970/01/01
	//add new helped user with user he helped
	connection.query('INSERT INTO users_and_helping_users (helping_user_id, helped_user_id, time_helped) VALUES ("' +helping_user_id+ '","' +helped_user_id+ '","' +time_helped_ms+ '")', function(err, rows, fields) {
		if (!err) {	
			console.log('User ' +helping_user_id+ ' helped user ' +helped_user_id+ ' to find parking lot.');
		}
		else {
			console.log('Error while performing Query 12. ', err);  
		}
	});	
}

// connection.query("SHOW COLUMNS FROM parking_lots", function(err, rows, fields) {
	// for(i in rows){
		// console.log("%j", rows[i]);
	// }
// });	

connection.query("Select * FROM parking_lots", function(err, rows, fields) {
	console.log("parking lots:");
	for(i in rows){
		console.log("%j", rows[i]);
	}
});	

function DBgetParkingByParkingId(parking_id, response){
	connection.query('SELECT * FROM parking_lots WHERE parking_lot_id = "' + parking_id+ '"', function(err, rows, fields) {
		var getResponse;
		if(err)
			response(new Response(null, JSON.stringify(err)));
		else if (rows.length == 0) {
			response(new Response(null, "no parking was found"));
		}
		else {
      var parking_found = new ParkingSpace(new Location(rows[0].latitude, rows[0].longitude), rows[0].creating_user_id, rows[0].time_established);				
      parking_found.UsersOnTheWay = rows[0].number_of_users_on_the_way;
     	parking_found.id = rows[0].parking_lot_id;
      response(new Response(parking_found, null)); 

		}
				
	});	
}

function DBUpdateScore(user, delta){	
	var user_id;
	var score;
	user_id	= user.id;
	//default
	 if (user_id === undefined) {
		 console.log("User id is undefined");
          return;
    }  
	//update user score
	connection.query('UPDATE users SET score = score + "' +delta+ '" WHERE user_id = "' +user_id+ '"', function(err, rows, fields) {
		if (!err) {
			user.Score += delta; //update user's score
			console.log('Score of user ' +user_id+ ' is updated');
		}
		else {
			console.log('Error while performing Query 13. ', err); 
		}
	});	
	
	//check user score
	connection.query('SELECT score FROM users WHERE user_id = "' +user_id+ '"', function(err, rows, fields) {
		if (!err) {
			if (rows.length > 0) {
				for (var i in rows) {
					score = rows[i].score;
					console.log("Score of user " +user_id+ " is " +score);
					//DBUpdateRank(user, score);
					//1st Rank
					if (score >= rank1 && score < rank2) {
						///console.log("RANK1");
						connection.query('UPDATE users SET rank = 1 WHERE user_id = "' +user_id+ '"', function(err, rows, fields) {
							if (!err) {
								user.Rank = 1; //update user rank
								console.log('1. Rank of user ' +user_id+ ' is ' +user.Rank);
							}
							else {
								console.log('Error while performing Query 14. ', err); 
							}
						});	
					}
					//2nd Rank
					if (score >= rank2 && score < rank3) {
						///console.log("RANK2");
						connection.query('UPDATE users SET rank = 2 WHERE user_id = "' +user_id+ '"', function(err, rows, fields) {
							if (!err) {
								user.Rank = 2; //update user rank
								console.log('2. Rank of user ' +user_id+ ' is ' +user.Rank);
							}
							else {
								console.log('Error while performing Query. ', err); 
							}
						});	
					}
					//3rd Rank
					if (score >= rank3) {
						///console.log("RANK3");
						connection.query('UPDATE users SET rank = 3 WHERE user_id = "' +user_id+ '"', function(err, rows, fields) {
							if (!err) {
								console.log(user.Rank);
								user.Rank = 3; //update user rank
								console.log('3. Rank of user ' +user_id+ ' is ' +user.Rank);
							}
							else {
								console.log('Error while performing Query 15. ', err); 
							}
						});	
					}
	
				}
			}
					

		}
		else {
			console.log('Error while performing Query 16. ', err); 
		}
	});	
	
	
}

//add 1 to current number_of_false_parkings_for_today
function DBIncreaseNumberOfFalseParkings(user){	
	var user_id;
	user_id	= user.id;
	//default
	 if (user_id === undefined) {
          user_id = 1;
    }  
	//update user score
	connection.query('UPDATE users SET number_of_false_parkings_for_today = number_of_false_parkings_for_today + 1 WHERE user_id = "' +user_id+ '"', function(err, rows, fields) {
		if (!err) {
			user.NumberOfFalseParkingForToday += 1; //update user's score
			console.log('Number of false parking for today of user ' +user_id+ ' increased by 1.');
		}
		else {
			console.log('Error while performing Query 17. ', err); 
		}
	});	
}

function DBDecreaseNumberOfFalseParkings(user){	
	var user_id;
	user_id	= user.id;
	//default
	 if (user_id === undefined) {
          user_id = 1;
    }  
	//update user score
	connection.query('UPDATE users SET number_of_false_parkings_for_today = number_of_false_parkings_for_today - 1 WHERE user_id = "' +user_id+ '"', function(err, rows, fields) {
		if (!err) {
			user.NumberOfFalseParkingForToday += 1; //update user's score
			console.log('Number of false parking for today of user ' +user_id+ ' increased by 1.');
		}
		else {
			console.log('Error while performing Query 17. ', err); 
		}
	});	
}


//change in DB relevant data (parking table, users table)
//DB.parking.userOnTheWay++;
//user.choseParking = parking.ID;
function choseParking(user, parking_id){	
	var user_id;
	user_id = user.id;
  
	//default
	if (user_id === undefined) {
		return;
    } 
	if (parking_id === undefined) {
		return;
    } 
	//get current time in formatted form
	var start_time_of_looking_ms = new Date().getTime();//get current system time in milliseconds since 1970/01/01
//	= new Date().toJSON().substring(0,19).replace('T',' '); 
    //if user already has parking
    if(user.ChosenParkingSpace != null) {
        //decrease number of users on the way to old parking
        connection.query('UPDATE parking_lots SET number_of_users_on_the_way = number_of_users_on_the_way - 1 WHERE parking_lot_id = "' +user.ChosenParkingSpace+ '"', function(err, rows, fields) {
            if (!err) {
                console.log('Numbers of users on the way for parking ' +user.ChosenParkingSpace+ ' is decreased.');
                //return true;
            }
            else {
                console.log('Error while performing Query. ', err); 
            }
        });         
        //set new parking lot for this user in table users_looking_for_parkings
        connection.query('UPDATE users_looking_for_parkings SET chosen_parking_lot_id = "' + parking_id + '" WHERE user_id = "' +user_id+ '"', function(err, rows, fields) {
            if (!err) {
                console.log('New parking set for user ' +user_id+ ' is decreased.');
                //return true;
            }
            else {
                console.log('Error while performing Query. ', err); 
            }
        });         
        //set new parking lot for this user object
        user.ChosenParkingSpace = parking_id;
        console.log('User '+user_id+' selected new pakring lot ' +parking_id+ '.');
    }
    //if user has no parking
    else {
	
		//add data into users_looking_for_parkings table
		connection.query('INSERT INTO users_looking_for_parkings (user_id, latitude, longitude, chosen_parking_lot_id, start_time_of_looking) VALUES ("' +user.id+ '","' +user.location.Lat+ '","' +user.location.Long+ '","' +parking_id+ '","' +start_time_of_looking_ms+ '")', function(err, rows, fields) {
		//connection.query('UPDATE users_looking_for_parkings SET chosen_parking_lot_id = "' + parking_id + '" WHERE user_id = "' + user_id + '")', function(err, rows, fields) {
			if (!err) {
				user.ChosenParkingSpace = parking_id;
				console.log('User '+user_id+' selected pakring lot ' +parking_id+ '.');
			}
			else {
				console.log('Error while performing Query 19. ', err); 
			}
		});
	}
	//increase number of users on the way
  console.log("@@@@parking id : " + parking_id);
	connection.query('UPDATE parking_lots SET number_of_users_on_the_way = number_of_users_on_the_way + 1 WHERE parking_lot_id = "' + parking_id+ '"', function(err, rows, fields) {
		if (!err) {
			console.log('Numbers of users on the way for parking ' +parking_id+ ' is increased');
			//return true;
		}
		else {
			console.log('Error while performing Query 18. ', err); 
		}
	});	

	
}


//get current parking of user
function DBGetChosenParking(user, response) {	
	var user_id;
	user_id	= user.id;
	var parking_id;
	//default
	 if (user_id === undefined) {
          return;
    }  
	
	//update user score
	connection.query('SELECT chosen_parking_lot_id FROM users_looking_for_parkings WHERE user_id = "' +user_id+ '"', function(err, rows, fields) {
		if (!err) {
			//user has a parking
			if(rows.length > 0) {
				//get parking id
				for (var i in rows) {
					parking_id = rows[i].chosen_parking_lot_id;
				}
				user.ChosenParkingSpace = parking_id;
				response(parking_id);
			}
			//user has no parking
			else {
				user.ChosenParkingSpace = null;
				response(null);
			}
		}else {
			console.log('Error while performing Query. ', err); 
		}
	});	
}




//DB.parking.userOnTheWay--;
//user.choseParking = null;
function cancelParking(user, parking){
	var user_id;
	var parking_id;
	user_id = user.id;
	parking_id = parking;
  user.ChosenParkingSpace = null;
	//default
	if (user_id === undefined) {
		return;
    } 
	if (parking_id === undefined) {
		return;
    } 
	//decrease number of users on the way
	connection.query('UPDATE parking_lots SET number_of_users_on_the_way = number_of_users_on_the_way - 1 WHERE parking_lot_id = "' +parking_id+ '"', function(err, rows, fields) {
		if (!err) {
			console.log('Numbers of users on the way for parking ' +parking_id+ ' is decreased.');
			//return true;
		}
		else {
			console.log('Error while performing Query 3. ', err); 
		}
	});	
	//nullify parking lot for given user
	connection.query('UPDATE users_looking_for_parkings SET chosen_parking_lot_id = null WHERE user_id = "' +user_id+ '"', function(err, rows, fields) {
		if (!err) {
			user.ChosenParkingSpace = null;
			console.log('Parking lot of user ' +user_id+ ' is cancelled. ');
		}
		else {
			console.log('Error while performing Query 4. ', err); 
		}
	});	
}


function getMessages(user_id, response){
  connection.query('SELECT * FROM messages WHERE user_id ="' + user_id + '"', function(err, rows, fields) {
		if (!err) {
      console.log("messages rows", rows);
      var allMessages = "";
      for(var i =0; i<rows.length; i++){
        deleteMessage(rows[i].id);
        allMessages += rows[i].message +"\n";
      }
			response(allMessages);
		}
		else {
			console.log('Error while performing Query 41. ', err); 
		}
    
  });
  
}
function deleteMessage(id){
  connection.query('DELETE FROM messages WHERE id ="' + id + '"', function(err, rows, fields) {});
}
function setMessage(user_id, message){
  console.log("user id: " + user_id +" message: " + message);
  connection.query('INSERT INTO messages (user_id, message) VALUES ("' + user_id + '", "' + message + '")', function(err, rows, fields) {});
}

//Objects
function Register(user, error){
	this.user = user;
	this.error = error;
}

function Login(user, error){
	this.user = user;
	this.error = error;
}

function parkingList(list, recommanded_index){
	this.list = list;
	this.recommanded_index = recommanded_index;
}

function Response(object_data, error){
	this.object_data = object_data;
	this.error = error;
}

function Location(Lat, Long) {
    this.Lat = Lat;
    this.Long = Long;

    this.IsValidLocation = function(){
        //check that the location is valid and in TLV
    }
}
 
function ParkingSpace(Location, CreatingUser, TimeEstablished) {
    this.Location = Location;
    this.CreatingUser = CreatingUser;
    this.TimeEstablished = TimeEstablished;
    this.UsersOnTheWay = 0;
	this.id
	this.dist=0;
	
    this.GetParkingColor = function(Location){
        //gets the color to be displayed on the map, based on time established
        //new parkings - light green. gets darker with correlation to the time passed.
    }
}

function User(Name, Password) {
    this.id = -1;
    this.Name = Name;
	this.Password = Password;
    this.Score = 0;
	this.Rank = 0;
    this.Location = null;
    this.NumberOfFalseParkingForToday = 0;
    this.UsersHelpedTodayIds = [];
    this.ChosenParkingSpace = null;
	
    this.SetLocation = DBSetLocation;
    this.AddScores = function(ScoresToAdd){
        this.Score += ScoresToAdd;
    }
    this.GetScoreGroups = function(){
        //returns the ScoringGroup according to the user score
    }
    this.DeleteFromDatabase = function(){
        //Delete the user from the DB
    }
    this.ChangePassword = function(NewPassword){
        //change the user pass
    }
    this.AddToDatabase = function(){
        //Add user to the DB
    }
}
