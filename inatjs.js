// ########################################
// iNatJS: An iNaturalist API toolkit for Javascript v1.2
// By James Mickley
// 
// License: GNU GPLv3: https://www.gnu.org/licenses/gpl-3.0.en.html
//
// Features:
// - Runs API requests with a queueing system with rate-limiting to stay within iNaturalist API limits
// - Supports authenticated API requests
// - Supports API v1 and v2 (v2 allows for customizing the returned data fields)
// - Constructs ajax url, including parameters
//
// ########################################
// ########## Global Variables ############

const base_url = "https://api.inaturalist.org"

// ## iNaturalist API Rate-limiting ##
// iNaturalist throttles API usage to 100 requests/minute, but asks us to try to stay within 60/minute and 10,000/day
// See: https://api.inaturalist.org/v1/docs/

// Rate-limiting options
const apiOptions = {
   APITimeout: 1000, // Set the API rate-limiting time to 1000 ms
   RequestsPerMinute: 60 // Set the number of requests in a minute before rate-limiting is enabled
};

// Rate-limiting queue
const iNatAPIQueue = [];
let iNatAPIQueued = false;
let iNatAPIRateLimiting = false;

// iNaturalist authorization. 
// If authorized, the headers will be updated, and iNatAuthorized set to the authorized user login
let iNatAuthorized = false;
const headers =  {     
   "Authorization": '',
   "Accept": "application/json"
};

// iNaturalist place type dictionary
const place_types = {
   0: "Undefined",
   2: "Street Segment",
   5: "Intersection",
   6: "Street",
   7: "Town",
   8: "State",
   9: "County",
   10: "Local Administrative Area",
   12: "Country",
   13: "Island",
   14: "Airport",
   15: "Drainage",
   16: "Land Feature",
   17: "Miscellaneous",
   18: "Nationality",
   19: "Supername",
   20: "Point of Interest",
   21: "Region",
   24: "Colloquial",
   25: "Zone",
   26: "Historical State",
   27: "Historical County",
   29: "Continent",
   33: "Estate",
   35: "Historical Town",
   36: "Aggregate",
   100: "Open Space",
   101: "Territory",
   102: "District",
   103: "Province",
   1000: "Municipality",
   1001: "Parish",
   1002: "Department Segment",
   1003: "City Building",
   1004: "Commune",
   1005: "Governorate",
   1006: "Prefecture",
   1007: "Canton",
   1008: "Republic",
   1009: "Division",
   1010: "Subdivision",
   1011: "Village block",
   1012: "Sum",
   1013: "Unknown",
   1014: "Shire",
   1015: "Prefecture City",
   1016: "Regency",
   1017: "Constituency",
   1018: "Local Authority",
   1019: "Poblacion",
   1020: "Delegation"
}

// ########################################
// ########## Main API Functions ##########


// Make the iNat API calls, but with rate-limiting enabled
function makeINatRequest() {

   // Check if there are API requests in the queue, if so, run the first one
   if (iNatAPIQueue.length > 0) {

      // Get the first API request in line
      const request = iNatAPIQueue.shift();

      if (iNatAPIQueue.length > apiOptions.RequestsPerMinute) iNatAPIRateLimiting = true;

      // Construct url from base URL, api version, endpoint, and any parameters
      let url = [base_url, request.apiVersion, request.endpoint].join("/");

      // Add url parameters, if specified
      if(typeof request.params == 'object') url += "?" + $.param(request.params);

      // Add fields parameter for API v2, if specified
      if(request.apiVersion == "v2" & request.fields != "") url += (typeof request.params == 'object' ? "&" : "?") + "fields=" + request.fields;

      // Run the API request
      $.ajax({
         method: request.method,
         headers: request.headers,
         data: request.data,
         dataType: "json",
         contentType: 'application/json',
         url: url,
         success: function(data) {

            // Run the request success callback
            request.success(data);
         }, 
         error: function(xhr, status, error) {

            // Run the request error callback
            request.error(xhr, status, error);
         },
         complete: function(xhr, status) {

            // Check if we have a full request queue
            if (iNatAPIRateLimiting) {

               // Set a timeout to run the next API call in the queue, if any
               setTimeout(makeINatRequest, apiOptions.APITimeout);
            } else {

               // Run the next API call in the queue immediately
               makeINatRequest()
            }
         }
      });

   } else {

      // API request queue is empty, deactivate queueing
      iNatAPIQueued = false;
      iNatAPIRateLimiting = false;
   }
}


