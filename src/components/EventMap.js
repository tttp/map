import Vue from 'vue';
import { getFilteredEvents } from 'src/util/events';
import mapMarker from 'src/assets/images/map_marker.png';
import mapStyles from 'src/assets/styles/mapbox_styles';
import geoJsonHelpers from 'turf-helpers';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'pk.eyJ1Ijoia2VubmV0aHBlbm5pbmd0b24iLCJhIjoiY2l6bmJ3MmFiMDMzZTMzbDJtdGxkM3hveSJ9.w4iOGaL2vrIvETimSXUXsw';

export default function(store){
  return new Vue({
    el: '#event-map',
    name: 'event-map',
    template: require('src/templates/EventMap.html'),
    store,
    data: {
      mapRef: null,
      eventsLayer: null,
      initialCoordinates: [-96.9, 37.8],
      initialZoom: 3,
      boundsOfContinentalUS: [[-124.848974, 24.396308], [-66.885444, 49.384358]]
    },
    computed: {
      events() {
        return store.state.events;
      },
      zipcodes() {
        return store.state.zipcodes;
      },
      filters() {
        return store.state.filters;
      },
      filteredEvents() {
        return store.getters.filteredEvents;
      },
      view() {
        return store.state.view;
      }
    },
    watch: {
      events(newEvents, oldEvents) {
        this.plotEvents();

        // events data just showed up on app boot, if applicable
        // set the map position based on zip
        if (newEvents.length && !oldEvents.length) {
          this.setMapPositionBasedOnZip();
        }
      },

      // zipcodes should only change once, and when they do,
      // if applicable, set the map position based on zip
      zipcodes(newZipcodes, oldZipcodes) {
        this.plotEvents();
        this.setMapPositionBasedOnZip();
      },

      filters(newFilters, oldFilters) {
        this.plotEvents();

        // zoom to new location when zipcode changes
        if (newFilters.zipcode !== oldFilters.zipcode) {
          this.setMapPositionBasedOnZip();
        }
      }
    },
    methods: {
      plotEvents() {
        const eventsSource = this.mapRef.getSource("events");

        // mapbox will throw an error if we add data before the source has been added,
        // which may happen if the zipcodes load faster than mapbox-gl mounts
        if (eventsSource) {
          const eventsAsGeoJson = this.filteredEvents.map((event) => geoJsonHelpers.point([event.lng, event.lat]));
          eventsSource.setData(geoJsonHelpers.featureCollection(eventsAsGeoJson));
        }
      },

      setMapPositionBasedOnZip() {
        let latLng = this.zipcodes[this.filters.zipcode];
        if (latLng) latLng = [latLng[1], latLng[0]];
        const zoom = (latLng) ? 8 : this.initialZoom;

        if (latLng) {
          this.mapRef.flyTo({
            center: latLng,
            zoom: zoom
          });
        } else {
          this.mapRef.fitBounds(this.boundsOfContinentalUS);
        }
      },

      addCustomIcon(icon, name) {
        const img = new Image();
        img.src = icon;
        img.onload = () => {
          this.mapRef.addImage(name, img);
        };
        this.setCustomIconPixelRatio();
      },

      setCustomIconPixelRatio() {
        //Currently, mapbox-gl doesn't really care about the pixel ratio when
        //rendering icons, so we have to set it ourselves.
        const iconLayer = this.mapRef.getLayer("unclustered-points")
        if (!window.devicePixelRatio || !iconLayer) return;
        iconLayer.setLayoutProperty("icon-size", iconLayer.getLayoutProperty("icon-size") * window.devicePixelRatio);
      },

      createEmptyEventsDataSource() {
        this.mapRef.addSource("events", {
          "type": "geojson",
          "data": geoJsonHelpers.featureCollection([]),
          "cluster": true,
          "clusterMaxZoom": 8
        });
      },

      mapMounted() {
        this.mapRef.resize();
        this.createEmptyEventsDataSource();
        mapStyles.forEach((style) => this.mapRef.addLayer(style));
        this.addCustomIcon(mapMarker, "custom-marker");
        this.plotEvents();
      }
    },

    mounted() {
      this.mapRef = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/bright-v9',
        center: this.initialCoordinates,
        zoom: this.initialZoom
      });

      this.mapRef.addControl(new mapboxgl.NavigationControl());
      this.mapRef.on("load", this.mapMounted);
    }
  })
}
