# iNatJS
An iNaturalist API toolkit for Javascript

iNatJS provides a flexible wrapper for interfacing with the iNaturalist API. 

## Features:
- Runs API requests with a queueing system with rate-limiting to stay within iNaturalist API limits
- Supports authenticated API requests
- Supports API [v1](https://api.inaturalist.org/v1/docs/) and [v2](https://api.inaturalist.org/v2/docs/) (v2 allows for customizing the returned data fields)
- Constructs the url for the AJAX call, including any parameters

## Examples

### Basic Example

```javascript

queueINatRequest({
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
  },
  error: function(xhr, status, error) {
    // handle error
    console.log(status + ' ' + xhr.status + ': ' + error);
  }
});

```
