Resgrid Dispatch
===========================

Resgrid Dispatch an Ionic progressive web application (pwa), mobile app and Electron app that is intended for Dispatchers for Computer Aided Dispatch (CAD) user interface for Resgrid. 

*********



About Resgrid
-------------
Resgrid is an open-source Computer Aided Dispatch (CAD) solution for first responders, businesses and industrial environments. 

[Sign up for your free Resgrid Account Today!](https://resgrid.com)

## Configuration

You will need to create a .env file

```json
// .env
BASE_API_URL=
API_URL=
CHANNEL_URL=
CHANNEL_HUB_NAME=
LOG_LEVEL=
OSM_MAP_KEY=
GOOGLE_MAPS_KEY=
LOGGING_KEY=
```

## Settings

### .env Values
<table>
  <tr>
    <th>Setting</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>BASE_API_URL</td>
    <td>
      The base URL to talk to the Resgrid API (Services) for our hosted production system this is "https://api.resgrid.com"
    </td>
  </tr>
  <tr>
    <td>API_URL</td>
    <td>
      The version api path for the BASE_API_URL for the hosted system the default is "/api/v4"
    </td>
  </tr>
  <tr>
    <td>CHANNEL_URL</td>
    <td>
      The URL to connect to the SignalR hub for our hosted production system this is "https://events.resgrid.com/"
    </td>
  </tr>
  <tr>
    <td>CHANNEL_HUB_NAME</td>
    <td>
      The SignalR hub name to connect to receive events for. The hosted system default is "eventingHub"
    </td>
  </tr>
  <tr>
    <td>LOG_LEVEL</td>
    <td>
      Log level for the Ngx-ResgridLib library: 0 = Debug and above, 1 = Warn and above, 2 = Error only, -1 = Off
    </td>
  </tr>
  <tr>
    <td>OSM_MAP_KEY</td>
    <td>
      API Key for MapTiler.com
    </td>
  </tr>
  <tr>
    <td>GOOGLE_MAPS_KEY</td>
    <td>
      API Key for Google Maps, ensure the geocoding forward and reverse permissions and apis are available to it.
    </td>
  </tr>
  <tr>
    <td>LOGGING_KEY</td>
    <td>
      Sentry.io logging key
    </td>
  </tr>
</table>

## Deployment ##

  $  docker pull resgridllc/dispatch

## Author's ##
* Shawn Jackson (Twitter: @DesignLimbo Blog: http://designlimbo.com)
* Jason Jarrett (Twitter: @staxmanade Blog: http://staxmanade.com)

## License ##
[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)

## Acknowledgments