Resgrid Dispatch
===========================

Resgrid Dispatch an Ionic progressive web application (pwa), mobile app and Electron app that is intended for Dispatchers for Computer Aided Dispatch (CAD) user interface for Resgrid. 

*********



About Resgrid
-------------
Resgrid is an open-source Computer Aided Dispatch (CAD) solution for first responders, businesses and industrial environments. 

[Sign up for your free Resgrid Account Today!](https://resgrid.com)

## Configuration

```json
// [environment].json
{
    "BaseApiUrl":"",
    "ResgridApiUrl":"",
    "ChannelUrl":"",
    "ChannelHubName":"",
    "What3WordsKey":"",
    "IsDemo":false,
    "DemoToken":"",
    "Version":"",
    "ReleaseDate":"",
    "MapApiKey":"",
    "FirebaseApiKey":"",
    "FirebaseAuthDomain":"",
    "FirebaseDbUrl":"",
    "FirebaseProjId":"",
    "FirebaseStorage":"",
    "FirebaseSenderId":""
}
```

## Settings

### Settings.json Values
<table>
  <tr>
    <th>Setting</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>BaseApiUrl</td>
    <td>
      The base URL to talk to the Resgrid API (Services) for our hosted production system this is "https://api.resgrid.com"
    </td>
  </tr>
  <tr>
    <td>ResgridApiUrl</td>
    <td>
      The full URL (including version) to talk to the Resgrid API (Services) for our hosted production system this is "https://api.resgrid.com/api/v3"
    </td>
  </tr>
  <tr>
    <td>ChannelUrl</td>
    <td>
      The URL to connect to the SignalR hub for our hosted production system this is "https://api.resgrid.com/signalr"
    </td>
  </tr>
  <tr>
    <td>ChannelHubName</td>
    <td>
      The SignalR hub name to connect to receive events for
    </td>
  </tr>
  <tr>
    <td>What3WordsKey</td>
    <td>
      API Key to talk to the What3Words (https://what3words.com/) service
    </td>
  </tr>
  <tr>
    <td>IsDemo</td>
    <td>
      Is used for demo installation (should always be false)
    </td>
  </tr>
  <tr>
    <td>DemoToken</td>
    <td>
      Token used for demo installation (should always be empty string "")
    </td>
  </tr>
  <tr>
    <td>Version</td>
    <td>
      App Version
    </td>
  </tr>
  <tr>
    <td>ReleaseDate</td>
    <td>
      When Was this version released
    </td>
  </tr>
  <tr>
    <td>MapApiKey</td>
    <td>
      Api Key needed to talk to the backend map provider
    </td>
  </tr>
  <tr>
    <td>FirebaseApiKey</td>
    <td>
      API Key to talk to Firebase services
    </td>
  </tr>
  <tr>
    <td>FirebaseAuthDomain</td>
    <td>
      Auth domain for the dispatch firebase app
    </td>
  </tr>
  <tr>
    <td>FirebaseDbUrl</td>
    <td>
      URL of the Firebase database
    </td>
  </tr>
  <tr>
    <td>FirebaseProjId</td>
    <td>
      Id for the Dispatch Firebase project
    </td>
  </tr>
  <tr>
    <td>FirebaseStorage</td>
    <td>
      Domain name bucket for the Firebase storage
    </td>
  </tr>
  <tr>
    <td>FirebaseSenderId</td>
    <td>
      Push notification sender id for Firebase Cloud Messaging (FCM)
    </td>
  </tr>
</table>

## Environment Setup ##

The following prerequisites are required.

* Node.js (6.9.5)
* NPM (>= 3.10.10)
* Cordova (6.5.0)
* Ionic (2.2.1)
* Bower (1.5.2)
* bower-installer (1.2.0)
* Gulp (3.9.0)

*In addition, if you want to run on a emulator or physical device, you'll need your environment setup for iOS or Android development.*

To begin, install the required global components:

	$ npm install -g typescript cordova gulp ionic

Then clone the repository and install the node packages:

	$ git clone https://github.com/Resgrid/BigBoard.git
    $ cd BigBoard
	$ npm install

## Compilation ##

Now you can use the various gulp tasks to obtain Cordova plugins and install third party libraries via Bower.

*You can also just run `gulp` without any arguments which will run the below targets.*

	$ gulp libs       # Install 3rd Party JS libraries as defined in bower.json
	$ gulp plugins    # Install Cordova plugins as defined in package.json

## Development ##

The solution is setup to with Live Reload for Cordova Serve, to use Live Reloading during development:

*Open 1 command line window*

	$ ionic serve	  # Starts the cordova file web server

*Open another command line window*

	$ gulp dev		  # Starts the file watcher and hooks into live reload

## Solution ##



## Dependencies ##
    - [Ionic Framework](http://ionicframework.com/)
    - [Cordova](https://cordova.apache.org/)
    - [Angular2-Grid](https://github.com/BTMorton/angular2-grid)

## Notes ##


## Author's ##
* Shawn Jackson (Twitter: @DesignLimbo Blog: http://designlimbo.com)
* Jason Jarrett (Twitter: @staxmanade Blog: http://staxmanade.com)

## License ##
[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)

## Acknowledgments