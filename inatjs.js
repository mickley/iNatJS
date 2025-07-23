// ########################################
// iNatJS: An iNaturalist API toolkit for Javascript v2.0
// By James Mickley
// 
// License: GNU GPLv3: https://www.gnu.org/licenses/gpl-3.0.en.html
//
// Features:
// - Runs API requests with a queueing system with rate-limiting to stay within iNaturalist API limits
// - Supports authenticated API requests
// - Supports API v1 and v2 (v2 allows for customizing the returned data fields)
// - Constructs ajax url, including parameters


// Class definition
class iNatJS {

   // ########################################
   // ############## Properties ##############

   // ##### Private properties #####
   #base_url = "https://api.inaturalist.org";
   #headers =  {
      "Authorization": '',
      "Accept": "application/json"
   };

   // iNaturalist place types dictionary
   #place_types = {
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

   // ##### Public properties #####

   // iNaturalist authorization.
   // If authorized, the headers will be updated, and iNatAuthorized set to the authorized user login
   iNatAuthorized = false;

   // Rate-limiting queue
   iNatAPIQueue = [];
   iNatAPIQueued = false;
   iNatAPIRateLimiting = false;


   // ########################################
   // ############# Constructor ##############


   // Run on class instance creation
   // Allows a short burst of requests up to requests per minute, and then institutes rate-limiting
   // Set the API rate-limiting time in ms
   // Set the number of requests in a minute before rate-limiting is enabled
   constructor(APITimeout = 1000, RequestsPerMinute = 60) {

      // ## iNaturalist API Rate-limiting ##
      // iNaturalist throttles API usage to 100 requests/minute, but asks us to try to stay within 60/minute and 10,000/day
      // See: https://api.inaturalist.org/v1/docs/
      this.APITimeout = APITimeout;
      this.RequestsPerMinute = RequestsPerMinute;
   }


   // ########################################
   // ########## Getters & Setters ###########


   // Place types (read only)
   get place_types() {
      return this.#place_types;
   }


   // Headers (read only)
   get headers() {
      return this.#headers;
   }

   // ########################################
   // ########## Main API Methods ############


   // Make the iNat API calls, but with rate-limiting enabled
   makeINatRequest() {

      // Check if there are API requests in the queue, if so, run the first one
      if (this.iNatAPIQueue.length > 0) {

         // Get the first API request in line
         const request = this.iNatAPIQueue.shift();

         // Allow a short burst of requests up to requests per minute, and then institute rate-limiting
         if (this.iNatAPIQueue.length > this.RequestsPerMinute) this.iNatAPIRateLimiting = true;

         // Construct url from base URL, api version, endpoint, and any parameters
         let url = [this.#base_url, request.apiVersion, request.endpoint].join("/");

         // Add url parameters, if specified
         if(typeof request.params == 'object') url += "?" + $.param(request.params);

         // Add fields parameter for API v2, if specified
         if(request.apiVersion == "v2" && request.fields !== undefined && request.fields != "" ) url += (typeof request.params == 'object' ? "&" : "?") + 
            "fields=" + request.fields;

         // Run the API request
         $.ajax({
            method: request.method,
            headers: request.headers,
            data: request.data,
            dataType: "json",
            contentType: 'application/json',
            url: url,
            success: (data) => {

               // Run the request success callback
               request.success(data);
            },
            error: (xhr, status, error) => {

               // Run the request error callback
               request.error(xhr, status, error);
            },
            complete: (xhr, status) => {

               // Check if we have a full request queue
               if (this.iNatAPIRateLimiting) {

                  // Set a timeout to run the next API call in the queue, if any
                  setTimeout(this.makeINatRequest, this.APITimeout);
               } else {

                  // Run the next API call in the queue immediately
                  this.makeINatRequest()
               }
            }
         });

      } else {

         // API request queue is empty, deactivate queueing
         this.iNatAPIQueued = false;
         this.iNatAPIRateLimiting = false;
      }
   }


   // Add an iNat API request to the queue
   // Required keys for the request: method, apiVersion, endpoint, success(), error()
   // Optional keys: headers (auth), params, fields (API v2), data
   queueINatRequest(request) {

      // Add headers, if not present
      if(!("headers" in request)) request.headers = this.#headers

      // Add the request to the API request queue
      this.iNatAPIQueue.push(request);

      // If API request queueing isn't activated, then run the request immediately
      if (!this.iNatAPIQueued) {
         this.makeINatRequest();
      }

      // Activate API request queueing
      this.iNatAPIQueued = true;
   }


   // Checks whether the iNat API queue is active. If so, waits [freq] in ms and re-checks
   // When the queue is empty, this returns false to the callback function
   checkiNatQueue(freq, callback, inst = this) {

      // Check if there is an active queue
      if (inst.iNatAPIQueued) {

         // Queue active, wait the freq time, then check again, passing the instance of this
         setTimeout(inst.checkiNatQueue, freq, freq, callback, inst);

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
   checkAuthentication(apiToken, callback) {

      // Check if apiToken is set
      if (apiToken) {

         // Set authorization header
         this.#headers.Authorization = apiToken;

         // Test authorization by accessing the "me" endpoint
         this.queueINatRequest({
            headers: this.#headers,
            method: 'GET',
            apiVersion: "v2",
            endpoint: "users/me",
            fields: "login",

            // User is authorized
            success: (user) => {

               // Set authorized user, return true and the user info
               this.iNatAuthorized = user.results[0].login;
               callback(true, user);
            },

            // User not authorized by iNaturalist
            error: (xhr, status, error) => {

               // Unset authorization, return false
               this.#headers.Authorization = '';
               this.iNatAuthorized = false;
               callback(false, {xhr, status, error});
            }

         });

      } else {

         // apiToken not set
         callback(false);
      }
   }

   // ########################################
   // #### Helper Methods: Add Addl. Data ####


   // Gets locality admin levels: country, state/province, county
   getAdminLevels(place_ids, callback){

      // Send the list of places to the iNaturalist places API to get admin levels
      // This returns the country, state/province, and county.
      this.queueINatRequest({
         headers : this.#headers,
         method: 'GET',
         apiVersion: "v2",
         endpoint: "places/" + place_ids.join(),
         params: {
            admin_level: "0,10,20"
         },
         fields: "admin_level,name",
         success: function(places) {

            let adminLevels = {};

            places.results.map(function(place){

               // Get county
               if(place.admin_level == 20){
                  adminLevels.county = place.name;

               // Get state/province
               } else if(place.admin_level == 10) {
                  adminLevels.stateProvince = place.name;

               // Get country
               } else if(place.admin_level == 0) {
                  adminLevels.country = place.name;
               }

            });

            // Retrieve the result
            callback(true, adminLevels);
         },
         error: function(xhr, status, error) {
            callback(false, {xhr, status, error});
         }
      });
   }


   // Gets the full taxonomy for a taxon ID or list of IDs, including all higher taxa
   getTaxonomy(ids, callback, levels = ["all"], page = 1, taxonomy = []){

      // If ids is a string with commas, split into an array by commas
      if(typeof ids === 'string' && ids.includes(',')) ids = ids.split(',');

      // If ids is a number, convert to an array
      if(typeof ids === 'number') ids = [ids];

      // If ids is not an array, we can't proceed
      if(!Array.isArray(ids)) {
         console.log("The ids argument must be a taxon ID, string of comma-separated IDs, or array of IDs")
         return false;
      }

      // Breaks up the list of ids into blocks of 30 to query the API (max supported)
      let idstr = ids.slice(30*page-30, Math.min(30*page, ids.length)).join(',');

      // Send a set of taxon ids to the iNaturalist taxa API to get higher level taxonomy
      this.queueINatRequest({
         headers : this.#headers,
         method: 'GET',
         apiVersion: "v2",
         endpoint: "taxa/" + idstr,
         fields: "(name:!t,rank:!t,ancestors:(name:!t,rank:!t))",
         success: (taxa) => {

            // Iterate over all the taxa results
            taxa.results.map(function(result){

               let taxon = {};

               // Create key-value pairs for all the ancestors
               result.ancestors.map(function(ancestor){

                  // If levels is an array, only include the ancestor if it's one of the specified levels
                  if(levels.includes(ancestor.rank) || levels.includes("all")) {
                     taxon[ancestor.rank] = ancestor.name;
                  }

               });

               // Include the taxon itself
               //taxon[result.rank] = result.name;

               // Add the taxon to the taxonomy array
               taxonomy.push(taxon);
            });

            // Increment the page number for the next block of IDs
            if(Math.ceil(ids.length/30) == page) {

               // Retrieve the result when we've finished
               callback(true, taxonomy);
            } else {

               // Call function again, incrementing the page, and passing what data we've gotten
               this.getTaxonomy(ids, callback, levels, page++, taxonomy);
            }
         },
         error: (xhr, status, error) => {
            callback(false, {xhr, status, error});
         }
      });
   }


   // Add data to an observation field on an iNaturalist record
   addObsField(obsID, fieldID, value, callback) {

      // Send data to add to a particular observation field for an observation
      this.queueINatRequest({
         headers : this.#headers,
         method: 'POST',
         apiVersion: "v2",
         endpoint: "observation_field_values",
         data: JSON.stringify({
            "observation_field_value": {
               "observation_id": obsID,
               "observation_field_id": fieldID,
               "value": value
            }
         }),
         success: (response) => {
            callback(true, response);
         },
         error: (xhr, status, error) => {
            callback(false, {xhr, status, error});
         }
      });
   }

   // ########################################
   // ########## Utility Methods #############


   // Method to convert an object/array of keys to a RISON field string (for API v2)
   // See: https://api.inaturalist.org/v2/docs/
   toRISON(arr) {

      // Define an array of parameters & a return string
      let param = [];
      let str = "";

      // Input is an object
      if(arr.constructor === Object) {

         // Iterate over each array key
         for (const [key, val] of Object.entries(arr)) {

            // If the value is still an object, add the parameter and recurse
            if(typeof(val) == "object") {
              param.push( key + ":" + this.toRISON(val) );

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
            str = this.toRISON(arr.split(","));

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


   // Parses out a scientific name from iNat into its component parts. 
   // Assumes that the taxon object contains the fields name and rank
   formatName(taxon, abbrev = {ssp: "ssp.", var: "var.", form: "f."}){

      let split = '';

      // Make an object to hold our taxonomy fields
      let nameObj = {}

      // If the taxon is not defined, stop and return empty string
      if (!taxon || !taxon.name) {

         nameObj.scientificName = '';

         // Return the name object
         return(nameObj);
      }

      // Set the scientific name to the name iNaturalist has, can be changed below
      nameObj.scientificName = taxon.name;

      // Add subspecies to name
      if(taxon.rank == 'subspecies') {

         //nameObj.scientificName = name.replace(/(\w+\s\w+)\s(\w+)/, '$1 ssp. $2');
         split = taxon.name.match(/(\w+)\s(\w+)\s(\w+)/)
         nameObj.scientificName = split[1] + ' ' + split[2] + ' ' + abbrev.ssp + ' ' + split[3];
         nameObj.binomialName = split[1] + ' ' + split[2];
         nameObj.genus = split[1];
         nameObj.specificEpithet = split[2];
         nameObj.taxonRank = abbrev.ssp;
         nameObj.infraspecificEpithet = split[3];

      // Add variety to name
      } else if(taxon.rank == 'variety') {

         //name = name.replace(/(\w+\s\w+)\s(\w+)/, '$1 var. $2');
         split = taxon.name.match(/(\w+)\s(\w+)\s(\w+)/)
         nameObj.scientificName = split[1] + ' ' + split[2] + ' ' + abbrev.var + ' ' + split[3];
         nameObj.binomialName = split[1] + ' ' + split[2];
         nameObj.genus = split[1];
         nameObj.specificEpithet = split[2];
         nameObj.taxonRank = abbrev.var;
         nameObj.infraspecificEpithet = split[3];

      // Add form to name
      } else if(taxon.rank == 'form') {

         //name = name.replace(/(\w+\s\w+)\s(\w+)/, '$1 f. $2');
         split = taxon.name.match(/(\w+)\s(\w+)\s(\w+)/)
         nameObj.scientificName = split[1] + ' ' + split[2] + ' ' + abbrev.form + ' ' + split[3];
         nameObj.binomialName = split[1] + ' ' + split[2];
         nameObj.genus = split[1];
         nameObj.specificEpithet = split[2];
         nameObj.taxonRank = abbrev.form;
         nameObj.infraspecificEpithet = split[3];

      } else if (taxon.rank == 'species'){

         split = taxon.name.match(/(\w+)\s(\w+)/)
         nameObj.binomialName = taxon.name;
         nameObj.genus = split[1];
         nameObj.specificEpithet = split[2];
         //nameObj.specificEpithet = taxon.name.replace(/(\w+)\s(\w+)/, '$2');

      } else if (taxon.rank == 'hybrid' || taxon.rank == 'genushybrid') {

         // Handle the following types of hybrid names:
         // Elymus repens × Hordeum jubatum, Polystichum andersonii × munitum, × Elyhordium, Centaurea × gerstlaueri
         // In theory, this could also handle something like Elymus × repens × Hordeum × jubatum
         split = taxon.name.match(/((×\s)?\w+)(\s((×\s)?\w+))?(\s((×\s)?\w+))?(\s((×\s)?\w+))?/)

         // Add binomial name if it's a named hybrid
         if(!split[7]) nameObj.binomialName = taxon.name;

         // Add genus if it's not an unnamed intergeneric hybrid
         if(!split[10]) nameObj.genus = split[1];

         // Add specific epithet if it's a named hybrid with a specific epithet
         if(!split[7] && split[4]) nameObj.specificEpithet = split[4];

      } else if (taxon.rank == 'genus'){

         nameObj.scientificName = taxon.name;
         nameObj.genus = taxon.name;

      } else if (taxon.rank == 'family'){

         nameObj.scientificName = taxon.name;
         nameObj.family = taxon.name;

      }

      // Return the name object
      return(nameObj);
   }


   // Method to convert a string of url parameters into an object
   // Returns the object, or optionally, a specified key
   getUrlParams(url, key){

      // Object to return
      const params = {};

      // Parse each url argument, decode it, and store in the object
      url.replace(/[?&]?([^=&]+)=([^&]*)/g, function(s, key, value){
         params[key] = decodeURIComponent(value);
      });

      // Return the specific key if specified, otherwise return the whole params object
      return key ? params[key] : params;
   }

}

