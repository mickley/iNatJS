# iNatJS
An iNaturalist API toolkit for Javascript

iNatJS provides a flexible wrapper for interfacing with the iNaturalist API. 

## Features:
- Runs API requests with a queueing system with rate-limiting to stay within iNaturalist API limits
- Supports authenticated API requests
- Supports API [v1](https://api.inaturalist.org/v1/docs/) and [v2](https://api.inaturalist.org/v2/docs/) (v2 allows for customizing the returned data fields)
- Constructs the url for the AJAX call, including any parameters

## Function Reference

### constructor()
The constructor function that runs when a new class instance is created. Optionally, sets rate-limiting parameters. iNaturalist asks users to rate-limit to 60 requests per minute or lower. 
#### Parameters
- **APITimeout**: The timeout in milliseconds before running another API request. Default is 1000 (1 second)
- **RequestsPerMinute**: Effectively, the number of requests before rate-limiting is enabled. Default is 60

#### Examples
``` javascript
const iNat = new iNatJS(RequestsPerMinute = 30);
```


### queueINatRequest()
Adds an API request to a request queue. If the queue is empty, then the API request is executed immediately, otherwise rate-limiting is enforced. 
#### Parameters
- **request object**: {method, apiVersion, endpoint, [headers], [params], [fields], [data], success, error}
  - **method**: GET, POST, PUT, DELETE
  - **apiVersion**: [v1](https://api.inaturalist.org/v1/docs/) or [v2](https://api.inaturalist.org/v2/docs/)
  - **endpoint**: the iNaturalist api endpoint (e.g., observations, identifications/identifiers, users/autocomplete)
  - **headers** _(optional)_: A headers object to send along with the request. This includes the authorization. If headers are not in the request object, they will be included by default. 
  - **params** _(optional)_: An object of key-value parameters to include in the endpoint url
  - **fields** _(optional)_: For API v2 only. A list of fields to return. Takes a comma-separated string, or RISON (which can be generated using toRISON(), below).
  - **data** _(optional)_: A string of JSON data to include, typically for POST calls
  - **success**: function(data), a success callback that returns a JSON object from the successful API call
  - **error**: function(xhr, status, error), an error callback that returns the error condition variables from the API call

#### Return Values
returns `undefined`


### checkAuthentication()
Using an API token, authenticates a user with iNaturalist so that API requests are authenticated (looser limits, preferred by iNaturalist). 
#### Parameters
- **apiToken**: An iNaturalist JSON Web Token from https://www.inaturalist.org/users/api_token
- **callback**: function(success, data), a callback that returns true and an object of info on the authenticated user, or false, and an object of error condition variables

#### Return Values
returns `undefined`


### checkiNatQueue()
A function to check whether the request queue is empty to see if all API requests have completed. 
#### Parameters
- **frequency**: The frequency in milliseconds to check whether the queue is still active
- **callback**: function(isQueueActive), a callback function that returns true if the queue is active, or false if it's empty. 

#### Return Values
returns `undefined`


### toRISON()
Converts an object, array, or comma-separated string into RISON for use in the fields parameter of API [v2](https://api.inaturalist.org/v2/docs/). See [v2](https://api.inaturalist.org/v2/docs/) for more information.
#### Parameters
- **data**: In the form of an object, array, or comma-separated string.

#### Return Values
A RISON-encoded string to use for the fields parameter

#### Examples
``` javascript
toRISON({
  id: "",
  observed_on: "",
  taxon: {
    name: "",
    rank: ""
  },
}); // returns '(id:!t,observed_on:!t,taxon:(name:!t,rank:!t))'

toRISON(["id", "observed_on", "place_guess"); // returns '(id:!t,observed_on:!t,place_guess:!t)'
```


### getAdminLevels()
Gets the higher level admin levels (country, state/province, county) from iNaturalist for a list of place ids. 
#### Parameters
- **place_ids**: an array of place ids returned from an iNaturalist API call; typically all the places that an observation is a member of.
- **callback**: function(success, data), a callback that returns true and an object the admin levels, or false, and an object of error condition variables

#### Return Values
returns `undefined`


### getTaxonomy()
Gets the higher taxonomy from iNaturalist for a given iNaturalist taxon ID or list of ids.
#### Parameters
- **ids**: A single id, a comma-separated string of ids, or an array of ids corresponding to taxa on iNaturalist. An API call can process 30 at once, for more than that, the function is called recursively until higher taxonomy has been returned for all ids. 
- **callback**: function(success, data), a callback that returns true and an object containing the higher taxonomic levels, or false, and an object of error condition variables
- **levels** _(optional)_: An array of higher taxonomic levels to return, e.g, `["order", "family"]`. By default, it is set as `["all"]` to include all taxonomic levels returned. 

#### Return Values
Returns true unless the ids parameter cannot be parsed into a number or array of ids (then false). 


### formatName()
Parses out a scientific name from iNaturalist into its component parts, adding the infra-rank to the full name (iNaturalist doesn't do this by default), and returning whichever of the following taxonomic name fields are possible: scientificName, binomialName, family, genus, specificEpithet, taxonRank, infraspecificEpithet
#### Parameters
- **taxon**: a taxon object from iNaturalist that contains the fields name and rank
- **abbrev** _(optional)_: an object with the preferred abbreviation for ssp, var, and form. Default: `{ssp: "ssp.", var: "var.", form: "f."}`

#### Return Values
Returns an object with key-value pairs for each of the taxonomic name fields. 


### addObsField()
Adds data to a custom observation field for an iNaturalist observation. 
#### Parameters
- **observationID**: The uuid of the iNaturalist observation to add data to
- **fieldID**: The id of the custom observation field on iNaturalist
- **value**: The data to add to the custom observation field
- **callback**: function(success, response), a callback that returns true and the returned response object, or false, and an object of error condition variables

#### Return Values
returns `undefined`


### getURLParams()
Converts a string of URL key-value parameters into an object, which can then be included in an API request. Useful for passing GET url parameters for the current page to an API request.
#### Parameters
- **urlstring**: a string of URL parameters, e.g., whatever is after the ? of a GET request. example: `user_login=mickley&d1=2025-07-12`
- **key** _(optional)_: If key is specified, returns only the URL parameter specified by the key

#### Return Values
Returns an object of key-value parameters parsed from the string, or optionally a specific key if specified. 


### place_types()
Allows read-only access to the iNaturalist place types dictionary class variable. This allows for identifying the type of place returned in an API request (e.g, town, continent, island, point of interest). 

#### Return Values
Returns an object of place types on iNaturalist indexed by their ID. 


### headers()
Allows read-only access to the headers class variable, which includes any authorization that has been set. This can then be modified and included in a request.

#### Return Values
Returns the headers object


## Examples

```javascript

const iNat = new iNatJS();

iNat.queueINatRequest({
  method: 'GET',
  apiVersion: "v1",
  endpoint: "observations",
  params: {
    user_login: "mickley",
    quality_grade: "needs_id"
  },
  success: function(data) {
    console.log(data);
    // do something with the data
    
    // Get taxonomic name components for the first result
    console.log("Taxonomic Name Components: ", iNat.formatName(data.results[0].taxon));

    // Get higher taxonomy for the first result
    iNat.getTaxonomy(data.results[0].taxon.id, function(success, data){
      console.log("Higher Taxa: ", data[0]);
    });

    // Get geographic admin levels for the first results
    iNat.getAdminLevels(data.results[0].place_ids, function(success, data){
      console.log("Admin Levels: ", data);
    })
  },
  error: function(xhr, status, error) {
    // handle error
    console.log(status + ' ' + xhr.status + ': ' + error);
  }
});


iNat.queueINatRequest({
  method: 'GET',
  apiVersion: "v2",
  endpoint: "users/autocomplete",
  params: {
    q: "mickley"
  },
  fields: iNat.toRISON("icon,name,login"),
  success: function(data) {
    console.log(data);
  },
  error: function(xhr, status, error) {
    console.log(status + ' ' + xhr.status + ': ' + error);
  }
});


let id = 168279;
iNat.queueINatRequest({
  method: 'GET',
  apiVersion: "v2",
  endpoint: + 'projects/' + id,
  fields: "all",
  success: function(data) {
    console.log(data);
  },
  error: function(xhr, status, error) {
    console.log(status + ' ' + xhr.status + ': ' + error);
  }
});


```