// Add an iNat API request to the queue
// Required keys for the request: method, apiVersion, endpoint, success(), error()
// Optional keys: headers (auth), params, fields (API v2), data
function queueINatRequest(request) {

   // Add the request to the API request queue
   iNatAPIQueue.push(request);

   // If API request queueing isn't activated, then run the request immediately
   if (!iNatAPIQueued) {
      makeINatRequest();
   }

   // Activate API request queueing
   iNatAPIQueued = true;
}


// Checks whether the iNat API queue is active. If so, waits [freq] in ms and re-checks
// When the queue is empty, this returns false to the callback function
function checkiNatQueue(freq, callback) {

   // Check if there is an active queue
   if (iNatAPIQueued) {

      // Queue active, wait the freq time, then check again
      setTimeout(checkiNatQueue, freq, freq, callback);

      // There is an active queue, so return true
      callback(true)

   } else {

      // Queue is empty, so return false
      callback(false);

   }
}


// Verifies authentication using an API token. 
// Runs a callback returning true or false
// If authentication is successful, sets headers and iNatAuthorized for future use
function checkAuthentication(apiToken, callback) {

   // Check if apiToken is set
   if (apiToken) {

      // Set authorization header
      headers.Authorization = apiToken;

      // Test authorization by accessing the "me" endpoint
      queueINatRequest({
         headers: headers,
         method: 'GET',
         apiVersion: "v2",
         endpoint: "users/me",
         fields: "login", 

         // User is authorized
         success: function(user) {

            // Set authorized user, return true and the user info
            iNatAuthorized = user.results[0].login;
            callback(true, user);
         }, 

         // User not authorized by iNaturalist
         error: function(xhr, status, error) {

            // Unset authorization, return false
            headers.Authorization = '';
            iNatAuthorized = false;
            callback(false, {xhr, status, error});
         }

      });

   } else {
      // apiToken not set
      callback(false);
   }
}

// ########################################
// ########## Utility Functions ###########


// Function to convert an object/array of keys to a RISON field string (for API v2)
// See: https://api.inaturalist.org/v2/docs/
function toRISON(arr) {

   // Define an array of parameters & a return string
   let param = [];
   let str = "";

   // Input is an object
   if(arr.constructor === Object) {

      // Iterate over each array key
      for (const [key, val] of Object.entries(arr)) {
      
         // If the value is still an object, add the parameter and recurse
         if(typeof(val) == "object") {
           param.push( key + ":" + toRISON(val) );

         // Value is not an object, so just add it to our parameters array
         } else {
            param.push (key + ":!t");
         }
      }

      // Combine all the parameters
      str = "(" + param.join(",") + ")";

   // Input is an array, so just combine all the parameters
   } else if(arr.constructor === Array) {
      str = "(" + arr.join(":!t,") + ":!t)";

   // Input is a string
   } else if(arr.constructor === String) {

      // Check if it's a comma-separated list. If so, split to an array and recurse
      if(arr.includes(",")) {
         str = toRISON(arr.split(","));

      // Fallback to just including a single variable
      } else {
         str = "(" + arr + ":!t)";
      }

   } else {

      // Not a supported input data type
      return(false);
   }

   // Return the RISON string
   return(str);
}


// Function to convert a string of url parameters into an object
// Returns the object, or optionally a specified key
function getUrlParams(url, key){

   // Object to return
   const params = {};

   // Parse each url argument, decode it, and store in the object
   url.replace(/[?&]?([^=&]+)=([^&]*)/g, function(s, key, value){
      params[key] = decodeURIComponent(value);
   });

   // Return the specific key if specified, otherwise return the whole params object
   return key ? params[key] : params;
}


