var fs = require('fs');

// file is included here:
eval(fs.readFileSync('DB_logic.js')+'');

var http = require('http');

const PORT=80; 
const waitTimeByRank = [120000, 60000, 30000, 10000, 0];
const rank_occopaid_creator=2;
const rank_valid_creator=100;
const rank_reporter=10;



//=====================================================================
//CODE
//=====================================================================

function getMinDist(origin, destinations, response){
	
	//Calculate distance using Google Maps API
	var content = "";  

	var options = {
  	host: 'maps.googleapis.com',
  	port: 80,
  	path: '/maps/api/distancematrix/json?origins='+origin+'&destinations='+destinations.join('|')
	};
	
	//Call API
	http.get(options, function(res) {
	
  		console.log("Got response: " + res.statusCode);
   		res.setEncoding("utf8");
    		res.on("data", function (chunk) {
        		content += chunk;
    		});
			var dists = [];
			
			//When response is ready
    		res.on("end", function () {
				
				try {
					
					//Parse JSON response
					var jso = JSON.parse(content, function(k,v){
						//console.log(k+', '+v);
						return v;
					});
					
					var list = jso["rows"][0]["elements"];
					var names = jso["destination_addresses"]
					var minDist = list[0]["distance"]["value"];
					var minName = names[0];
					
					//Extract distances
					for(var i = 0; i < list.length; i++) {
						try{
							dists.push(list[i]["distance"]["value"]);
						} catch(e){
							//If failed, distance = -1 (will be estimate later)
							dists.push(-1);
						}
					}
					
					//Return dist's list
					response(dists);
					return;
				} catch(e) {
					
					//If failed, return -1 as all distances
					for(var i = 0; i < destinations.length; i++) {
						dists.push(-1);
					}
					response(dists);
					return;
				}
    		});
	
	}).on('error', function(e) {
		
		var dists = [];
		console.log("Got error: " + content);
		
		//If failed, return -1 as all distances
  		for(var i = 0; i < destinations.length; i++) {
			dists.push(-1);
		}
		response(dists);
		return;
	});
		
}

//We need a function which handles requests and send response
function handleRequest(request, response){
	var origin= '32.058373,34.776262';
	var dists = ['32.078915,34.766571', '32.072818,34.768724', '32.058989,34.769496'];
    	getMinDist(origin, dists, function(dists){
			var result;
			for(var i =0; i< dists.length; i++)
				result += i + ". " + dists[i]+"\n"
			response.end(result);
		});
}



function getParkingScore(dist, UsersOnTheWay){
	//Parking score is higher as it more far or more users want to get there
	return dist*((UsersOnTheWay/5) +1);
}


function measure(lat1, lon1, lat2, lon2){  // generally used geo measurement function
    var R = 6378.137; // Radius of earth in KM
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d * 1000; // meters
}

//Noam:
//return parking list
function getParkingList(user, location, chosen_id, response){
	
 console.log("!!!%j", location);
	if(!validateLocation(location)){
		//location is not in tel aviv.
   //setMessage(user.id, "This app can be used only in tel aviv area!");
		return;
	}
	user.Location = location;
	
	//Get all parking in user's area from DB
	getParkingListFromDB(user.Location, waitTimeByRank[user.Rank], user, function(list){
		
		var dests = [];
		var index;
    if(list == null)
      list = [];
		if (list.length <= 1){
			var ret = new parkingList(list, 0);
			response(ret);
			return;
		}
		console.log("Found "+ list.length +" parking lots. Calculate distances...");
		//Get list of possible parking locations 
		for (index = 0; index < list.length; ++index) {
			dests.push(list[index].Location.Lat.toString() + "," + list[index].Location.Long.toString());
		}
	
		origin = location.Lat.toString() + "," + location.Long.toString();
		
		//Get destination from every parking
		getMinDist(origin, dests, function(dists){
			
			var recommanded_index = -1;
			var recommanded_score = 0;
		
			//find parking with minimum score
			for(var i = 0; i< dists.length; ++i){
				if(dists[i]< 0){
					// if no info, estimateד distance
					var x = location.Lat - list[i].Location.Lat;
					var y = location.Long - list[i].Location.Long;
					dists[i] = Math.floor(2*measure(location.Lat, location.Long, list[i].Location.Lat ,list[i].Location.Long));
				}
				list[i].dist=dists[i];
				//Calculate score
        if(chosen_id == list[i].id){
          score = getParkingScore(dists[i], 0);
        } else {
				  score = getParkingScore(dists[i], list[i].UsersOnTheWay);
        }
				console.log(i+ ") Parking score: " + score, "best so far: " +recommanded_score)
				if(recommanded_index <0 || score < recommanded_score){
					recommanded_index = i;
					recommanded_score = score;
				}
			}
		
			//Return list and recommanded parking
			response(new parkingList(list, recommanded_index));
			return;
		});
	});
}

// function updateTaken(parking){
	
	// //Notify all the relevant users that parking has taken.
	// DBgetAllUsers(parking.Location, function(users){
		// if(users == null){
			// return;
		// }
		
		// for(var i =0; i< users.length; i++){
			// var wasHaded = user.ChosenParkingSpace.id == parking.id;
			// sendTakenUpdate(users[i], parking, wasHaded)
		// }
	// });
// }

//return delta score
function parkedStatus(user, parking, isOccupaid, response){
	
	//Remove from DB and notify users
	// updateTaken(parking);
	DBUpdateParkedStatus(user, parking.id, isOccupaid);
	
	//Get creator
 console.log("!!!!%j", parking.CreatingUser);
	DBgetUserByID(parking.CreatingUser, null, function(parkingFrom){
		if(user.UsersHelpedTodayIds == null){
			user.UsersHelpedTodayIds =[];
		}
		if(parkingFrom.UsersHelpedTodayIds == null){
			parkingFrom.UsersHelpedTodayIds =[];
		}
		
		//User cannot help himself
		if(user.id == parkingFrom.id){
       setMessage(user.id, "User cannot get score on parking in is own parking");
			console.log("User tried to park in is own parking");
			response(0);
			return;
		}
		
		//If creator&reporter already helped each other today
		if(user.UsersHelpedTodayIds.indexOf(parkingFrom.id) > -1 || parkingFrom.UsersHelpedTodayIds.indexOf(user.id) > -1){
			console.log("Users already helped each other today");
      setMessage(user.id, "Users already helped each other today");
			response(0);
			return;
		}
		// Add creator to helpers list
		addHelpingUser(user.id, parkingFrom.id);
		
		if(!isOccupaid){
			//give cretor lots of score
			console.log("Users got more score!");
			DBUpdateScore(user, rank_reporter);
			DBUpdateScore(parkingFrom, rank_valid_creator);
      setMessage(parkingFrom.id, "You got " + rank_valid_creator + " points!");
		
			parkingFrom.NumberOfFalseParkingForToday = parkingFrom.NumberOfFalseParkingForToday - 1;
			DBDecreaseNumberOfFalseParkings(parkingFrom);
			response(rank_reporter);
			return;
		} else {
			DBUpdateScore(user, rank_reporter);
			
			//Cretor get score only for 5 occupaid parkings per day.
			if(parkingFrom.NumberOfFalseParkingForToday < 5){
				DBUpdateScore(parkingFrom, rank_occopaid_creator);
        setMessage(parkingFrom.id, "You got " + rank_occopaid_creator + " points!");
			} else {
				console.log("Too much occupaid parking for today");
			}
			

			response(rank_reporter);
			return;
		}
	});
}

//add park to DB
function addParking(user, location){
	if(validateLocation(location)){
		addParkingToDB(user, location);

	} else {
     setMessage(user.id, "This app can be used only in tel aviv area!");
 }
}

function validateLocation(location){
	//Tel-Aviv area
	if(location.Lat >= 32 && location.Lat <= 33 && location.Long >= 34 && location.Long <= 35){
		return true;
	}
   
	return false
}
//Tuval:
function sendUpdates(user, parking, /*boolean*/ recommanded){}
function sendTakenUpdate(user, parking, /*boolean*/ wasHadedTo){}

//when you call to getParkingList, I will call back to this function with the response.
function getParkingListResponse(parkingList){}


